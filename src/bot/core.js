const fs = require('fs')
const path = require('path')
const { getGroupMetadataCached } = require('../utils/baileys')

const mapeamentoPath = path.join(__dirname, '../../data/mapeamentoUsuarios.json')

let mapeamentoCache = null
let saveMapeamentoTimer = null

function loadMapeamento() {
  if (mapeamentoCache) return mapeamentoCache
  try {
    mapeamentoCache = fs.existsSync(mapeamentoPath) ? JSON.parse(fs.readFileSync(mapeamentoPath, 'utf8')) : {}
  } catch {
    mapeamentoCache = {}
  }
  return mapeamentoCache
}

function saveMapeamento(force = false) {
  if (!mapeamentoCache) return
  const persist = async () => {
    try {
      const tempPath = `${mapeamentoPath}.${Date.now()}_${Math.random().toString(36).slice(2, 6)}.tmp`
      await fs.promises.writeFile(tempPath, JSON.stringify(mapeamentoCache, null, 2), 'utf8')
      await fs.promises.rename(tempPath, mapeamentoPath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[CORE] Erro ao salvar mapeamentoUsuarios:', err.message)
      }
    }
  }

  if (force) {
    if (saveMapeamentoTimer) clearTimeout(saveMapeamentoTimer)
    persist()
  } else if (!saveMapeamentoTimer) {
    saveMapeamentoTimer = setTimeout(() => {
      saveMapeamentoTimer = null
      persist()
    }, 4000)
  }
}

function registrarUsuario(sender, pushName) {
  const mapeamento = loadMapeamento()
  const numero = sender.split('@')[0].split(':')[0]

  if (!mapeamento[numero]) {
    mapeamento[numero] = {
      sender: sender,
      numero: numero,
      nome: pushName || '',
      ultimoVisto: new Date().toISOString()
    }
    saveMapeamento()
  } else if (pushName && !mapeamento[numero].nome) {
    mapeamento[numero].nome = pushName
    saveMapeamento()
  }
}

async function mapearGrupo(sock, groupId) {
  try {
    const metadata = await getGroupMetadataCached(sock, groupId)
    if (!metadata || !metadata.participants) return 0
    const mapeamento = loadMapeamento()
    let novos = 0

    for (const p of metadata.participants) {
      const pId = p.id || ''
      const pLid = p.lid || ''
      const pPn = p.pn || p.phoneNumber || ''

      let numeroReal = ''
      if (pPn && !pPn.includes('@lid')) {
        numeroReal = pPn.split('@')[0].split(':')[0].replace(/\D/g, '')
      } else if (pId && !pId.includes('@lid')) {
        numeroReal = pId.split('@')[0].split(':')[0].replace(/\D/g, '')
      }

      const lidClean = pLid ? pLid.split('@')[0].split(':')[0] : ''

      if (numeroReal) {
        if (!mapeamento[numeroReal]) {
          mapeamento[numeroReal] = {
            sender: numeroReal + '@s.whatsapp.net',
            numero: numeroReal,
            lids: lidClean ? [lidClean] : [],
            nome: '',
            admin: p.admin || null
          }
          novos++
        } else if (lidClean && (!mapeamento[numeroReal].lids || !mapeamento[numeroReal].lids.includes(lidClean))) {
          if (!mapeamento[numeroReal].lids) mapeamento[numeroReal].lids = []
          mapeamento[numeroReal].lids.push(lidClean)
          novos++
        }

        if (lidClean && !mapeamento[lidClean]) {
          mapeamento[lidClean] = {
            sender: numeroReal + '@s.whatsapp.net',
            numero: numeroReal,
            lid: lidClean,
            nome: '',
            admin: p.admin || null
          }
          novos++
        }
      }
    }

    if (novos > 0) {
      saveMapeamento()
      console.log(`[MAPEAMENTO] ${novos} novos registros mapeados do grupo ${metadata.subject || groupId}`)
    }

    return novos
  } catch (err) {
    console.error('[MAPEAMENTO] Erro:', err.message)
    return 0
  }
}

function buscarNumero(identificador) {
  const mapeamento = loadMapeamento()

  const id = identificador.split('@')[0].split(':')[0]

  if (mapeamento[id]) {
    return mapeamento[id].numero
  }

  for (const key in mapeamento) {
    const user = mapeamento[key]

    if (user.lids && Array.isArray(user.lids) && user.lids.includes(id)) {
      return user.numero
    }

    if (user.sender?.includes(id)) {
      return user.numero
    }
  }

  return identificador
}

function getText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  )
}

function getSender(msg) {
  return msg.key?.participant || msg.participant || msg.key?.remoteJid
}

async function core(sock, msg) {
  try {
    const from = msg.key.remoteJid
    const sender = getSender(msg)
    const text = getText(msg)
    const senderName = msg.pushName || (sender ? sender.split('@')[0] : 'Desconhecido')

    if (sender) {
      registrarUsuario(sender, senderName)
    }

    if (from.endsWith('@g.us')) {
      const mapeamento = loadMapeamento()
      const grupoKey = `_grupo_${from}`
      if (!mapeamento[grupoKey]) {
        await mapearGrupo(sock, from)
        mapeamento[grupoKey] = { mapeado: true, data: new Date().toISOString() }
        saveMapeamento()
      }
    }

    if (process.env.DEBUG_MSGS === 'true') {
      let groupName = ''
      let cargo = ''
      if (from.endsWith('@g.us')) {
        try {
          const metadata = await getGroupMetadataCached(sock, from)
          groupName = metadata.subject
          const participante = metadata.participants.find(p => sender.startsWith(p.id))
          cargo = participante?.admin ? (participante.admin === 'superadmin' ? 'Dono' : 'Administrador') : 'Membro'
        } catch {}
      }
      console.log(`\n👤 Nome: ${senderName}`)
      console.log(`📱 Número: ${sender.split('@')[0]}`)
      if (groupName) console.log(`👥 Grupo: ${groupName}`)
      if (cargo) console.log(`📌 Cargo: ${cargo}`)
      console.log(`💬 Mensagem: ${text}\n`)
    }

  } catch (err) {
    console.error('Erro no core:', err)
  }
}

module.exports = core
module.exports.buscarNumero = buscarNumero
module.exports.registrarUsuario = registrarUsuario
module.exports.mapearGrupo = mapearGrupo
module.exports.loadMapeamento = loadMapeamento
