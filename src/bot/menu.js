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
        '╭┈❁ *🛒 TABELAS & PREÇOS*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}tabela`,
        `┊•.̇𖥨֗👻⭟${prefix}tabelasaldo`,
        `┊•.̇𖥨֗👻⭟${prefix}pagamento`,
        `┊•.̇𖥨֗👻⭟${prefix}informacoes`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco2 = [
        '╭┈❁ *📋 UTILITÁRIOS & PERFIL*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}perfil`,
        `┊•.̇𖥨֗👻⭟${prefix}s (Criar Figurinha)`,
        `┊•.̇𖥨֗👻⭟${prefix}infogp`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco3 = [
        '╭┈❁ *👑 SUPORTE & ATENDIMENTO*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}suporte`,
        `┊•.̇𖥨֗👻⭟${prefix}dono`,
        `┊•.̇𖥨֗👻⭟${prefix}aluguel`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const menuText = [header, '', bloco1, '', bloco2, '', bloco3].join('\n')

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
