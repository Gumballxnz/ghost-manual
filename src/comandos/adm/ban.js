const { isAdmin: checkIsAdmin, isOwnerCheck, isLeaderCheck } = require('../../utils/baileys.js')
const config = require('../../../data/config.json')

module.exports = async (sock, msg, from, sender, text) => {
    if ((text === config.prefix + 'ban' || text.startsWith(config.prefix + 'ban ')) && !text.startsWith(config.prefix + 'banghost')) {

        const isOwner = isOwnerCheck(sender, msg)

        let isGroupAdmin = false
        try {
            if (!isOwner && from.endsWith('@g.us')) {
                isGroupAdmin = await checkIsAdmin(sock, from, sender)
            }
        } catch { }

        if (!isGroupAdmin && !isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
            return true
        }

        let target = null
        let motivo = ''
        const semPrefix = text.slice((config.prefix + 'ban').length).trim()

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant
        if (quoted) {
            target = quoted
            motivo = semPrefix.replace(/^[\s,:-]+/, '').trim()
        }

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
        if (!target && mentions && mentions.length > 0) {
            target = mentions[0]
            const targetBaseNum = target.split('@')[0].split(':')[0]
            motivo = semPrefix.replace(new RegExp('@?' + targetBaseNum, 'g'), '').replace(/^[\s,:-]+/, '').trim()
        }

        if (!target && semPrefix.length > 0) {
            const matchNumber = semPrefix.match(/^(\+?\d[\d\s-]{6,15})/)
            if (matchNumber) {
                const number = matchNumber[1].replace(/\D/g, '')
                if (number.length >= 7) {
                    target = number + '@s.whatsapp.net'
                    motivo = semPrefix.slice(matchNumber[0].length).replace(/^[\s,:-]+/, '').trim()
                }
            }
        }

        if (!target) {
            await sock.sendMessage(from, { text: '❌ Responda à mensagem, mencione a pessoa ou digite o número para banir.\nExemplo: .ban @pessoa [motivo] ou .ban +25884... [motivo]' }, { quoted: msg })
            return true
        }

        const botId = sock.user.id ? sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net' : ''
        if (target === botId || (sock.user.id && target.includes(sock.user.id.split(':')[0].split('@')[0]))) {
            await sock.sendMessage(from, { text: '❌ *Eu não posso me remover!* Por favor, marque um usuário válido.' }, { quoted: msg })
            return true
        }

        if (isLeaderCheck(target, msg) && !isLeaderCheck(sender, msg)) {
            await sock.sendMessage(from, { text: '❌ *Eu não posso banir o meu mestre!* Por favor, vamos fazer isso com calma.' }, { quoted: msg })
            return true
        }

        try {
            let finalTarget = target;

            try {
                const groupMeta = await sock.groupMetadata(from);
                const targetBase = target.split(':')[0].split('@')[0];
                const found = groupMeta.participants.find(p => p.id.split(':')[0].split('@')[0] === targetBase);
                if (found) {
                    finalTarget = found.id;
                    console.log(`[BAN] Participante encontrado nos metadados: ${found.id}`);
                }
            } catch (metaErr) {
                console.log('[BAN] Falha ao buscar metadados:', metaErr.message);
            }

            console.log(`[BAN] Removendo: ${finalTarget} do grupo: ${from}`);
            await sock.groupParticipantsUpdate(from, [finalTarget], 'remove')

            if (motivo) {
                const userTag = '@' + target.split('@')[0].split(':')[0]
                await sock.sendMessage(from, {
                    text: `🚫 *USUÁRIO REMOVIDO!*\n👤 *Membro:* ${userTag}\n📌 *Motivo:* ${motivo}`,
                    mentions: [target]
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: '✅ Usuário removido com sucesso!' }, { quoted: msg })
            }
        } catch (err) {
            console.log('[BAN] Erro:', err.message)

            if (err.message?.includes('not-authorized')) {
                await sock.sendMessage(from, { text: '❌ Sem permissão. Verifique se o bot é admin.' }, { quoted: msg })
            } else if (err.message?.includes('not-found') || err.message?.includes('404')) {
                await sock.sendMessage(from, { text: '❌ Esse usuário não está mais no grupo.' }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: '❌ Erro ao banir. Verifique se o bot é admin e se o número é válido.' }, { quoted: msg })
            }
        }

        return true
    }

    return false
}
