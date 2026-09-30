const configManager = require('../utils/configManager')
const { isOwnerCheck, isLeaderCheck, getGroupMetadataCached } = require('../utils/baileys')

const LISTA_PAISES = [
    { prefix: '258', nome: '🇲🇿 Moçambique', ddi: '258', minLen: 9, maxLen: 12 },
    { prefix: '55',  nome: '🇧🇷 Brasil',      ddi: '55',  minLen: 12, maxLen: 13 },
    { prefix: '244', nome: '🇦🇴 Angola',      ddi: '244', minLen: 12, maxLen: 12 },
    { prefix: '351', nome: '🇵🇹 Portugal',    ddi: '351', minLen: 12, maxLen: 12 },
    { prefix: '1',   nome: '🇺🇸 EUA / Canadá', ddi: '1',   minLen: 11, maxLen: 11 },
    { prefix: '27',  nome: '🇿🇦 África do Sul', ddi: '27', minLen: 11, maxLen: 11 },
    { prefix: '234', nome: '🇳🇬 Nigéria',     ddi: '234', minLen: 13, maxLen: 14 },
    { prefix: '44',  nome: '🇬🇧 Reino Unido', ddi: '44',  minLen: 12, maxLen: 12 },
    { prefix: '91',  nome: '🇮🇳 Índia',       ddi: '91',  minLen: 12, maxLen: 12 },
    { prefix: '92',  nome: '🇵🇰 Paquistão',   ddi: '92',  minLen: 12, maxLen: 12 },
    { prefix: '263', nome: '🇿🇼 Zimbábue',   ddi: '263', minLen: 12, maxLen: 12 },
    { prefix: '260', nome: '🇿🇲 Zâmbia',      ddi: '260', minLen: 12, maxLen: 12 },
    { prefix: '255', nome: '🇹🇿 Tanzânia',    ddi: '255', minLen: 12, maxLen: 12 }
]

function identificarPaisPorNumero(numStr) {
    if (!numStr) return { ddi: '??', nome: 'Desconhecido', isMoz: false, isValido: false }
    const clean = String(numStr).replace(/\D/g, '')

    if (clean.length > 13 || clean.length < 9) {
        return { ddi: '??', nome: 'ID Inválido', isMoz: false, isValido: false }
    }

    if (clean.startsWith('258') && (clean.length === 11 || clean.length === 12)) {
        return { ddi: '258', nome: '🇲🇿 Moçambique', isMoz: true, isValido: true }
    }
    if (clean.length === 9 && /^[8][2-7]/.test(clean)) {
        return { ddi: '258', nome: '🇲🇿 Moçambique', isMoz: true, isValido: true }
    }

    for (const p of LISTA_PAISES) {
        if (p.prefix === '258') continue
        if (clean.startsWith(p.prefix) && clean.length >= p.minLen && clean.length <= p.maxLen) {
            return { ddi: p.ddi, nome: p.nome, isMoz: false, isValido: true }
        }
    }

    if (clean.length >= 10 && clean.length <= 13) {
        const ddiGen = clean.slice(0, 2)
        return { ddi: ddiGen, nome: `🌍 Estrangeiro (+${ddiGen})`, isMoz: false, isValido: true }
    }

    return { ddi: '??', nome: 'ID Inválido', isMoz: false, isValido: false }
}

function extrairNumeroReal(participant) {
    if (!participant) return null

    if (typeof participant === 'string') {
        if (participant.endsWith('@s.whatsapp.net')) {
            const num = participant.split('@')[0].split(':')[0].replace(/\D/g, '')
            if (num && num.length >= 8 && num.length <= 13) return num
        }
        if (participant.includes('@lid')) {
            try {
                const { buscarNumero } = require('../bot/core')
                const rawId = participant.split('@')[0].split(':')[0]
                const resolvido = buscarNumero(rawId)
                if (resolvido && resolvido !== rawId && !resolvido.includes('@lid')) {
                    const clean = String(resolvido).split('@')[0].split(':')[0].replace(/\D/g, '')
                    if (clean && clean.length >= 8 && clean.length <= 13) return clean
                }
            } catch {}
            return null
        }
        const clean = participant.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (clean && clean.length >= 8 && clean.length <= 13) return clean
        return null
    }

    const id = participant.id || ''
    const pn = participant.pn || participant.phoneNumber || participant.phone || ''
    const lid = participant.lid || ''

    if (pn && typeof pn === 'string' && !pn.includes('@lid')) {
        const cleanPn = pn.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (cleanPn && cleanPn.length >= 8 && cleanPn.length <= 13) return cleanPn
    }

    if (id && id.endsWith('@s.whatsapp.net')) {
        const num = id.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (num && num.length >= 8 && num.length <= 13) return num
    }

    try {
        const { buscarNumero } = require('../bot/core')
        const rawId = (id || lid || '').split('@')[0].split(':')[0]
        if (rawId) {
            const resolvido = buscarNumero(rawId)
            if (resolvido && resolvido !== rawId && !resolvido.includes('@lid')) {
                const clean = String(resolvido).split('@')[0].split(':')[0].replace(/\D/g, '')
                if (clean && clean.length >= 8 && clean.length <= 13) return clean
            }
        }
    } catch {}

    return null
}

async function antigringoAtivo(sock, update) {
    if (update.action !== 'add') return

    const { id: groupId, participants } = update
    if (!groupId || !groupId.endsWith('@g.us')) return

    const groupConfig = configManager.loadGroupConfig()
    const dotGid = groupId.replace(/\./g, '___dot___')
    const gInfo = groupConfig[groupId] || groupConfig[dotGid] || {}

    if (gInfo?.antigringo !== true) return

    const allowedDdis = gInfo.ddisPermitidos && Array.isArray(gInfo.ddisPermitidos) && gInfo.ddisPermitidos.length > 0
        ? gInfo.ddisPermitidos
        : ['258']

    let metadata = null
    try {
        const { mapearGrupo } = require('../bot/core')
        await mapearGrupo(sock, groupId)
        metadata = await getGroupMetadataCached(sock, groupId)
    } catch {}

    const botJid = sock.user?.id || ''
    const botNumber = botJid.split(':')[0].split('@')[0].replace(/\D/g, '')
    const botLid = sock.user?.lid ? sock.user.lid.split(':')[0].split('@')[0].replace(/\D/g, '') : ''

    for (const participant of participants) {
        let numReal = extrairNumeroReal(participant)

        if (!numReal && metadata && Array.isArray(metadata.participants)) {
            const rawP = (participant || '').split('@')[0].split(':')[0]
            const found = metadata.participants.find(p =>
                (p.id && (p.id === participant || p.id.split('@')[0].split(':')[0] === rawP)) ||
                (p.lid && (p.lid === participant || p.lid.split('@')[0].split(':')[0] === rawP))
            )
            if (found) {
                numReal = extrairNumeroReal(found)
            }
        }

        if (!numReal) continue

        if (numReal === botNumber || numReal === botLid || (botNumber && String(participant).includes(botNumber)) || (botLid && String(participant).includes(botLid))) {
            continue
        }

        if (isLeaderCheck(participant) || isOwnerCheck(participant) || isLeaderCheck(numReal) || isOwnerCheck(numReal)) {
            continue
        }

        const infoPais = identificarPaisPorNumero(numReal)
        if (!infoPais.isValido) continue

        const isPermitido = infoPais.isMoz || allowedDdis.includes(infoPais.ddi) || allowedDdis.some(ddi => numReal.startsWith(ddi))

        if (!isPermitido) {
            try {
                await sock.sendMessage(groupId, {
                    text: `🛡️ *ANTI-GRINGO ATIVADO*\n\n🚫 O usuário @${numReal} (${infoPais.nome}) possui um número estrangeiro não autorizado neste grupo e foi removido automaticamente.`,
                    mentions: [participant, `${numReal}@s.whatsapp.net`]
                })

                setTimeout(async () => {
                    try {
                        await sock.groupParticipantsUpdate(groupId, [participant], 'remove')
                        console.log(`[ANTIGRINGO] Estrangeiro ${numReal} (${infoPais.nome}) removido do grupo ${groupId}`)
                    } catch (banErr) {
                        try {
                            await sock.groupParticipantsUpdate(groupId, [`${numReal}@s.whatsapp.net`], 'remove')
                        } catch (banErr2) {
                            console.error('[ANTIGRINGO] Erro ao banir:', banErr2.message)
                        }
                    }
                }, 600)
            } catch (err) {
                console.error('[ANTIGRINGO] Erro ao enviar aviso:', err.message)
            }
        }
    }
}

module.exports = antigringoAtivo
