const fs = require('fs')
const path = require('path')
const config = require('../../data/config.json')

module.exports = async (sock, msg, from) => {
    const prefix = config.prefix
    const userName = msg.pushName || 'Usuário'

    const header = [
        '╭┈⊰ 👻 『 *GHOST BOT* 』',
        `┊Olá, ${userName}!`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

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
        `┊•.̇𖥨֗👻⭟${prefix}s (Criar Figurinha)`,
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

    const blocoGithub = [
        '╭┈❁ 🐙 *GITHUB*',
        '┊•.̇𖥨֗💻⭟ github.com/Gumballxnz/ghost-manual',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const menuText = [header, '', blocoGithub, '', bloco1, '', bloco2, '', bloco3].join('\n')

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
