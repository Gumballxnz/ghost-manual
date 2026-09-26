const config = require('../../../data/config.json')
const { isAdmin, isOwnerCheck } = require('../../utils/baileys')
const { getPrefixForChat, setGroupPrefix } = require('../../utils/configManager')

const prefixoHandler = async function (sock, msg, from, sender, text) {
        const rawTokens = (text || '').trim().split(/\s+/)
        const cmd = rawTokens[0].toLowerCase()
        const basePrefix = config.prefix || '.'

        const isMatch = (
            cmd === basePrefix + 'prefixo' ||
            cmd === basePrefix + 'prefix' ||
            cmd === basePrefix + 'setprefix' ||
            cmd === basePrefix + 'prefixogrupo'
        )

        if (!isMatch) return false

        const isGroup = from && from.endsWith('@g.us')
        if (!isGroup) {
            await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado dentro de um grupo.' }, { quoted: msg })
            return true
        }

        const isOwner = isOwnerCheck(sender, msg)
        let isAdm = false
        try {
            isAdm = await isAdmin(sock, from, sender)
        } catch {}

        if (!isOwner && !isAdm) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores do grupo ou o Dono do bot podem alterar o prefixo deste grupo.' }, { quoted: msg })
            return true
        }

        const currentPrefix = getPrefixForChat(from)
        const args = rawTokens.slice(1)
        const newPrefixRaw = args[0] ? args[0].trim() : ''

        if (!newPrefixRaw) {
            const fs = require('fs')
            const path = require('path')
            const helpMsg = [
                '╭┈⊰ 👻 『 *PREFIXO DO GRUPO* 』',
                '┊',
                `┊•.̇𖥨֗👻⭟Prefixo: *${currentPrefix}*`,
                `┊•.̇𖥨֗👻⭟${currentPrefix}prefixo <prefixo>`,
                `┊•.̇𖥨֗👻⭟${currentPrefix}prefixo reset`,
                `┊•.̇𖥨֗👻⭟${currentPrefix}menuprefix`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')

            const logoPath = path.join(__dirname, '../../../assets', 'menuadm.jpg')

            if (fs.existsSync(logoPath)) {
                await sock.sendMessage(from, {
                    image: fs.readFileSync(logoPath),
                    caption: helpMsg
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: helpMsg }, { quoted: msg })
            }
            return true
        }

        const lowerArg = newPrefixRaw.toLowerCase()
        if (lowerArg === 'reset' || lowerArg === 'padrao' || lowerArg === 'padrão') {
            setGroupPrefix(from, null)
            await sock.sendMessage(from, {
                text: `✅ *Prefixo do grupo resetado com sucesso!*\n\nEste grupo agora voltou a utilizar o prefixo padrão do bot: *${basePrefix}*\nExemplo: *${basePrefix}menu*`
            }, { quoted: msg })
            return true
        }

        if (newPrefixRaw.length > 2 || /^[a-zA-Z0-9\s]+$/.test(newPrefixRaw)) {
            await sock.sendMessage(from, {
                text: '❌ *Prefixo inválido!*\n\nO prefixo deve ser composto por 1 ou 2 caracteres especiais (símbolos).\nExemplos válidos: `.`, `!`, `#`, `?`, `$`, `/`, `-`'
            }, { quoted: msg })
            return true
        }

        const ok = setGroupPrefix(from, newPrefixRaw)
        if (!ok) {
            await sock.sendMessage(from, { text: '❌ Falha ao salvar o novo prefixo do grupo. Tente novamente.' }, { quoted: msg })
            return true
        }

        const successMsg = [
            '✅ *Prefixo deste grupo alterado com sucesso!*',
            '────────────────────────',
            `📌 Novo Prefixo: *${newPrefixRaw}*`,
            `💡 A partir de agora, use os comandos com *${newPrefixRaw}* neste grupo (ex: *${newPrefixRaw}menu*, *${newPrefixRaw}tabela*).`,
            '',
            `_Para voltar ao padrão a qualquer momento, digite: ${newPrefixRaw}prefixo reset_`
        ].join('\n')

        await sock.sendMessage(from, { text: successMsg }, { quoted: msg })
        return true
}

prefixoHandler.nome = 'prefixo'
prefixoHandler.name = 'prefixo'
prefixoHandler.aliases = ['prefix', 'setprefix', 'prefixogrupo']
prefixoHandler.categoria = 'adm'
prefixoHandler.descricao = 'Altera o prefixo de comandos exclusivamente deste grupo'
prefixoHandler.uso = `${config.prefix}prefixo <novo_prefixo>`

module.exports = prefixoHandler
