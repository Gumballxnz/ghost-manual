const configManager = require('../utils/configManager')
const { isAdmin, isOwnerCheck, getSender, getGroupMetadataCached } = require('../utils/baileys')

const REGEX_STATUS_MENTION = /(?:estado\s+de|status\s+(?:from|de))[\s\S]*?(?:este\s+grupo\s+foi\s+mencionado|this\s+group\s+was\s+mentioned|se\s+mencion[oó]\s+a\s+este\s+grupo|grupo\s+mencionado|mencionou\s+este\s+grupo|mentioned\s+in\s+(?:a\s+)?status)/i

async function antistatus(sock, msg) {
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

    if (!configGrupo.antistatus && !configGrupo.antiStatus && !configGrupo.antimensao) {
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

    let msgContent = msg.message
    if (msgContent?.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message
    if (msgContent?.viewOnceMessageV2) msgContent = msgContent.viewOnceMessageV2.message
    if (msgContent?.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message
    if (msgContent?.documentWithCaptionMessage) msgContent = msgContent.documentWithCaptionMessage.message

    if (!msgContent) return false

    const textPieces = [
        msgContent?.conversation,
        msgContent?.extendedTextMessage?.text,
        msgContent?.imageMessage?.caption,
        msgContent?.videoMessage?.caption,
        msgContent?.interactiveMessage?.body?.text
    ].filter(Boolean).join('\n')

    const contextInfo = msgContent?.extendedTextMessage?.contextInfo
                     || msgContent?.imageMessage?.contextInfo
                     || msgContent?.videoMessage?.contextInfo
                     || msgContent?.interactiveMessage?.contextInfo
                     || {}

    const isStatusByText = REGEX_STATUS_MENTION.test(textPieces) ||
        ((textPieces.includes('Estado de') || textPieces.toLowerCase().includes('status de') || textPieces.toLowerCase().includes('status from')) &&
         (textPieces.includes('Este grupo foi mencionado') || textPieces.toLowerCase().includes('mentioned you') || textPieces.toLowerCase().includes('se mencionó a este grupo') || textPieces.toLowerCase().includes('mencionado')))

    const isStatusByProto = !!contextInfo.isMentionedInStatus
        || !!msgContent?.statusMentionMessage
        || !!msgContent?.groupStatusMentionMessage
        || (Array.isArray(contextInfo.statusMentions) && contextInfo.statusMentions.length > 0)
        || (Array.isArray(contextInfo.groupMentions) && contextInfo.groupMentions.length > 0 && (textPieces.toLowerCase().includes('estado') || textPieces.toLowerCase().includes('status')))
        || (msgContent?.protocolMessage && msgContent.protocolMessage.type === 'STATUS_SELECTION')
        || !!contextInfo.statusMentionMessageInfo
        || contextInfo.remoteJid === 'status@broadcast'
        || (contextInfo.participant === 'status@broadcast' && contextInfo.isForwarded)
        || (contextInfo.isForwarded && (textPieces.toLowerCase().includes('mencionado') || textPieces.toLowerCase().includes('mentioned')))

    const isStatusMention = isStatusByText || isStatusByProto

    if (isStatusMention) {
        const senderNum = sender.split('@')[0].split(':')[0]
        console.log(`[ANTI-STATUS] 🚫 Menção em Status detectada de ${senderNum} no grupo ${from}! Executando exclusão e ban...`)

        try {
            const deleteKey = {
                remoteJid: from,
                fromMe: false,
                id: msg.key.id,
                participant: msg.key.participant || sender
            }
            await sock.sendMessage(from, { delete: deleteKey })
        } catch {
            try { await sock.sendMessage(from, { delete: msg.key }) } catch {}
        }

        let targetJidToBan = msg.key.participant || sender
        try {
            const groupMeta = await getGroupMetadataCached(sock, from)
            if (groupMeta && groupMeta.participants) {
                const found = groupMeta.participants.find(p => {
                    const pBase = (p.id || '').split(':')[0].split('@')[0]
                    const pLidBase = (p.lid || '').split(':')[0].split('@')[0]
                    return pBase === senderNum || pLidBase === senderNum || p.id === sender || p.lid === sender
                })
                if (found) targetJidToBan = found.id
            }
        } catch {}

        try {
            await sock.groupParticipantsUpdate(from, [targetJidToBan], 'remove')
            await sock.sendMessage(from, {
                text: `🚫 *ANTI-STATUS / MENÇÃO PROIBIDA!*\n\n👤 O usuário @${senderNum} foi banido por marcar o grupo no status.\n\n🔒 _Segurança do grupo ativada._`,
                mentions: [sender, targetJidToBan]
            })
        } catch (err) {
            console.error('[Anti-Status] Erro ao remover infrator com target principal:', err.message)
            if (targetJidToBan !== sender) {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], 'remove')
                    await sock.sendMessage(from, {
                        text: `🚫 *ANTI-STATUS / MENÇÃO PROIBIDA!*\n\n👤 O usuário @${senderNum} foi banido por marcar o grupo no status.\n\n🔒 _Segurança do grupo ativada._`,
                        mentions: [sender]
                    })
                    return true
                } catch (fallbackErr) {
                    console.error('[Anti-Status] Falha no banimento fallback:', fallbackErr.message)
                }
            }
            await sock.sendMessage(from, {
                text: `⚠️ *Detectei menção em status de @${senderNum}!* Mas não consegui remover o usuário. (Verifique se o bot é Administrador do grupo).`,
                mentions: [sender]
            })
        }

        return true
    }

    return false
}

module.exports = antistatus
