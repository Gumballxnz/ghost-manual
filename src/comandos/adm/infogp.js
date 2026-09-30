const config = require('../../../data/config.json')
const { getGroupMetadataCached, isAdmin, isOwnerCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')

module.exports = async (sock, msg, from, sender, text) => {
    const lower = text.toLowerCase().trim()
    if (lower.startsWith(config.prefix + 'infogp') || lower.startsWith(config.prefix + 'infogrupo')) {
        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '❌ Este comando só funciona dentro de grupos.' }, { quoted: msg })
            return true
        }

        const isOwner = isOwnerCheck(sender, msg)
        let adminStatus = false
        try { adminStatus = await isAdmin(sock, from, sender) } catch {}
        if (!isOwner && !adminStatus) {
            return true
        }

        try {
            const metadata = await getGroupMetadataCached(sock, from)
            const groupConfig = configManager.loadGroupConfig()[from] || {}

            const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            const totalMembros = metadata.participants.length
            const totalAdmins = admins.length

            const horaAbrir = groupConfig.horaAbrir ? `🔓 ${groupConfig.horaAbrir}` : 'Nenhum'
            const horaFechar = groupConfig.horaFechar ? `🔒 ${groupConfig.horaFechar}` : 'Nenhum'
            const botDesligado = groupConfig.botDesligado ? '🔴 Desligado' : '🟢 Ativo'

            let infoText = `📊 *INFORMAÇÕES DO GRUPO*\n\n`
            infoText += `🏷️ *Nome:* ${metadata.subject || 'Sem nome'}\n`
            infoText += `🆔 *ID do Grupo:* \`${from}\`\n`
            infoText += `👥 *Total de Membros:* ${totalMembros}\n`
            infoText += `🛡️ *Administradores:* ${totalAdmins}\n`
            infoText += `⚙️ *Status do Bot:* ${botDesligado}\n`
            infoText += `⏰ *Agendamento Abertura:* ${horaAbrir}\n`
            infoText += `⏰ *Agendamento Fechamento:* ${horaFechar}\n\n`
            infoText += `💡 *Dica:* Use o ID acima para clonar nanos, proteções e configurações com os comandos:\n`
            infoText += `• \`.copiarnano ID_DO_GRUPO\`\n`
            infoText += `• \`.copiarnanos ID_DO_GRUPO\`\n`
            infoText += `• \`.copiarprotecoes ID_DO_GRUPO\`\n`
            infoText += `• \`.copiarconfiguracoes ID_DO_GRUPO\``

            let ppUrl = null
            try {
                ppUrl = await sock.profilePictureUrl(from, 'image')
            } catch {}

            if (ppUrl) {
                await sock.sendMessage(from, {
                    image: { url: ppUrl },
                    caption: infoText
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: infoText }, { quoted: msg })
            }

            return true
        } catch (err) {
            console.error('[INFOGP] Erro ao obter informações do grupo:', err.message)
            await sock.sendMessage(from, { text: '❌ Erro ao obter informações do grupo.' }, { quoted: msg })
            return true
        }
    }

    return false
}
