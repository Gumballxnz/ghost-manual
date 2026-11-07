const fs = require('fs')
const path = require('path')
const config = require('../../data/config.json')
const { getSender, isOwnerCheck, isAdmin } = require('../utils/baileys')
const { getPrefixForChat } = require('../utils/configManager')

async function isUserElevated(sock, from, sender, msg) {
    try {
        if (!sender) return false

        // 1. Dono absoluto ou Subdono
        if (isOwnerCheck(sender, msg)) return true

        // 2. Revendedor / Usuário autorizado para Sub-Bots
        try {
            const subbotManager = require('./subbotManager')
            if (subbotManager && typeof subbotManager.isAutorizado === 'function') {
                if (subbotManager.isAutorizado(sender, msg)) return true
            }
        } catch {}

        // 3. Administrador de grupo
        if (from && from.endsWith('@g.us')) {
            const admin = await isAdmin(sock, from, sender)
            if (admin) return true
        }
    } catch (err) {
        console.error('[MENU] Erro ao verificar nível do usuário:', err.message)
    }
    return false
}

module.exports = async (sock, msg, from, sender = null, options = {}) => {
    if (!sender) {
        sender = getSender(msg)
    }

    const basePrefix = config.prefix || '.'
    const prefix = (getPrefixForChat && typeof getPrefixForChat === 'function')
        ? getPrefixForChat(from)
        : basePrefix

    const userName = msg.pushName || 'Usuário'

    const header = [
        '╭┈⊰ 👻 『 *GHOST BOT* 』',
        `┊Olá, ${userName}!`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const blocoGithub = [
        '╭┈❁ 🐙 *GITHUB*',
        '┊•.̇𖥨֗💻⭟ github.com/Gumballxnz/ghost-manual',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const forceMember = options && options.forceMember === true
    const elevated = !forceMember && (await isUserElevated(sock, from, sender, msg))

    let menuText = ''

    if (elevated) {
        // Estilo Nazuna: Diretório com todos os menus existentes
        const blocoPrincipal = [
            '╭┈❁ *MENU PRINCIPAL*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}menuadm`,
            `┊•.̇𖥨֗👻⭟${prefix}menuconect`,
            `┊•.̇𖥨֗👻⭟${prefix}menudono`,
            `┊•.̇𖥨֗👻⭟${prefix}menumembro`,
            `┊•.̇𖥨֗👻⭟${prefix}menuprefix`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        menuText = [header, '', blocoGithub, '', blocoPrincipal].join('\n')
    } else {
        // Membro comum: Menu comercial já existente
        const bloco1 = [
            '╭┈❁ *🛒 TABELAS & PREÇOS (A-Z)*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}informacoes`,
            `┊•.̇𖥨֗👻⭟${prefix}pagamento`,
            `┊•.̇𖥨֗👻⭟${prefix}tabela`,
            `┊•.̇𖥨֗👻⭟${prefix}tabelasaldo`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco2 = [
            '╭┈❁ *📋 UTILITÁRIOS & PERFIL (A-Z)*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}infogp`,
            `┊•.̇𖥨֗👻⭟${prefix}perfil`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco3 = [
            '╭┈❁ *👑 SUPORTE & ATENDIMENTO (A-Z)*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}aluguel`,
            `┊•.̇𖥨֗👻⭟${prefix}dono`,
            `┊•.̇𖥨֗👻⭟${prefix}suporte`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        menuText = [header, '', blocoGithub, '', bloco1, '', bloco2, '', bloco3].join('\n')
    }

    const logoPath = path.join(__dirname, '../../assets', 'menuadm.jpg')

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
