const config = require('../../../data/config.json')
const { isOwnerCheck, isSubdonoCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')
const { resolveTargetGroup } = require('../../utils/groupResolver')

function parseTempoMs(str) {
    if (!str) return 30 * 24 * 60 * 60 * 1000
    const s = str.toLowerCase().trim()
    if (s === 'vitalicio' || s === 'permanente' || s === 'perm') return 0

    const match = s.match(/^(\d+)\s*(m|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)?$/i)
    if (!match) return 30 * 24 * 60 * 60 * 1000

    const valor = parseInt(match[1]) || 30
    const unidade = (match[2] || 'd').toLowerCase()

    const MS = 1000, MIN = 60 * MS, HR = 60 * MIN, DIA = 24 * HR
    if (unidade.startsWith('min') || unidade === 'm') return valor * MIN
    if (unidade.startsWith('h')) return valor * HR
    if (unidade.startsWith('d')) return valor * DIA
    if (unidade.startsWith('mes')) return valor * 30 * DIA
    if (unidade.startsWith('a')) return valor * 365 * DIA
    return valor * DIA
}

function getDataMocambique() {
    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (offset * 60000))
}

module.exports = async function (sock, msg, from, sender, text) {
    const prefix = config.prefix
    const parts = text.trim().split(/\s+/)
    const rawCmd = parts[0].toLowerCase()

    const isAumentar = (
        rawCmd === prefix + 'aumentarlimite' ||
        rawCmd === prefix + 'aumentar' ||
        rawCmd === prefix + 'estender' ||
        rawCmd === prefix + 'aumentargp' ||
        rawCmd === prefix + 'estendergp' ||
        rawCmd === prefix + 'renovargp'
    )

    if (!isAumentar) return false

    const isOwner = isOwnerCheck(sender, msg) || isSubdonoCheck(sender)
    if (!isOwner) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ Apenas o Dono e Sub-donos podem aumentar a validade das licenças dos grupos.' }, { quoted: msg })
        return true
    }

    const args = parts.slice(1)
    let grupoInput = ''
    let tempoInput = ''

    if (args.length === 0) {
        await sock.sendMessage(from, {
            text: [
                '⚙️ *COMANDO PARA ESTENDER VALIDADE DO GRUPO:*',
                '────────────────────────',
                `📌 *No grupo:* \`${prefix}aumentarlimite [TEMPO]\``,
                `  _Exemplo:_ \`${prefix}aumentarlimite 30d\``,
                `  _Exemplo:_ \`${prefix}aumentarlimite vitalicio\``,
                '',
                `📌 *No privado:* \`${prefix}aumentarlimite [Nº DO GRUPO] [TEMPO]\``,
                `  _Exemplo:_ \`${prefix}aumentarlimite 2 30d\` _(Usa o número da lista do .grupos)_`,
                '────────────────────────',
                '💡 *Dica:* O tempo novo é **somado** aos dias que o grupo ainda tem restantes!'
            ].join('\n')
        }, { quoted: msg })
        return true
    }

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
                `📌 *Uso no Privado:* \`${prefix}aumentarlimite [Nº DO GRUPO] [TEMPO]\``,
                `💡 *Exemplo:* \`${prefix}aumentarlimite 2 30d\` _(Para o grupo nº 2 da lista do .grupos)_`,
                '',
                `📌 *Uso dentro do Grupo:* \`${prefix}aumentarlimite [TEMPO]\``,
                `💡 *Exemplo:* \`${prefix}aumentarlimite 30d\``
            ].join('\n')
        }, { quoted: msg })
        return true
    }

    const durationMs = parseTempoMs(tempoInput)
    const targetJid = targetGroup.jid
    const groupConfigs = configManager.loadGroupConfig()

    if (!groupConfigs[targetJid]) {
        groupConfigs[targetJid] = {}
    }

    const agoraMz = getDataMocambique().getTime()
    let baseTime = agoraMz

    if (groupConfigs[targetJid].expiraEm && groupConfigs[targetJid].expiraEm > agoraMz) {
        baseTime = groupConfigs[targetJid].expiraEm
    }

    const newExpiresAt = durationMs > 0 ? (baseTime + durationMs) : null
    const tempoDesc = durationMs > 0 ? (tempoInput || '30d') : 'Permanente / Vitalício'

    groupConfigs[targetJid].authorized = true
    groupConfigs[targetJid].duracao = tempoDesc

    if (newExpiresAt) {
        groupConfigs[targetJid].expiraEm = newExpiresAt
    } else {
        delete groupConfigs[targetJid].expiraEm
    }

    delete groupConfigs[targetJid].avisouExpiracao
    delete groupConfigs[targetJid].avisouPreExpiracao5d
    delete groupConfigs[targetJid].avisouPreExpiracao24h

    configManager.saveGroupConfig(true)

    try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}

    const dataFinalStr = newExpiresAt ? new Date(newExpiresAt).toLocaleString('pt-PT') : '♾️ Vitalício (Sem Expiração)'
    const diasRestantes = newExpiresAt ? Math.max(1, Math.ceil((newExpiresAt - agoraMz) / (24 * 3600 * 1000))) : 'Ilimitado'

    if (from !== targetJid) {
        try {
            await sock.sendMessage(targetJid, {
                text: [
                    '🎉 *PERÍODO DE USO ESTENDIDO!*',
                    '────────────────────────',
                    '⚡ A administração estendeu a licença de uso do bot neste grupo.',
                    `➕ *Tempo Adicionado:* ${tempoDesc}`,
                    `📅 *Nova Validade:* ${dataFinalStr}`,
                    `⏳ *Total Restante:* ${diasRestantes} dia(s)`,
                    '────────────────────────',
                    '🚀 O bot continuará 100% ativo e processando pedidos normalmente!'
                ].join('\n')
            })
        } catch {}
    }

    await sock.sendMessage(from, {
        text: [
            '🎉 *LICENÇA DO GRUPO ESTENDIDA COM SUCESSO!*',
            '────────────────────────',
            `👥 *Grupo:* ${targetGroup.name}`,
            `➕ *Tempo Adicionado:* ${tempoDesc}`,
            `📅 *Nova Validade:* ${dataFinalStr}`,
            `⏳ *Total Restante:* ${diasRestantes} dia(s)`,
            '────────────────────────',
            '🚀 O bot continuará ativo e respondendo aos clientes normalmente.'
        ].join('\n')
    }, { quoted: msg })

    return true
}
