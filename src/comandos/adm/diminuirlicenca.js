const config = require('../../../data/config.json')
const { isOwnerCheck, isSubdonoCheck } = require('../../utils/baileys')
const { loadGroupConfig, saveGroupConfig } = require('../../utils/configManager')
const { resolveTargetGroup } = require('../../utils/groupResolver')

function parseTempo(str) {
    if (!str) return null
    const s = str.trim().toLowerCase()
    if (s === '0' || s === 'expirar' || s === 'revogar' || s === 'zerar') return 0
    if (s === 'vitalicio' || s === 'permanente' || s === 'perm') return -1

    const match = s.match(/^(\d+)\s*(s|seg|m|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)?$/i)
    if (!match) return null

    const valor = parseInt(match[1], 10)
    const unidade = (match[2] || 'd').toLowerCase()

    const MS_SEG = 1000
    const MS_MIN = 60 * MS_SEG
    const MS_HORA = 60 * MS_MIN
    const MS_DIA = 24 * MS_HORA

    switch (unidade) {
        case 's':
        case 'seg':
            return valor * MS_SEG
        case 'm':
        case 'min':
        case 'minuto':
        case 'minutos':
            return valor * MS_MIN
        case 'h':
        case 'hora':
        case 'horas':
            return valor * MS_HORA
        case 'd':
        case 'dia':
        case 'dias':
            return valor * MS_DIA
        case 'mes':
        case 'meses':
            return valor * 30 * MS_DIA
        case 'a':
        case 'ano':
        case 'anos':
            return valor * 365 * MS_DIA
        default:
            return valor * MS_DIA
    }
}

function formatarDataExpira(timestamp) {
    if (!timestamp || timestamp <= 0) return 'Vitalício / Permanente'
    const d = new Date(timestamp + (2 * 3600 * 1000))
    const pad = (n) => String(n).padStart(2, '0')
    const dia = pad(d.getUTCDate())
    const mes = pad(d.getUTCMonth() + 1)
    const ano = d.getUTCFullYear()
    const hora = pad(d.getUTCHours())
    const min = pad(d.getUTCMinutes())
    const seg = pad(d.getUTCSeconds())
    return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`
}

const handler = async function (sock, msg, from, sender, text) {
    if (!text || typeof text !== 'string') return false
    const prefix = config.prefix || '.'
    const rawTokens = text.trim().split(/\s+/)
    const rawCmd = (rawTokens[0] || '').toLowerCase()

    const triggers = [
        prefix + 'diminuirlicenca',
        prefix + 'setlicenca',
        prefix + 'reduzirlicenca',
        prefix + 'diminuirgp'
    ]

    if (!triggers.includes(rawCmd)) return false

    const isOwner = isOwnerCheck(sender, msg) || isSubdonoCheck(sender)
    if (!isOwner) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ Apenas o dono do bot pode redefinir a duração de licenças.' }, { quoted: msg })
        return true
    }

    const args = rawTokens.slice(1)

    if (args.length === 0 || (args.length === 1 && (args[0] === 'ajuda' || args[0] === 'help'))) {
        const ajudaMsg = [
            '╭┈❁ *⏳ REDUZIR / REINICIAR VALIDADE DO GRUPO*',
            '┊_Redefine o tempo do grupo a partir de agora sem somar com o saldo anterior._',
            '┊',
            `┊• \`${prefix}diminuirlicenca [Nº DO GRUPO] [TEMPO]\``,
            `┊• \`${prefix}diminuirlicenca 1 5d\` _(define 5 dias para o Grupo 1)_`,
            `┊• \`${prefix}diminuirlicenca 30d\` _(define 30 dias no grupo atual)_`,
            `┊• \`${prefix}diminuirlicenca 1 0\` _(expira imediatamente o Grupo 1)_`,
            `┊• \`${prefix}diminuirlicenca 1 vitalicio\` _(torna o grupo vitalício)_`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await sock.sendMessage(from, { text: ajudaMsg }, { quoted: msg })
        return true
    }

    let grupoInput = ''
    let tempoInput = ''

    if (args.length === 1) {
        if (from.endsWith('@g.us')) {
            grupoInput = from
            tempoInput = args[0]
        } else {
            tempoInput = args[0]
        }
    } else {
        grupoInput = args[0]
        tempoInput = args[1]
    }

    const targetGroup = resolveTargetGroup(grupoInput, from, isOwner)
    if (!targetGroup || !targetGroup.jid) {
        await sock.sendMessage(from, {
            text: [
                '❌ *Grupo não identificado!*',
                '',
                `📌 *Uso no Privado:* \`${prefix}diminuirlicenca [Nº DO GRUPO] [TEMPO]\``,
                `💡 *Exemplo:* \`${prefix}diminuirlicenca 1 5d\` _(Para o grupo nº 1 da lista do .grupos)_`,
                '',
                `📌 *Uso dentro do Grupo:* \`${prefix}diminuirlicenca [TEMPO]\``,
                `💡 *Exemplo:* \`${prefix}diminuirlicenca 5d\``
            ].join('\n')
        }, { quoted: msg })
        return true
    }

    const ms = parseTempo(tempoInput)
    if (ms === null) {
        await sock.sendMessage(from, {
            text: `❌ Formato de tempo inválido: \`${tempoInput}\`\n\nExemplos válidos: \`5d\`, \`24h\`, \`1mes\`, \`vitalicio\`, \`0\` (para expirar).`
        }, { quoted: msg })
        return true
    }

    const targetJid = targetGroup.jid
    const allGroups = loadGroupConfig() || {}
    const cfg = allGroups[targetJid] || allGroups[targetJid.replace(/\./g, '___dot___')] || allGroups[targetJid.replace(/___dot___/g, '.')] || {}

    const agora = Date.now()

    if (ms === 0) {
        cfg.authorized = false
        cfg.expiraEm = agora - 1000
        cfg.duracao = 'Expirado'
    } else if (ms === -1) {
        cfg.authorized = true
        cfg.expiraEm = null
        cfg.duracao = 'Vitalício'
    } else {
        cfg.authorized = true
        cfg.expiraEm = agora + ms
        cfg.duracao = tempoInput
    }

    allGroups[targetJid] = cfg
    saveGroupConfig(allGroups, true)

    try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}

    const novaDataStr = formatarDataExpira(cfg.expiraEm)
    const resp = [
        '╭┈❁ *✅ VALIDADE DO GRUPO REDEFINIDA*',
        `┊👥 *Grupo:* ${targetGroup.name || targetJid}`,
        `┊⏱️ *Nova Duração:* \`${tempoInput}\``,
        `┊📅 *Novo Vencimento:* ${novaDataStr}`,
        `┊🔒 *Status:* ${cfg.authorized ? '🟢 AUTORIZADO' : '🔴 EXPIRADO / BLOQUEADO'}`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    await sock.sendMessage(from, { text: resp }, { quoted: msg })
    return true
}

module.exports = handler
