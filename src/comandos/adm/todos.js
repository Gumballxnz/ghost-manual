const path = require('path')
const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys')

module.exports = async (sock, msg, from, sender, text) => {

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''

    if (text.startsWith(config.prefix + 'todos') || text.startsWith(config.prefix + 'marcar-todos')) {

        const isOwner = isOwnerCheck(sender, msg)

        let isGroupAdmin = false
        if (!isOwner && from.endsWith('@g.us')) {
            try {
                isGroupAdmin = await checkIsAdmin(sock, from, sender)
            } catch { }
        }

        if (!isGroupAdmin && !isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
            return true
        }

        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos.' }, { quoted: msg })
            return true
        }

        const cmdMatched = text.startsWith(config.prefix + 'marcar-todos') ? (config.prefix + 'marcar-todos') : (config.prefix + 'todos')
        const mensagem = body.slice(cmdMatched.length).trim()

        if (!mensagem) {
            await sock.sendMessage(from, { text: '❌ Informe a mensagem!\n\nExemplo: .todos Boa noite a todos!' }, { quoted: msg })
            return true
        }

        try {

            const { getGroupMetadataCached } = require('../../utils/baileys')
            const metadata = await getGroupMetadataCached(sock, from) || await sock.groupMetadata(from).catch(() => null)
            if (!metadata || !metadata.participants) {
                await sock.sendMessage(from, { text: '❌ Não foi possível obter os membros do grupo no momento. Tente novamente.' }, { quoted: msg })
                return true
            }
            const participantes = metadata.participants.map(p => p.id)

            try { await sock.sendMessage(from, { delete: msg.key }) } catch { }

            const texto = mensagem

            await sock.sendMessage(from, {
                text: texto,
                mentions: participantes
            })

            return true
        } catch (err) {
            console.error('[TODOS] Erro fatal:', err)
            await sock.sendMessage(from, { text: '❌ Erro ao marcar membros.' }, { quoted: msg })
            return true
        }
    }

    return false
}
