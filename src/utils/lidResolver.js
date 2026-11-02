const fs = require('fs')
const path = require('path')
const {
  USyncQuery,
  USyncUser,
  isLidUser,
  isJidGroup,
  isJidStatusBroadcast,
  jidDecode,
  jidEncode,
  jidNormalizedUser
} = require('@whiskeysockets/baileys')

const lidCachePath = path.join(__dirname, '../../data/lidCache.json')
const subdonoLidsPath = path.join(__dirname, '../../data/subdonoLids.json')
const configPath = path.join(__dirname, '../../data/config.json')

let lidCache = null
let lidCacheTimer = null

function loadLidCache() {
  if (lidCache) return lidCache
  try {
    lidCache = fs.existsSync(lidCachePath) ? JSON.parse(fs.readFileSync(lidCachePath, 'utf8')) : {}
  } catch {
    lidCache = {}
  }
  return lidCache
}

function saveLidCache(force = false) {
  if (!lidCache) return
  const persist = async () => {
    try {
      const dir = path.dirname(lidCachePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const tmp = `${lidCachePath}.${Date.now()}_${Math.random().toString(36).slice(2, 6)}.tmp`
      await fs.promises.writeFile(tmp, JSON.stringify(lidCache, null, 2), 'utf8')
      await fs.promises.rename(tmp, lidCachePath)
    } catch (e) {
      console.error('[LID-CACHE] Erro ao persistir lidCache:', e.message)
    }
  }

  if (force) {
    if (lidCacheTimer) clearTimeout(lidCacheTimer)
    persist()
  } else if (!lidCacheTimer) {
    lidCacheTimer = setTimeout(() => {
      lidCacheTimer = null
      persist()
    }, 2000)
  }
}

function getLidCache() {
  return loadLidCache()
}

function setLidCache(pn, lid) {
  const cache = loadLidCache()
  const cleanPn = String(pn).replace(/\D/g, '')
  const cleanLid = String(lid).split('@')[0].split(':')[0]
  if (cleanPn && cleanLid) {
    cache[cleanPn] = cleanLid + '@lid'
    cache[`${cleanPn}@s.whatsapp.net`] = cleanLid + '@lid'
    cache[`lid_${cleanLid}`] = cleanPn
    cache[`${cleanLid}@lid`] = cleanPn
    saveLidCache()
  }
}

function loadSubdonoLids() {
  try {
    return fs.existsSync(subdonoLidsPath) ? JSON.parse(fs.readFileSync(subdonoLidsPath, 'utf8')) : []
  } catch {
    return []
  }
}

function saveSubdonoLids(lids) {
  try {
    const dir = path.dirname(subdonoLidsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(subdonoLidsPath, JSON.stringify(lids, null, 2), 'utf8')
  } catch (e) {
    console.error('[SUBDONO-LID] Erro ao salvar subdonoLids:', e.message)
  }
}

function registrarSubdonoLid(lid) {
  const cleanLid = String(lid).split('@')[0].split(':')[0]
  if (!cleanLid) return
  const lids = loadSubdonoLids()
  const formatted = cleanLid + '@lid'
  if (!lids.includes(formatted) && !lids.includes(cleanLid)) {
    lids.push(formatted)
    saveSubdonoLids(lids)
  }
}

function removerSubdonoLid(lidOrNum) {
  const clean = String(lidOrNum).split('@')[0].split(':')[0].replace(/\D/g, '')
  if (!clean) return
  const lids = loadSubdonoLids()
  const filtrados = lids.filter(l => {
    const c = String(l).split('@')[0].split(':')[0].replace(/\D/g, '')
    return c !== clean
  })
  if (filtrados.length !== lids.length) {
    saveSubdonoLids(filtrados)
  }
}

function normalizeToPN(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  if (isLidUser && isLidUser(trimmed)) return null

  if (jidDecode) {
    const decoded = jidDecode(trimmed)
    if (decoded) {
      const { server, user } = decoded
      if (server === 'g.us' || server === 'broadcast' || server === 'newsletter') return null
      if (server === 's.whatsapp.net' || server === 'c.us') return jidEncode(user, 's.whatsapp.net')
      return null
    }
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7) return null

  return jidEncode ? jidEncode(digits, 's.whatsapp.net') : `${digits}@s.whatsapp.net`
}

async function toLID(input, sock) {
  if (!input) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null

  if (isLidUser && isLidUser(trimmed)) {
    return jidNormalizedUser ? jidNormalizedUser(trimmed) : trimmed
  }
  if (isJidGroup && isJidGroup(trimmed)) return null
  if (isJidStatusBroadcast && isJidStatusBroadcast(trimmed)) return null

  const pn = normalizeToPN(trimmed)
  if (!pn) return null

  const cleanPn = pn.split('@')[0].split(':')[0].replace(/\D/g, '')
  const cache = loadLidCache()

  // 1. Cache em memoria / arquivo
  if (cache[pn]) return cache[pn]
  if (cache[cleanPn]) return cache[cleanPn]

  // 2. Mapeamento de usuários local
  try {
    const { loadMapeamento } = require('../bot/core')
    const map = loadMapeamento()
    if (map && map[cleanPn]?.lid) {
      const lidStr = String(map[cleanPn].lid).split('@')[0].split(':')[0] + '@lid'
      setLidCache(pn, lidStr)
      return lidStr
    }
    if (map && Array.isArray(map[cleanPn]?.lids) && map[cleanPn].lids.length > 0) {
      const lidStr = String(map[cleanPn].lids[0]).split('@')[0].split(':')[0] + '@lid'
      setLidCache(pn, lidStr)
      return lidStr
    }
  } catch {}

  // 3. Signal store local do Baileys
  try {
    if (sock && sock.signalRepository && sock.signalRepository.lidMapping) {
      const fromStore = await sock.signalRepository.lidMapping.getLIDForPN(pn).catch(() => null)
      if (fromStore) {
        const norm = jidNormalizedUser ? jidNormalizedUser(fromStore) : fromStore
        setLidCache(pn, norm)
        atualizarMapeamentoUsuario(cleanPn, norm)
        return norm
      }
    }
  } catch {}

  // 4. USync query direta com LIDProtocol (como no Thanay-bot)
  if (sock && typeof sock.executeUSyncQuery === 'function') {
    try {
      const query = new USyncQuery()
        .withLIDProtocol()
        .withContext('interactive')
        .withUser(new USyncUser().withId(pn))

      const result = await sock.executeUSyncQuery(query)
      const entry = result?.list?.find(r => r.id === pn)
      const lid = entry?.lid
      if (lid) {
        const normalized = jidNormalizedUser ? jidNormalizedUser(lid) : lid
        setLidCache(pn, normalized)
        atualizarMapeamentoUsuario(cleanPn, normalized)
        return normalized
      }
    } catch (err) {
      // Ignora erro silenciosamente
    }
  }

  return null
}

function atualizarMapeamentoUsuario(numeroReal, lidJid) {
  try {
    const { loadMapeamento, saveMapeamento } = require('../bot/core')
    const map = loadMapeamento()
    const lidClean = String(lidJid).split('@')[0].split(':')[0]
    const numClean = String(numeroReal).replace(/\D/g, '')

    if (numClean && lidClean) {
      if (!map[numClean]) {
        map[numClean] = {
          sender: numClean + '@s.whatsapp.net',
          numero: numClean,
          lids: [lidClean],
          lid: lidClean,
          nome: ''
        }
      } else {
        if (!map[numClean].lids) map[numClean].lids = []
        if (!map[numClean].lids.includes(lidClean)) map[numClean].lids.push(lidClean)
        map[numClean].lid = lidClean
      }

      if (!map[lidClean]) {
        map[lidClean] = {
          sender: numClean + '@s.whatsapp.net',
          numero: numClean,
          lid: lidClean,
          nome: ''
        }
      }
      saveMapeamento(true)
    }
  } catch {}
}

async function sincronizarLidsDonoESubdono(sock) {
  console.log('\n[LID-SYNC] 🔍 Buscando e sincronizando LIDs do dono e subdonos via WhatsApp (USync)...')
  let config = {}
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    }
  } catch {}

  let configAlterado = false
  if (!Array.isArray(config.ownerLids)) {
    config.ownerLids = []
  }

  // 1. Donos principais
  const donos = Array.isArray(config.dono) ? config.dono : [config.dono].filter(Boolean)
  for (const d of donos) {
    const dDigits = String(d).replace(/\D/g, '')
    if (dDigits.length >= 7) {
      try {
        const lid = await toLID(dDigits, sock)
        if (lid) {
          const cleanLid = lid.split('@')[0].split(':')[0]
          if (!config.ownerLids.includes(cleanLid) && !config.ownerLids.includes(lid)) {
            config.ownerLids.push(cleanLid)
            configAlterado = true
          }
          console.log(`[LID-SYNC] ✅ Dono identificado: ${dDigits} -> LID: ${lid}`)
        } else {
          console.log(`[LID-SYNC] ℹ️ LID de ${dDigits} ainda não resolvido por USync (será obtido via grupos).`)
        }
      } catch (err) {
        console.warn(`[LID-SYNC] Aviso ao buscar LID para ${dDigits}:`, err.message)
      }
    }
  }

  if (configAlterado) {
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
      console.log('[LID-SYNC] 💾 config.json salvo com novos ownerLids!')
    } catch (e) {
      console.error('[LID-SYNC] Erro ao salvar config.json:', e.message)
    }
  }

  // 2. Subdonos
  try {
    const { loadSubdonos } = require('./baileys')
    const subdonos = loadSubdonos()
    if (Array.isArray(subdonos) && subdonos.length > 0) {
      for (const s of subdonos) {
        const sDigits = String(s).replace(/\D/g, '')
        if (sDigits.length >= 7) {
          try {
            const lid = await toLID(sDigits, sock)
            if (lid) {
              registrarSubdonoLid(lid)
              console.log(`[LID-SYNC] ✅ Subdono identificado: ${sDigits} -> LID: ${lid}`)
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[LID-SYNC] Aviso ao sincronizar subdonos:', err.message)
  }
}

module.exports = {
  toLID,
  normalizeToPN,
  getLidCache,
  setLidCache,
  loadSubdonoLids,
  saveSubdonoLids,
  registrarSubdonoLid,
  removerSubdonoLid,
  sincronizarLidsDonoESubdono,
  atualizarMapeamentoUsuario
}
