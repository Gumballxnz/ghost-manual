const fs = require('fs')
const path = require('path')
const { getSender, getCargo } = require('../../utils/baileys.js')
const { getClienteStats } = require('../../vendas/tracker.js')

const ATIVIDADE_PATH = path.join(__dirname, '../../../data/atividade.json')

function getAtividade() {
    try {
        if (!fs.existsSync(ATIVIDADE_PATH)) return {}
        return JSON.parse(fs.readFileSync(ATIVIDADE_PATH, 'utf8'))
    } catch {
        return {}
    }
}

module.exports = async (sock, msg, from, sender, text) => {
    if (text.startsWith('.perfil')) {
        let messageContent = msg.message
        if (messageContent?.viewOnceMessage) messageContent = messageContent.viewOnceMessage.message
        if (messageContent?.viewOnceMessageV2) messageContent = messageContent.viewOnceMessageV2.message
        if (messageContent?.ephemeralMessage) messageContent = messageContent.ephemeralMessage.message

        const ctx = messageContent?.extendedTextMessage?.contextInfo
          || messageContent?.imageMessage?.contextInfo
          || messageContent?.videoMessage?.contextInfo
          || msg.message?.extendedTextMessage?.contextInfo

        const mentions = ctx?.mentionedJid || []
        const quotedParticipant = ctx?.participant || ctx?.key?.participant
        let targetId = mentions[0] || quotedParticipant || sender

        const { resolverParticipanteGrupo } = require('../../utils/baileys.js')
        if (targetId.includes('@lid') && from.endsWith('@g.us')) {
            targetId = await resolverParticipanteGrupo(sock, from, targetId)
        }

        const senderId = targetId

        let ppUrl
        try {
            ppUrl = await sock.profilePictureUrl(senderId, 'image')
        } catch {
            ppUrl = null
        }

        const cargo = await getCargo(sock, from, senderId)

        const atividade = getAtividade()
        const userAtiv = atividade[from]?.[senderId]
        const mensagens = userAtiv?.msgs || 0

        const stats = getClienteStats(from, senderId)
        const compras = stats?.compras || 0
        const totalMB = stats?.totalFormatado || '0 MB'
        const posicao = stats?.posicao || '-'
        const comprasHoje = stats?.comprasHoje || 0
        const totalSaldo = stats?.totalSaldo || 0

        let resposta = `👤 *Perfil de @${senderId.split('@')[0]}*\n\n`
        resposta += `📌 *Cargo:* ${cargo}\n`
        resposta += `💬 *Mensagens:* ${mensagens}\n`

        if (compras > 0) {
            resposta += `\n📊 *Compras:*\n`
            resposta += `│ Total: ${compras} compra(s)\n`
            resposta += `│ Hoje: ${comprasHoje}\n`
            if ((stats?.totalMB || 0) > 0 || totalSaldo === 0) {
                resposta += `│ Dados: ${totalMB}\n`
            }
            if (totalSaldo > 0) {
                resposta += `│ Saldo: ${totalSaldo}MT\n`
            }
            resposta += `│ Ranking: #${posicao}\n`
        }

        if (ppUrl) {
            await sock.sendMessage(from, {
                image: { url: ppUrl },
                caption: resposta,
                mentions: [senderId]
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                text: resposta,
                mentions: [senderId]
            }, { quoted: msg })
        }

        return true
    }

    return false
}
