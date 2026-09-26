const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys.js')

module.exports = async (sock, msg, from, sender, text) => {
    if (!text.startsWith(config.prefix + 'aprovar')) return false

    const isGroup = from.endsWith('@g.us')
    const reply = (texto) => sock.sendMessage(from, { text: texto }, { quoted: msg })

    if (!isGroup) {
        await reply('❌ Este comando só pode ser usado em grupos!')
        return true
    }

    const isOwner = isOwnerCheck(sender, msg)
    let isAdmin = false
    try {
        if (!isOwner) isAdmin = await checkIsAdmin(sock, from, sender)
    } catch { }

    if (!isAdmin && !isOwner) {

        await reply('❌ Apenas administradores podem usar este comando!')
        return true
    }

    try {

        const pendingParticipants = await sock.groupRequestParticipantsList(from)

        if (!pendingParticipants || pendingParticipants.length === 0) {
            await reply('✅ Não há solicitações pendentes para aprovar.')
            return true
        }

        await reply(`⏳ Processando *${pendingParticipants.length}* solicitações...`)

        const participantsJid = pendingParticipants.map(participant => participant.jid)

        await sock.groupRequestParticipantsUpdate(
            from,
            participantsJid,
            'approve'
        )

        await reply(`✅ *Sucesso!* Foram aprovados *${pendingParticipants.length}* participantes.`)

    } catch (err) {
        console.error('[ERRO-APROVAR]', err)
        await reply(`❌ Ocorreu um erro ao tentar aprovar os participantes.\nErro: ${err.message}`)
    }
    return true
}
