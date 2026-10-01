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

            let aluguelStatus = 'off'
            let diasRestantes = '0'
            const isGroupAuth = grupoInfo.authorized === true
            if (isGroupAuth) {
                if (grupoInfo.expiraEm) {
                    const restante = grupoInfo.expiraEm - agora
                    if (restante > 0) {
                        aluguelStatus = 'on'
                        const dias = Math.ceil(restante / (24 * 60 * 60 * 1000))
                        diasRestantes = `${dias} dia${dias > 1 ? 's' : ''}`
                    } else {
                        aluguelStatus = 'off'
                        diasRestantes = '0'
                    }
                } else {
                    aluguelStatus = 'on'
                    diasRestantes = 'Vitalício'
                }
            } else {
                aluguelStatus = 'off'
                diasRestantes = '0'
            }

            const botStatus = grupoInfo.botDesligado ? 'off' : 'on'

            linhasCorpo.push(`•.̇𖥨֗👻⭟ 👥 *Aluguel:* ${aluguelStatus}`)
            linhasCorpo.push(`•.̇𖥨֗👻⭟ ⏳ *Dias restantes:* ${diasRestantes}`)
            linhasCorpo.push('')
            linhasCorpo.push(`•.̇𖥨֗👻⭟ 🟢 *Status:* ${botStatus}`)
        } else {
            linhasCorpo.push(`•.̇𖥨֗👻⭟ 👑 *Painel Central do Dono*`)
            linhasCorpo.push(`•.̇𖥨֗👻⭟ 👥 *Aluguel:* on`)
            linhasCorpo.push(`•.̇𖥨֗👻⭟ ⏳ *Dias restantes:* Vitalício`)
            linhasCorpo.push('')
            linhasCorpo.push(`•.̇𖥨֗👻⭟ 🟢 *Status:* on`)
        }

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
