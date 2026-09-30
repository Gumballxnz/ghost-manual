const config = require('../../../data/config.json')
const { isOwnerCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

module.exports = async (sock, msg, from, sender, text) => {

    if (text !== config.prefix + 'av' && !text.startsWith(config.prefix + 'av ')) {
        return false
    }

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const messageContent = msg.message || {}

    if (!isOwnerCheck(sender, msg)) {
        await sock.sendMessage(from, { text: '❌ Apenas o *dono* do bot pode usar este comando.' }, { quoted: msg })
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    const gruposAtivos = []

    for (const [groupId, info] of Object.entries(groupConfig)) {
        if (!groupId.endsWith('@g.us')) continue
        if (!info.authorized) continue

        if (info.expiraEm) {
            const now = new Date()
            const offset = 2 * 60
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
            const agoraMocambique = utc + (offset * 60000)
            if (agoraMocambique >= info.expiraEm) continue
        }

        gruposAtivos.push(groupId)
    }

    if (gruposAtivos.length === 0) {
        await sock.sendMessage(from, { text: '❌ Nenhum grupo autorizado encontrado.' }, { quoted: msg })
        return true
    }

    let payload = null

    const quotedMsg = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage

    if (quotedMsg) {
        if (quotedMsg.conversation) {
            payload = { text: quotedMsg.conversation }
        } else if (quotedMsg.extendedTextMessage?.text) {
            payload = { text: quotedMsg.extendedTextMessage.text }
        } else if (quotedMsg.imageMessage) {
            try {
                const buffer = await downloadMediaMessage(
                    { message: { imageMessage: quotedMsg.imageMessage } }, 'buffer', {}
                )
                payload = { image: buffer, caption: quotedMsg.imageMessage.caption || '' }
            } catch (e) { console.log('[AV] Erro ao baixar imagem:', e.message) }
        } else if (quotedMsg.videoMessage) {
            try {
                const buffer = await downloadMediaMessage(
                    { message: { videoMessage: quotedMsg.videoMessage } }, 'buffer', {}
                )
                payload = { video: buffer, caption: quotedMsg.videoMessage.caption || '' }
            } catch (e) { console.log('[AV] Erro ao baixar vídeo:', e.message) }
        } else if (quotedMsg.audioMessage) {
            try {
                const buffer = await downloadMediaMessage(
                    { message: { audioMessage: quotedMsg.audioMessage } }, 'buffer', {}
                )
                payload = {
                    audio: buffer,
                    mimetype: quotedMsg.audioMessage.mimetype || 'audio/mp4',
                    ptt: quotedMsg.audioMessage.ptt || false
                }
            } catch (e) { console.log('[AV] Erro ao baixar áudio:', e.message) }
        } else if (quotedMsg.documentMessage) {
            try {
                const buffer = await downloadMediaMessage(
                    { message: { documentMessage: quotedMsg.documentMessage } }, 'buffer', {}
                )
                payload = {
                    document: buffer,
                    mimetype: quotedMsg.documentMessage.mimetype || 'application/octet-stream',
                    fileName: quotedMsg.documentMessage.fileName || 'documento'
                }
            } catch (e) { console.log('[AV] Erro ao baixar documento:', e.message) }
        } else if (quotedMsg.stickerMessage) {
            try {
                const buffer = await downloadMediaMessage(
                    { message: { stickerMessage: quotedMsg.stickerMessage } }, 'buffer', {}
                )
                payload = { sticker: buffer }
            } catch (e) { console.log('[AV] Erro ao baixar sticker:', e.message) }
        }
    }

    if (!payload) {
        const textoDirecto = body.replace(/^\.av\s*/i, '').trim()
        if (textoDirecto) {
            payload = { text: textoDirecto }
        }
    }

    if (!payload) {
        await sock.sendMessage(from, {
            text: `📢 *COMANDO .av — Aviso Global*\n\n` +
                `Envia uma mensagem para *todos os grupos* autorizados.\n\n` +
                `*Como usar:*\n` +
                `• \`.av Sua mensagem aqui\` — envia texto direto\n` +
                `• Marque uma mensagem e responda com \`.av\` — reenvia (texto, foto, vídeo, áudio, documento, sticker)\n\n` +
                `📊 Grupos ativos: *${gruposAtivos.length}*`
        }, { quoted: msg })
        return true
    }

    await sock.sendMessage(from, {
        text: `📡 *Enviando comunicado para ${gruposAtivos.length} grupo(s)...*\n⏳ Aguarde...`
    }, { quoted: msg })

    let enviados = 0
    let falhas = 0
    const erros = []

    for (const groupId of gruposAtivos) {
        try {
            if (enviados > 0) {
                await new Promise(r => setTimeout(r, 1500))
            }
            await sock.sendMessage(groupId, payload)
            enviados++
        } catch (err) {
            falhas++
            erros.push(`${groupId.split('@')[0]}: ${err.message?.substring(0, 50)}`)
            console.log(`[AV] Falha ao enviar para ${groupId}: ${err.message}`)
        }
    }

    let relatorio = `✅ *Comunicado enviado!*\n\n`
    relatorio += `📊 *Resultado:*\n`
    relatorio += `• Enviados: *${enviados}/${gruposAtivos.length}*\n`
    if (falhas > 0) {
        relatorio += `• Falhas: *${falhas}*\n`
        relatorio += `\n⚠️ Erros:\n${erros.slice(0, 5).join('\n')}`
    }

    await sock.sendMessage(from, { text: relatorio })
    return true
}
