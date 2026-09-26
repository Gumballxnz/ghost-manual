const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isAdmin, isOwnerCheck } = require('../../utils/baileys')
const { getGrupoConfig } = require('../../vendas/gruposConfig')
const configManager = require('../../utils/configManager')

function getDataMocambique() {
    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (offset * 60000))
}

function loadGroupConfig() {
    return configManager.loadGroupConfig()
}

function formatarTempoRestante(ms) {
    if (ms <= 0) return 'Expirado'

    const dias = Math.floor(ms / (24 * 60 * 60 * 1000))
    const horas = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutos = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    const segundos = Math.floor((ms % (60 * 1000)) / 1000)

    if (dias > 0) return `${dias} dia(s) e ${horas}h`
    if (horas > 0) return `${horas}h e ${minutos}min`
    if (minutos > 0) return `${minutos}min e ${segundos}s`
    return `${segundos} segundo(s)`
}

module.exports = async (sock, msg, from, sender, text) => {
    if (text === config.prefix + 'bot') {
        const isGroup = from.endsWith('@g.us')
        const isOwner = isOwnerCheck(sender, msg)

        let adminStatus = false
        if (isGroup) {
            try {
                adminStatus = await isAdmin(sock, from, sender)
            } catch (err) {
                console.error('[.bot] Erro ao verificar admin:', err.message)
            }
        }

        if (isGroup && !adminStatus && !isOwner) {
            return true
        }
        if (!isGroup && !isOwner) {
            return true
        }

        const botTitle = (config.botName || 'GHOST BOT').toUpperCase()
        const linhasCorpo = []

        if (isGroup) {
            const groups = loadGroupConfig()
            const grupoInfo = groups[from] || groups[from.replace(/\./g, '___dot___')] || groups[from.replace(/___dot___/g, '.')] || {}
            const agora = getDataMocambique().getTime()

            let tempoGrupo = ''
            const isGroupAuth = (grupoInfo.authorized === true) || (grupoInfo.authorized !== false)

            if (!isGroupAuth) {
                tempoGrupo = '❌ *Grupo Não Autorizado*'
            } else if (grupoInfo.expiraEm) {
                const restante = grupoInfo.expiraEm - agora
                if (restante > 0) {
                    tempoGrupo = `${formatarTempoRestante(restante)}`
                } else {
                    tempoGrupo = '⚠️ *Tempo Expirado*'
                }
            } else {
                tempoGrupo = '♾️ *Vitalício*'
            }

            linhasCorpo.push(`•.̇𖥨֗👻⭟ 👥 *Aluguel do Grupo:* ${tempoGrupo}`)
            linhasCorpo.push(`•.̇𖥨֗👻⭟ 🤖 *Modo de Vendas:* ⚪ *100% Manual*`)
        } else {
            linhasCorpo.push(`•.̇𖥨֗👻⭟ 👑 *Painel Central do Dono*`)
        }

        linhasCorpo.push('')
        linhasCorpo.push('•.̇𖥨֗👻⭟ 🟢 *Status:* Sistema Operacional')
        linhasCorpo.push('•.̇𖥨֗👻⭟ ⚡ *Atendimento:* Fila Imediata')

        const cardBot = [
            `╭┈⊰ 👻 『 *${botTitle} ONLINE* 』`,
            '┊',
            ...linhasCorpo.map(l => l ? `┊${l}` : '┊'),
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await sock.sendMessage(from, { text: cardBot }, { quoted: msg })
        return true
    }

    return false
}
