const configManager = require('../utils/configManager')
const { isAdmin, isOwnerCheck, getSender, getGroupMetadataCached } = require('../utils/baileys')

const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/(?:channel|invite)\/[^\s]+|t\.me\/[^\s]+|telegram\.me\/[^\s]+|tinyurl\.com\/[^\s]+|bit\.ly\/[^\s]+|\b[a-zA-Z0-9-]+\.(com|org|net|mz|xyz|online|site|info|shop|store|app|co|io|me|link|top|cc|tv|club|tech|pro|vip)[^\s]*)/gi

async function antilink(sock, msg) {
    const from = msg.key?.remoteJid
    if (!from || !from.endsWith('@g.us')) return false

    if (msg.key?.fromMe) return false

    const groupConfig = configManager.loadGroupConfig()
    const configGrupo = groupConfig[from] || groupConfig[from.replace(/\./g, '___dot___')] || groupConfig[from.replace(/___dot___/g, '.')] || {}

    const { getDataMocambique } = require('../utils/timezone')
    const agoraMz = getDataMocambique().getTime()

    if (configGrupo.expiraEm && agoraMz >= configGrupo.expiraEm) {
        return false
    }
    if (configGrupo.authorized === false) {
        return false
    }

    const isAuthorized = (configGrupo.authorized === true) && (!configGrupo.expiraEm || agoraMz < configGrupo.expiraEm)

    if (!isAuthorized) {
        return false
    }

    if (!configGrupo.antilink && !configGrupo.antiLink) {
        return false
    }

    const sender = getSender(msg)
    if (!sender) return false

    if (isOwnerCheck(sender, msg)) return false

    try {
        const isAdminUser = await isAdmin(sock, from, sender)
        if (isAdminUser) return false
    } catch {
        return false
    }

    let messageContent = msg.message
    if (messageContent?.viewOnceMessage) messageContent = messageContent.viewOnceMessage.message
    if (messageContent?.viewOnceMessageV2) messageContent = messageContent.viewOnceMessageV2.message
    if (messageContent?.ephemeralMessage) messageContent = messageContent.ephemeralMessage.message
    if (messageContent?.documentWithCaptionMessage) messageContent = messageContent.documentWithCaptionMessage.message

    let isNativeGroupInvite = !!(messageContent?.groupInviteMessage || messageContent?.newsletterAdminInviteMessage)

    const textPieces = [
        messageContent?.conversation,
        messageContent?.extendedTextMessage?.text,
        messageContent?.extendedTextMessage?.matchedText,
        messageContent?.extendedTextMessage?.canonicalUrl,
        messageContent?.extendedTextMessage?.description,
        messageContent?.extendedTextMessage?.title,
        messageContent?.imageMessage?.caption,
        messageContent?.videoMessage?.caption,
        messageContent?.documentMessage?.caption,
        messageContent?.templateMessage?.hydratedTemplate?.hydratedContentText,
        messageContent?.templateMessage?.hydratedFourRowTemplate?.hydratedContentText,
        messageContent?.interactiveMessage?.body?.text,
        messageContent?.interactiveMessage?.header?.title,
        messageContent?.groupInviteMessage?.caption,
        messageContent?.groupInviteMessage?.inviteCode ? `https://chat.whatsapp.com/${messageContent.groupInviteMessage.inviteCode}` : ''
    ].filter(Boolean).join(' ')

    const hasLink = isNativeGroupInvite || LINK_REGEX.test(textPieces)

    if (hasLink) {
        const senderNum = sender.split('@')[0].split(':')[0]
        console.log(`[ANTILINK] 🚫 Link detectado de ${senderNum} no grupo ${from}! Executando remoção e exclusão...`)

        try {
            const deleteKey = {
                remoteJid: from,
                fromMe: false,
                id: msg.key.id,
                participant: msg.key.participant || sender
            }
            await sock.sendMessage(from, { delete: deleteKey })
        } catch (e) {
            try { await sock.sendMessage(from, { delete: msg.key }) } catch {}
        }

        let targetJidToBan = msg.key.participant || sender
        try {
            const groupMeta = await getGroupMetadataCached(sock, from)
            if (groupMeta && groupMeta.participants) {
                const found = groupMeta.participants.find(p => {
                    const pBase = (p.id || '').split(':')[0].split('@')[0]
                    const pLidBase = (p.lid || '').split(':')[0].split('@')[0]
                    return pBase === senderNum || pLidBase === senderNum
                })
                if (found) targetJidToBan = found.id
            }
        } catch {}

        try {
            await sock.groupParticipantsUpdate(from, [targetJidToBan], 'remove')
            await sock.sendMessage(from, {
                text: `🚫 *LINK NÃO AUTORIZADO DETECTADO!*\n\n👤 O usuário @${senderNum} enviou um link e foi removido do grupo.\n\n🔒 _Sistema Anti-Link Ativo._`,
                mentions: [sender, targetJidToBan]
            })
        } catch (err) {
            console.error('[ANTILINK] Erro ao remover infrator:', err.message)
            await sock.sendMessage(from, {
                text: `⚠️ *Detectei um Link de @${senderNum}!* Mas não consegui remover o usuário. (Verifique se o bot é Administrador do grupo)`,
                mentions: [sender]
            })
        }

        return true
    }

    return false
}

module.exports = antilink
