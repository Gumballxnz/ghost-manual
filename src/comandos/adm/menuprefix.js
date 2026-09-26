const fs = require('fs')
const path = require('path')
const { isAdmin, isOwnerCheck } = require('../../utils/baileys.js')
const config = require('../../../data/config.json')
const { getPrefixForChat } = require('../../utils/configManager')

const menuPrefixHandler = async (sock, msg, from, sender, text) => {
    const rawCmd = text.trim().toLowerCase().split(/\s+/)[0]
    const basePrefix = config.prefix || '.'
    if (rawCmd !== basePrefix + 'menuprefix' &&
        rawCmd !== basePrefix + 'menuprefixo' &&
        rawCmd !== basePrefix + 'prefixmenu' &&
        rawCmd !== basePrefix + 'prefixos') {
        return false
    }

    const isOwner = isOwnerCheck(sender, msg)
    const isGroup = from.endsWith('@g.us')

    if (!isOwner) {
        if (!isGroup) {
            await sock.sendMessage(from, { text: '❌ Este menu é exclusivo para administradores de grupo ou dono do bot.' }, { quoted: msg })
            return true
        }
        let adminStatus = false
        try {
            adminStatus = await isAdmin(sock, from, sender)
        } catch { }

        if (!adminStatus) {
            await sock.sendMessage(from, { text: '❌ Este menu é exclusivo para administradores do grupo.' }, { quoted: msg })
            return true
        }
    }

    const prefix = getPrefixForChat(from)
    const userName = msg.pushName || 'Administrador'

    const header = [
        '╭┈⊰ 👻 『 *MENU PREFIXOS* 』',
        `┊Olá, ${userName}!`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco1 = [
        '╭┈❁ *⚙️ PREFIXO DO GRUPO*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}prefixo`,
        `┊•.̇𖥨֗👻⭟${prefix}prefixo <prefixo>`,
        `┊•.̇𖥨֗👻⭟${prefix}prefixo reset`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco2 = [
        '╭┈❁ *🌐 PREFIXO GLOBAL*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}prefixoglobal <prefixo>`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco3 = [
        '╭┈❁ *👥 CONSULTA RÁPIDA*',
        '┊',
        '┊•.̇𖥨֗👻⭟prefixo',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const menuText = [header, '', bloco1, '', bloco2, '', bloco3].join('\n')

    const logoPath = path.join(__dirname, '../../../assets', 'menuadm.jpg')

    if (fs.existsSync(logoPath)) {
        await sock.sendMessage(from, {
            image: fs.readFileSync(logoPath),
            caption: menuText
        }, { quoted: msg })
    } else {
        await sock.sendMessage(from, { text: menuText }, { quoted: msg })
    }
    return true
}

menuPrefixHandler.nome = 'menuprefix'
menuPrefixHandler.name = 'menuprefix'
menuPrefixHandler.aliases = ['menuprefixo', 'prefixmenu', 'prefixos']
menuPrefixHandler.categoria = 'adm'
menuPrefixHandler.descricao = 'Menu de gerenciamento de prefixos'
menuPrefixHandler.uso = `${config.prefix}menuprefix`

module.exports = menuPrefixHandler
