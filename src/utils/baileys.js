const config = require('../../data/config.json')
const fs = require('fs')
const path = require('path')

const subdonosPath = path.join(__dirname, '../../data/subdonos.json')
const configPath = path.join(__dirname, '../../data/config.json')

let dynamicConfigCache = config
let lastConfigReadTime = 0
const CONFIG_READ_TTL = 3000

function getDynamicConfig() {
  const now = Date.now()
  if (now - lastConfigReadTime < CONFIG_READ_TTL) {
    return dynamicConfigCache
  }
  lastConfigReadTime = now
  try {
    if (fs.existsSync(configPath)) {
      dynamicConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    }
  } catch {}
  return dynamicConfigCache
}

let subdonosCache = null

function loadSubdonos() {
  if (subdonosCache) return subdonosCache
  try {
    subdonosCache = fs.existsSync(subdonosPath) ? JSON.parse(fs.readFileSync(subdonosPath, 'utf8')) : []
  } catch {
    subdonosCache = []
  }
  return subdonosCache
}

function saveSubdonos(subdonos) {
  subdonosCache = subdonos
  fs.promises.writeFile(subdonosPath, JSON.stringify(subdonos, null, 2), 'utf8').catch(err => {
    console.error('[BAILEYS] Erro ao salvar subdonos localmente:', err.message)
  })
  try {
    const { putFirebase } = require('./firebaseConfig')
    putFirebase('bot_data/subdonos', subdonos).catch(err => {
      console.error('[BAILEYS] Erro ao salvar subdonos no Firebase:', err.message)
    })
  } catch {}
}

async function sincronizarSubdonosFirebase() {
  try {
    const { fetchFirebase, putFirebase } = require('./firebaseConfig')
    const fbSubdonos = await fetchFirebase('bot_data/subdonos')
    if (Array.isArray(fbSubdonos)) {
      subdonosCache = fbSubdonos
      try {
        fs.writeFileSync(subdonosPath, JSON.stringify(fbSubdonos, null, 2), 'utf8')
      } catch {}
    } else {
      if (subdonosCache && subdonosCache.length > 0) {
        await putFirebase('bot_data/subdonos', subdonosCache)
      }
    }
  } catch (err) {
    console.error('[BAILEYS] Erro ao sincronizar subdonos do Firebase:', err.message)
  }
}

setTimeout(() => {
  sincronizarSubdonosFirebase().catch(() => {})
}, 1000)

function addSubdono(numero) {
  const subdonos = loadSubdonos()
  const numClean = numero.replace(/\D/g, '')
  if (!subdonos.includes(numClean)) {
    subdonos.push(numClean)
    saveSubdonos(subdonos)
    return true
  }
  return false
}

function removeSubdono(numero) {
  const subdonos = loadSubdonos()
  const numClean = numero.replace(/\D/g, '')
  const index = subdonos.indexOf(numClean)
  if (index !== -1) {
    subdonos.splice(index, 1)
    saveSubdonos(subdonos)
    return true
  }
  return false
}

function getSenderCandidateKeys(senderId) {
  const keys = new Set()
  if (!senderId) return keys
  const raw = String(senderId).trim()
  const rawId = raw.split('@')[0].split(':')[0]
  const cleanNum = rawId.replace(/\D/g, '')

  keys.add(raw)
  keys.add(rawId)
  if (cleanNum) {
    keys.add(cleanNum)
    keys.add(cleanNum + '@s.whatsapp.net')
    keys.add(cleanNum + '@lid')
    if (cleanNum.length === 9) {
      keys.add('258' + cleanNum)
      keys.add('258' + cleanNum + '@s.whatsapp.net')
    } else if (cleanNum.startsWith('258') && cleanNum.length === 12) {
      keys.add(cleanNum.slice(3))
      keys.add(cleanNum.slice(3) + '@s.whatsapp.net')
    }
  }

  try {
    const { loadMapeamento } = require('../bot/core')
    const map = loadMapeamento()
    if (map && typeof map === 'object') {
      if (cleanNum && map[cleanNum]) {
        const entry = map[cleanNum]
        if (entry.numero) {
          const en = String(entry.numero).replace(/\D/g, '')
          if (en) {
            keys.add(en)
            keys.add(en + '@s.whatsapp.net')
            if (en.length === 9) keys.add('258' + en)
            else if (en.startsWith('258') && en.length === 12) keys.add(en.slice(3))
          }
        }
        if (entry.lid) keys.add(String(entry.lid).replace(/\D/g, ''))
        if (Array.isArray(entry.lids)) entry.lids.forEach(l => keys.add(String(l).replace(/\D/g, '')))
      }

      for (const [k, v] of Object.entries(map)) {
        if (!v || typeof v !== 'object') continue
        const vNum = (v.numero || '').replace(/\D/g, '')
        if (vNum && (keys.has(vNum) || (vNum.length === 9 && keys.has('258' + vNum)) || (vNum.startsWith('258') && keys.has(vNum.slice(3))))) {
          const kClean = k.replace(/\D/g, '')
          if (kClean) keys.add(kClean)
          if (v.lid) keys.add(String(v.lid).replace(/\D/g, ''))
          if (Array.isArray(v.lids)) v.lids.forEach(l => keys.add(String(l).replace(/\D/g, '')))
        }
      }
    }
  } catch {}

  return keys
}

function isSubdonoCheck(sender) {
  if (!sender) return false
  const subdonos = loadSubdonos()
  if (!Array.isArray(subdonos) || subdonos.length === 0) return false
  const candidateKeys = getSenderCandidateKeys(sender)
  return subdonos.some(s => {
    const sClean = String(s).replace(/\D/g, '')
    return candidateKeys.has(s) || candidateKeys.has(sClean) || candidateKeys.has(s + '@s.whatsapp.net') || candidateKeys.has(s + '@lid')
  })
}

function isLeaderCheck(sender, msg = null) {
  if (msg && msg.key && msg.key.fromMe) {
    return true
  }
  if (!sender) return false
  const currentConfig = getDynamicConfig()
  const donos = Array.isArray(currentConfig.dono) ? [...currentConfig.dono] : [currentConfig.dono].filter(Boolean)
  if (Array.isArray(currentConfig.ownerLids)) {
    donos.push(...currentConfig.ownerLids)
  }
  const candidateKeys = getSenderCandidateKeys(sender)
  return donos.some(d => {
    const dClean = String(d).replace(/\D/g, '')
    return candidateKeys.has(d) || candidateKeys.has(dClean) || candidateKeys.has(d + '@s.whatsapp.net') || candidateKeys.has(d + '@lid')
  })
}

function isOwnerCheck(sender, msg = null) {
  if (isLeaderCheck(sender, msg)) {
    return true
  }
  return isSubdonoCheck(sender)
}

const metadataCache = new Map()
const CACHE_TTL = 300000

function fetchGroupMetadataFast(sock, from, ms = 1200) {
  if (!sock || typeof sock.groupMetadata !== 'function') return Promise.resolve(null)
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve(null)
      }
    }, ms)

    sock.groupMetadata(from).then(data => {
      if (!done) {
        done = true
        clearTimeout(timer)
        resolve(data)
      }
    }).catch(() => {
      if (!done) {
        done = true
        clearTimeout(timer)
        resolve(null)
      }
    })
  })
}

async function getGroupMetadataCached(sock, from) {
  const now = Date.now()
  const cached = metadataCache.get(from)

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data
  }

  try {
    const metadata = await fetchGroupMetadataFast(sock, from, 1200)
    if (metadata) {
      metadataCache.set(from, { data: metadata, timestamp: now })
      return metadata
    }
  } catch {}

  if (cached) return cached.data
  return sock.chats?.[from]?.metadata || sock.groupMetadataCache?.[from] || null
}

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      metadataCache.delete(key)
    }
  }
}, 300000)

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

function getSender(msg, fallbackSender = null) {
  if (fallbackSender && typeof fallbackSender === 'string' && !fallbackSender.endsWith('@g.us')) {
    return fallbackSender
  }
  let s = msg?.key?.participant || msg?.participant || ''
  if (!s && msg?.message?.extendedTextMessage?.contextInfo?.participant) {
    s = msg.message.extendedTextMessage.contextInfo.participant
  }
  if (!s && msg?.key?.remoteJid && !msg.key.remoteJid.endsWith('@g.us')) {
    s = msg.key.remoteJid
  }
  return s || ''
}

function getSenderNumber(msg) {
  const sender = getSender(msg)
  return sender.split('@')[0].split(':')[0]
}

async function isAdmin(sock, from, senderId) {
  if (!from || !from.endsWith('@g.us')) return false

  try {
    if (isOwnerCheck(senderId)) return true

    const candidateKeys = getSenderCandidateKeys(senderId)

    const checkParticipants = (participants) => {
      if (!Array.isArray(participants)) return false
      for (const p of participants) {
        if (!p.admin) continue
        const pId = p.id || ''
        const pLid = p.lid || ''
        const pPn = p.pn || p.phoneNumber || ''
        const pIdClean = pId.split('@')[0].split(':')[0].replace(/\D/g, '')
        const pLidClean = pLid.split('@')[0].split(':')[0].replace(/\D/g, '')
        const pPnClean = pPn.split('@')[0].split(':')[0].replace(/\D/g, '')

        if (candidateKeys.has(pId) || candidateKeys.has(pLid) || candidateKeys.has(pIdClean) || candidateKeys.has(pLidClean) || candidateKeys.has(pPnClean)) {
          return true
        }
      }
      return false
    }

    const metadata = await getGroupMetadataCached(sock, from)

    if (metadata && metadata.participants) {
      return checkParticipants(metadata.participants)
    }

    if (sock && typeof sock.groupMetadata === 'function') {
      try {
        const freshMeta = await fetchGroupMetadataFast(sock, from, 1500)
        if (freshMeta && freshMeta.participants) {
          metadataCache.set(from, { data: freshMeta, timestamp: Date.now() })
          return checkParticipants(freshMeta.participants)
        }
      } catch {}
    }

    return false
  } catch (err) {
    console.error('[isAdmin] Erro:', err.message)
    return false
  }
}

async function getCargo(sock, from, senderId) {
  if (!from.endsWith('@g.us')) return 'Privado'

  try {
    const metadata = await getGroupMetadataCached(sock, from)
    const participants = metadata.participants || []
    const senderClean = senderId.split('@')[0].split(':')[0]

    const participante = participants.find(p => {
      const idClean = p.id ? p.id.split('@')[0].split(':')[0] : ''
      if (idClean === senderClean) return true
      if (p.lid) {
        const lidClean = p.lid.split('@')[0].split(':')[0]
        if (lidClean === senderClean) return true
      }
      return false
    })

    if (participante?.admin) {
      return participante.admin === 'superadmin' ? 'Dono' : 'Administrador'
    }

    return 'Membro'
  } catch {
    return 'Membro'
  }
}

function invalidateGroupCache(from) {
  metadataCache.delete(from)
}

async function resolverParticipanteGrupo(sock, from, lidCru, msg = null) {
  if (!lidCru) return ''
  const lidLimpo = lidCru.split('@')[0].split(':')[0]

  const ehLidEvidente = lidCru.includes('@lid') || lidLimpo.length >= 14 || lidLimpo.startsWith('805') || lidLimpo.startsWith('185') || lidLimpo.startsWith('736') || lidLimpo.startsWith('101') || lidLimpo.startsWith('144') || lidLimpo.startsWith('191') || lidLimpo.startsWith('159')
  if (!ehLidEvidente && lidLimpo.length >= 9 && lidLimpo.length <= 13) {
    if (!lidCru.includes('@')) return lidLimpo + '@s.whatsapp.net'
    return lidCru
  }

  if (msg) {
    const msgSender = msg.key?.participant || msg.participant || msg.key?.remoteJid || ''
    const msgSenderLimpo = msgSender.split('@')[0].split(':')[0]
    if (msgSenderLimpo === lidLimpo) {
      const pnCandidate = msg.key?.participantPn || msg.participantPn || msg.key?.senderPn || msg.key?.userJid
      if (pnCandidate && !pnCandidate.includes('@lid')) {
        const pnClean = pnCandidate.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (pnClean && pnClean.length >= 9 && pnClean !== lidLimpo) {
          try {
            const { loadMapeamento, saveMapeamento } = require('../bot/core')
            const map = loadMapeamento()
            map[lidLimpo] = { numero: pnClean, sender: pnClean + '@s.whatsapp.net' }
            saveMapeamento()
          } catch {}
          return pnClean + '@s.whatsapp.net'
        }
      }
    }
  }

  try {
    const { buscarNumero } = require('../bot/core')
    const numero = buscarNumero(lidLimpo)
    if (numero && numero !== lidLimpo && !numero.includes('@lid')) {
      const numClean = numero.split('@')[0].split(':')[0].replace(/\D/g, '')
      if (numClean && numClean !== lidLimpo) {
        return numClean + '@s.whatsapp.net'
      }
    }
  } catch { }

  try {
    const metadata = await getGroupMetadataCached(sock, from)
    if (metadata?.participants) {
      for (const p of metadata.participants) {
        const pLid = (p.lid || '').split('@')[0].split(':')[0]
        const pId = (p.id || '').split('@')[0].split(':')[0]
        const pPn = (p.pn || p.phoneNumber || '').split('@')[0].split(':')[0]

        if (pLid === lidLimpo || pId === lidLimpo) {
          const realNum = (pPn && !pPn.includes('@lid') && pPn !== lidLimpo)
            ? pPn
            : (pId && !pId.includes('@lid') && pId !== lidLimpo ? pId : '')
          if (realNum) {
            const clean = realNum.replace(/\D/g, '')
            try {
              const { loadMapeamento, saveMapeamento } = require('../bot/core')
              const map = loadMapeamento()
              map[lidLimpo] = { numero: clean, sender: clean + '@s.whatsapp.net' }
              saveMapeamento()
            } catch {}
            return clean + '@s.whatsapp.net'
          }
        }
      }
    }
  } catch { }

  if (sock && typeof sock.groupMetadata === 'function' && from && from.endsWith('@g.us')) {
    try {
      const freshMeta = await sock.groupMetadata(from)
      if (freshMeta?.participants) {
        metadataCache.set(from, { data: freshMeta, timestamp: Date.now() })
        for (const p of freshMeta.participants) {
          const pLid = (p.lid || '').split('@')[0].split(':')[0]
          const pId = (p.id || '').split('@')[0].split(':')[0]
          const pPn = (p.pn || p.phoneNumber || '').split('@')[0].split(':')[0]

          if (pLid === lidLimpo || pId === lidLimpo) {
            const realNum = (pPn && !pPn.includes('@lid') && pPn !== lidLimpo)
              ? pPn
              : (pId && !pId.includes('@lid') && pId !== lidLimpo ? pId : '')
            if (realNum) {
              const clean = realNum.replace(/\D/g, '')
              try {
                const { loadMapeamento, saveMapeamento } = require('../bot/core')
                const map = loadMapeamento()
                map[lidLimpo] = { numero: clean, sender: clean + '@s.whatsapp.net' }
                saveMapeamento()
              } catch {}
              return clean + '@s.whatsapp.net'
            }
          }
        }
      }
    } catch {}
  }

  try {
    const contacts = sock?.store?.contacts || sock?.contacts || {}
    for (const [jid, c] of Object.entries(contacts)) {
      const cLid = (c.lid || '').split('@')[0].split(':')[0]
      if (cLid === lidLimpo) {
        const jidClean = jid.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (jidClean && !jid.includes('@lid') && jidClean !== lidLimpo) {
          return jidClean + '@s.whatsapp.net'
        }
      }
    }
  } catch {}

  return lidLimpo + '@lid'
}

module.exports = { getText, getSender, getSenderNumber, isAdmin, isOwnerCheck, isLeaderCheck, isSubdonoCheck, loadSubdonos, addSubdono, removeSubdono, getCargo, invalidateGroupCache, getGroupMetadataCached, resolverParticipanteGrupo }
