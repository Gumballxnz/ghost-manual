const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isAdmin, isOwnerCheck, getGroupMetadataCached } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')

function obterMapaGrupos() {
    if (global.mapaGrupos && global.mapaGrupos.length > 0) {
        return global.mapaGrupos
    }
    const groups = configManager.loadGroupConfig()
    return Object.entries(groups)
        .filter(([id, cfg]) => cfg.authorized)
        .map(([id]) => id)
        .sort((a, b) => a.localeCompare(b))
}

module.exports = async (sock, msg, from, sender, text) => {
    const lower = text.toLowerCase().trim()
    const prefix = config.prefix

    if (lower.startsWith(prefix + 'linkgp') || lower.startsWith(prefix + 'linkgrupo')) {
        const isOwner = isOwnerCheck(sender, msg)
        const adminStatus = await isAdmin(sock, from, sender)

        if (!isOwner && !adminStatus) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores do grupo ou o dono do bot podem usar este comando.' }, { quoted: msg })
            return true
        }

        const args = text.split(' ').slice(1).filter(Boolean)
        let targetJid = from

        if (args.length > 0) {
            const arg = args[0].trim()
            if (/^\d+$/.test(arg)) {
                const index = parseInt(arg, 10)
                const jids = obterMapaGrupos()
                if (index < 1 || index > jids.length) {
                    await sock.sendMessage(from, { text: `❌ Índice de grupo inválido! Use um número de 1 a ${jids.length} (consulte a lista com \`.grupos\`).` }, { quoted: msg })
                    return true
                }
                targetJid = jids[index - 1]
            } else if (arg.endsWith('@g.us')) {
                targetJid = arg
            } else {
                await sock.sendMessage(from, { text: '❌ Uso correto:\n• `.linkgp` (no próprio grupo)\n• `.linkgp 1` (número do grupo retornado pelo `.grupos`)\n• `.linkgp <id_do_grupo>`' }, { quoted: msg })
                return true
            }
        } else {
            if (!from.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ No privado, informe o número ou ID do grupo:\n• `.linkgp 1`\n• `.linkgp <id_do_grupo>`' }, { quoted: msg })
                return true
            }
        }

        let nomeGrupo = targetJid.split('@')[0]
        try {
            const metadata = await getGroupMetadataCached(sock, targetJid)
            if (metadata?.subject) nomeGrupo = metadata.subject
        } catch (e) {}

        const myJid = sock.user?.id || ''
        const myNumber = myJid.split('@')[0].split(':')[0]

        try {
            const code = await sock.groupInviteCode(targetJid)
            const inviteLink = `https://chat.whatsapp.com/${code}`

            let resposta = `🔗 *LINK DO GRUPO*\n\n`
            resposta += `👥 *Grupo:* ${nomeGrupo}\n`
            resposta += `🆔 *ID:* \`${targetJid}\`\n\n`
            resposta += `👉 ${inviteLink}`

            await sock.sendMessage(from, { text: resposta }, { quoted: msg })
            return true
        } catch (err) {
            console.error(`[LINKGP] Erro ao obter link do grupo ${targetJid}:`, err.message)
            const erroMsg = (err.message || '').toLowerCase()

            if (erroMsg.includes('forbidden') || err.status === 403 || err.output?.statusCode === 403) {
                await sock.sendMessage(from, {
                    text: `❌ *Erro de Permissão no WhatsApp:*\n\n👥 *Grupo:* ${nomeGrupo}\n🤖 *Número do Bot Ativo:* +${myNumber}\n\n⚠️ O WhatsApp recusou o pedido porque o número atual do bot (+${myNumber}) *NÃO é Administrador* neste grupo no WhatsApp.\n\n👉 *Solução:* Promova o número +${myNumber} a Administrador do grupo no WhatsApp e tente novamente!`
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, {
                    text: `❌ *Erro ao obter link do grupo:* ${nomeGrupo}\n\nMotivo: ${err.message || 'O bot precisa ser Administrador do grupo.'}`
                }, { quoted: msg })
            }
            return true
        }
    }

    return false
}
