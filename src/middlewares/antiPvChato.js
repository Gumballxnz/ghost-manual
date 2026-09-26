const path = require('path')
const { buscarEntregaPendente, listarEntregasPendentes } = require('../bot/entregasPendentes')
const configManager = require('../utils/configManager')

const pvBuffers = {}

module.exports = async (sock, msg) => {
    try {
        const from = msg.key.remoteJid

        if (!from || from.endsWith('@g.us') || from === 'status@broadcast' || msg.key.fromMe) return

        const { getSender } = require('../utils/baileys')
        const sender = getSender(msg)
        const userNum = sender.split('@')[0].split(':')[0]

        let pendente = buscarEntregaPendente(userNum) || buscarEntregaPendente(userNum.startsWith('258') ? userNum.substring(3) : '258' + userNum)

        if (!pendente) {
            const todas = listarEntregasPendentes()
            for (const [k, v] of Object.entries(todas)) {
                if (v && (v.buyerSender === sender || v.num === userNum || k.includes(userNum))) {
                    pendente = v
                    break
                }
            }
        }

        if (!pendente || !pendente.groupId) return

        const targetGroup = pendente.groupId

        const groupConfigs = configManager.loadGroupConfig()
        const gCfg = groupConfigs[targetGroup]
        if (!gCfg || !gCfg.authorized || gCfg.botDesligado) return

        if (!msg.message) return
        const messageType = Object.keys(msg.message)[0]
        let itemInfo = {
            type: messageType,
            msgRaw: msg,
            text: ''
        }

        if (messageType === 'conversation') {
            itemInfo.text = msg.message.conversation
        } else if (messageType === 'extendedTextMessage') {
            itemInfo.text = msg.message.extendedTextMessage?.text || ''
        } else if (messageType === 'imageMessage') {
            itemInfo.text = `🖼️ [Foto] ${msg.message.imageMessage?.caption || ''}`.trim()
        } else if (messageType === 'videoMessage') {
            itemInfo.text = `🎥 [Vídeo] ${msg.message.videoMessage?.caption || ''}`.trim()
        } else if (messageType === 'audioMessage') {
            itemInfo.text = `🎙️ [Áudio/Voz]`
        } else if (messageType === 'documentMessage') {
            itemInfo.text = `📄 [Documento] ${msg.message.documentMessage?.fileName || ''}`.trim()
        } else if (messageType === 'stickerMessage') {
            itemInfo.text = `🎨 [Figurinha]`
        } else {
            itemInfo.text = `💬 [Mensagem]`
        }

        if (!pvBuffers[userNum]) {
            pvBuffers[userNum] = {
                groupId: targetGroup,
                sender: sender,
                userNum: userNum,
                messages: [itemInfo],
                timer: setTimeout(async () => {
                    await dispararRelatorioGrupo(sock, userNum)
                }, 5 * 60 * 1000)
            }
            console.log(`[ANTI-PV CHATO] ⏳ Janela de 5 min iniciada para o usuário ${userNum}`)
        } else {

            pvBuffers[userNum].messages.push(itemInfo)
            console.log(`[ANTI-PV CHATO] 📩 Mensagem acumulada (${pvBuffers[userNum].messages.length}) para ${userNum}`)
        }
    } catch (err) {
        console.error('[ANTI-PV CHATO] Erro no middleware:', err)
    }
}

async function dispararRelatorioGrupo(sock, userNum) {
    const data = pvBuffers[userNum]
    if (!data) return

    delete pvBuffers[userNum]

    try {
        const { groupId, sender, messages } = data
        const userTag = '@' + userNum

        let relatorio = `⚠️ *AVISO DE INVASÃO DE PRIVADO!*\n\n`
        relatorio += `👤 *Usuário:* ${userTag}\n`
        relatorio += `📌 *Status:* Comprovante/Compra Pendente no Grupo\n`
        relatorio += `💬 *O usuário enviou as seguintes mensagens no meu privado nos últimos 5 minutos:*\n\n`

        messages.forEach((m, idx) => {
            relatorio += `${idx + 1}️⃣ ${m.text}\n`
        })

        await sock.sendMessage(groupId, {
            text: relatorio,
            mentions: [sender]
        })

        for (const item of messages) {
            const t = item.type
            if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(t)) {
                try {
                    await sock.sendMessage(groupId, { forward: item.msgRaw }, { quoted: null })
                    await new Promise(r => setTimeout(r, 1000))
                } catch (errFwd) {
                    console.error(`[ANTI-PV CHATO] Erro ao encaminhar mídia (${t}):`, errFwd.message)
                }
            }
        }
    } catch (err) {
        console.error('[ANTI-PV CHATO] Erro ao enviar relatório no grupo:', err)
    }
}
