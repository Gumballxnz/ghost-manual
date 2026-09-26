const { sessoesStore } = require('../utils/firebaseDataLayer')

const sessoesCache = new Map()

function normalizarSender(sender) {
    if (!sender) return ''
    return String(sender).split('@')[0].split(':')[0].replace(/\D/g, '')
}

function salvarSessao(sender, dados) {
    if (!sender) return
    const keyRaw = normalizarSender(sender)
    const payload = {
        ...dados,
        senderOriginal: sender,
        timestamp: Date.now()
    }

    const keysToBind = new Set()
    if (keyRaw) keysToBind.add(keyRaw)
    if (dados.from && keyRaw) {
        keysToBind.add(`${dados.from}_${keyRaw}`)
    }
    if (dados.from) {
        keysToBind.add(`${dados.from}_last_pending`)
    }
    if (dados.senderLid) {
        const lidClean = normalizarSender(dados.senderLid)
        if (lidClean) {
            keysToBind.add(lidClean)
            if (dados.from) keysToBind.add(`${dados.from}_${lidClean}`)
        }
    }
    if (dados.senderPn) {
        const pnClean = normalizarSender(dados.senderPn)
        if (pnClean) {
            keysToBind.add(pnClean)
            if (dados.from) keysToBind.add(`${dados.from}_${pnClean}`)
        }
    }

    try {
        const { getSenderCandidateKeys } = require('../utils/baileys')
        const candKeys = getSenderCandidateKeys(sender)
        for (const ck of candKeys) {
            const ckNorm = normalizarSender(ck)
            if (ckNorm) {
                keysToBind.add(ckNorm)
                if (dados.from) keysToBind.add(`${dados.from}_${ckNorm}`)
            }
        }
    } catch {}

    for (const k of keysToBind) {
        sessoesCache.set(k, payload)
    }

    try {
        const sessoes = sessoesStore.loadSync() || {}
        if (keyRaw) sessoes[keyRaw] = payload
        if (dados.from && keyRaw) sessoes[`${dados.from}_${keyRaw}`] = payload
        sessoesStore.save(sessoes)
    } catch {}
}

function getSessao(sender, from, msg) {
    const keyRaw = normalizarSender(sender)
    const keysToCheck = [keyRaw]

    if (from && keyRaw) {
        keysToCheck.push(`${from}_${keyRaw}`)
    }
    if (msg) {
        const part = normalizarSender(msg.key?.participant)
        const partPn = normalizarSender(msg.key?.participantPn)
        if (part) {
            keysToCheck.push(part)
            if (from) keysToCheck.push(`${from}_${part}`)
        }
        if (partPn) {
            keysToCheck.push(partPn)
            if (from) keysToCheck.push(`${from}_${partPn}`)
        }

        const quotedPart = normalizarSender(msg.message?.extendedTextMessage?.contextInfo?.participant)
        if (quotedPart) {
            keysToCheck.push(quotedPart)
            if (from) keysToCheck.push(`${from}_${quotedPart}`)
        }
    }

    try {
        const { getSenderCandidateKeys } = require('../utils/baileys')
        const candKeys = getSenderCandidateKeys(sender)
        for (const ck of candKeys) {
            const ckNorm = normalizarSender(ck)
            if (ckNorm && !keysToCheck.includes(ckNorm)) {
                keysToCheck.push(ckNorm)
                if (from) keysToCheck.push(`${from}_${ckNorm}`)
            }
        }
    } catch {}

    const isReciboValido = (s) => {
        if (!s || !s.codigo) return true
        try {
            const { reciboJaUsado } = require('./recibos')
            return !reciboJaUsado(s.codigo)
        } catch { return true }
    }

    for (const k of keysToCheck) {
        if (k && sessoesCache.has(k)) {
            const sess = sessoesCache.get(k)
            if (sess && (Date.now() - sess.timestamp < 30 * 60 * 1000)) {
                if (!isReciboValido(sess)) {
                    sessoesCache.delete(k)
                    continue
                }
                return sess
            }
        }
    }

    if (from && sessoesCache.has(`${from}_last_pending`)) {
        const lastSess = sessoesCache.get(`${from}_last_pending`)
        if (lastSess && (Date.now() - lastSess.timestamp < 5 * 60 * 1000)) {
            const sessSender = normalizarSender(lastSess.senderOriginal || lastSess.remetente)
            if (!sessSender || keysToCheck.includes(sessSender)) {
                return lastSess
            }
        }
    }

    try {
        const sessoes = sessoesStore.loadSync() || {}
        for (const k of keysToCheck) {
            if (k && sessoes[k]) {
                const sess = sessoes[k]
                if (Date.now() - sess.timestamp < 30 * 60 * 1000) {
                    sessoesCache.set(k, sess)
                    return sess
                }
            }
        }
    } catch {}

    return null
}

function limparSessao(sender, from) {
    const keyRaw = normalizarSender(sender)
    const keysToDelete = new Set()
    if (keyRaw) keysToDelete.add(keyRaw)
    if (from && keyRaw) {
        keysToDelete.add(`${from}_${keyRaw}`)
    }
    if (from) {
        keysToDelete.add(`${from}_last_pending`)
    }

    try {
        const { getSenderCandidateKeys } = require('../utils/baileys')
        const candKeys = getSenderCandidateKeys(sender)
        for (const ck of candKeys) {
            const ckNorm = normalizarSender(ck)
            if (ckNorm) {
                keysToDelete.add(ckNorm)
                if (from) keysToDelete.add(`${from}_${ckNorm}`)
            }
        }
    } catch {}

    for (const k of keysToDelete) {
        sessoesCache.delete(k)
    }

    try {
        const sessoes = sessoesStore.loadSync() || {}
        let mudou = false
        for (const k of keysToDelete) {
            if (sessoes[k]) {
                delete sessoes[k]
                mudou = true
            }
        }
        if (mudou) {
            sessoesStore.save(sessoes)
        }
    } catch {}
}

setInterval(() => {
    const now = Date.now()
    for (const [key, val] of sessoesCache.entries()) {
        if (!val || !val.timestamp || (now - val.timestamp > 30 * 60 * 1000)) {
            sessoesCache.delete(key)
        }
    }
}, 60 * 1000)

const numerosCandidatos = new Map()
const CANDIDATO_TTL_MS = 3 * 60 * 1000

function bufferizarNumeroCandidato(sender, numero, from = null) {
    if (!numero) return
    const key = normalizarSender(sender)
    const payload = { numero, senderOriginal: sender, from, timestamp: Date.now() }

    if (key) {
        numerosCandidatos.set(key, payload)
        if (from) numerosCandidatos.set(`${from}_${key}`, payload)
    }

    try {
        const { getSenderCandidateKeys } = require('../utils/baileys')
        const candKeys = getSenderCandidateKeys(sender)
        for (const ck of candKeys) {
            const ckNorm = normalizarSender(ck)
            if (ckNorm) {
                numerosCandidatos.set(ckNorm, payload)
                if (from) numerosCandidatos.set(`${from}_${ckNorm}`, payload)
            }
        }
    } catch {}

    if (from) {
        numerosCandidatos.set(`${from}_last_candidate`, payload)
    }
}

function consumirNumeroCandidato(sender, from = null) {
    const key = normalizarSender(sender)
    const keysToCheck = []
    if (key) {
        keysToCheck.push(key)
        if (from) keysToCheck.push(`${from}_${key}`)
    }

    try {
        const { getSenderCandidateKeys } = require('../utils/baileys')
        const candKeys = getSenderCandidateKeys(sender)
        for (const ck of candKeys) {
            const ckNorm = normalizarSender(ck)
            if (ckNorm && !keysToCheck.includes(ckNorm)) {
                keysToCheck.push(ckNorm)
                if (from) keysToCheck.push(`${from}_${ckNorm}`)
            }
        }
    } catch {}

    const now = Date.now()
    for (const k of keysToCheck) {
        const entry = numerosCandidatos.get(k)
        if (entry) {
            if (now - entry.timestamp <= CANDIDATO_TTL_MS) {
                for (const dk of keysToCheck) numerosCandidatos.delete(dk)
                if (from) numerosCandidatos.delete(`${from}_last_candidate`)
                return entry.numero
            }
            numerosCandidatos.delete(k)
        }
    }

    if (from) {
        const lastEntry = numerosCandidatos.get(`${from}_last_candidate`)
        if (lastEntry && (now - lastEntry.timestamp <= 60000)) {
            numerosCandidatos.delete(`${from}_last_candidate`)
            return lastEntry.numero
        }
    }

    return null
}

module.exports = {
    salvarSessao,
    getSessao,
    limparSessao,
    bufferizarNumeroCandidato,
    consumirNumeroCandidato
}
