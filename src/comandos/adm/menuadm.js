const fs = require('fs')
const path = require('path')
const { isAdmin, isOwnerCheck } = require('../../utils/baileys.js')
const config = require('../../../data/config.json')

module.exports = async (sock, msg, from, sender, text) => {
    const rawCmd = text.trim().toLowerCase().split(/\s+/)[0]
    if (rawCmd !== config.prefix + 'menuadm' && rawCmd !== config.prefix + 'painel' && rawCmd !== config.prefix + 'adm') {
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

    const { getPrefixForChat } = require('../../utils/configManager')
    const prefix = getPrefixForChat(from)
    const userName = msg.pushName || 'Administrador'

    const header = [
        '╭┈⊰ 👻 『 *PAINEL ADMIN (MANUAL)* 』',
        `┊Olá, ${userName}!`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco1 = [
        '╭┈❁ *📊 TABELAS & PREÇOS (A-Z)*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}configurar listar`,
        `┊•.̇𖥨֗👻⭟${prefix}configurar saldo`,
        `┊•.̇𖥨֗👻⭟${prefix}configurar tabela`,
        `┊•.̇𖥨֗👻⭟${prefix}configurar ver saldo`,
        `┊•.̇𖥨֗👻⭟${prefix}configurar ver tabela`,
        `┊•.̇𖥨֗👻⭟${prefix}tabela`,
        `┊•.̇𖥨֗👻⭟${prefix}tabelasaldo`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco2 = [
        '╭┈❁ *📦 GESTÃO DE VENDAS (A-Z)*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}aumentarlimite`,
        `┊•.̇𖥨֗👻⭟${prefix}compras`,
        `┊•.̇𖥨֗👻⭟${prefix}limparcompras`,
        `┊•.̇𖥨֗👻⭟${prefix}recuperarcompras`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco3 = [
        '╭┈❁ *🛡️ SEGURANÇA & PROTEÇÃO (A-Z)*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}antiaudio [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antibot [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antidoc [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antiflood [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antifoto [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antigringo [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antilink [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antimidia [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antipalavrao [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}antivideo [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}concorrentes [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}copiarprotecoes`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco4 = [
        '╭┈❁ *👥 GESTÃO DO GRUPO (A-Z)*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}alarme`,
        `┊•.̇𖥨֗👻⭟${prefix}aviso [texto]`,
        `┊•.̇𖥨֗👻⭟${prefix}ban @membro`,
        `┊•.̇𖥨֗👻⭟${prefix}bemvindo [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}grupo [abrir/fechar]`,
        `┊•.̇𖥨֗👻⭟${prefix}infogp`,
        `┊•.̇𖥨֗👻⭟${prefix}limpar`,
        `┊•.̇𖥨֗👻⭟${prefix}linkgp`,
        `┊•.̇𖥨֗👻⭟${prefix}mute [minutos]`,
        `┊•.̇𖥨֗👻⭟${prefix}prefixo [novo]`,
        `┊•.̇𖥨֗👻⭟${prefix}todos [texto]`,
        `┊•.̇𖥨֗👻⭟${prefix}unmute`,
        `┊•.̇𖥨֗👻⭟${prefix}x9 [on/off]`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const bloco5 = [
        '╭┈❁ *🔑 LICENÇA & CONFIGURAÇÕES (A-Z)*',
        '┊',
        `┊•.̇𖥨֗👻⭟${prefix}ativarlicenca [chave]`,
        `┊•.̇𖥨֗👻⭟${prefix}bot [on/off]`,
        `┊•.̇𖥨֗👻⭟${prefix}ping`,
        `┊•.̇𖥨֗👻⭟${prefix}renovar`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const blocoGithub = [
        '╭┈❁ 🐙 *GITHUB*',
        '┊•.̇𖥨֗💻⭟ github.com/Gumballxnz/ghost-manual',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')

    const menuAdmText = [header, '', blocoGithub, '', bloco1, '', bloco2, '', bloco3, '', bloco4, '', bloco5].join('\n')

    const logoPath = path.join(__dirname, '../../../assets', 'menuadm.jpg')

    if (fs.existsSync(logoPath)) {
        await sock.sendMessage(from, {
            image: fs.readFileSync(logoPath),
            caption: menuAdmText
        }, { quoted: msg })
    } else {
        await sock.sendMessage(from, { text: menuAdmText }, { quoted: msg })
    }
    return true
}
