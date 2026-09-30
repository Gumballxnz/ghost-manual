const config = require('../../../data/config.json')
const configManager = require('../../utils/configManager')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys.js')

module.exports = async (sock, msg, from, sender, text) => {
    const { getPrefixForChat } = require('../../utils/configManager')
    const prefix = getPrefixForChat ? getPrefixForChat(from) : config.prefix
    const lower = text.trim().toLowerCase()

    if (!lower.startsWith(prefix + 'antibot')) return false

    const isGroup = from.endsWith('@g.us')
    const reply = (texto) => sock.sendMessage(from, { text: texto }, { quoted: msg })

    if (!isGroup) {
        await reply('❌ Este comando só pode ser utilizado em grupos!')
        return true
    }

    const isOwner = isOwnerCheck(sender, msg)
    let isAdmin = false
    try {
        if (!isOwner) isAdmin = await checkIsAdmin(sock, from, sender)
    } catch { }

    if (!isAdmin && !isOwner) {
        await reply('❌ Apenas administradores do grupo podem configurar o Anti-Bot!')
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}

    const args = text.trim().split(/\s+/)
    const subCmd = args[1]?.toLowerCase()
    const subParam = args[2]?.toLowerCase()

    const userName = msg.pushName || 'Administrador'

    if (!subCmd || subCmd === 'ajuda' || subCmd === 'help') {
        const isAtivo = groupConfig[from].antibot === true || groupConfig[from].antiBot === true
        const modoAtual = (groupConfig[from].antibotModo || 'ban').toUpperCase()
        const statusTexto = isAtivo ? '🟢 ATIVADO' : '🔴 DESATIVADO'

        const header = [
            '╭┈⊰ 🛡️ 『 *SISTEMA ANTI-BOT* 』',
            `┊Olá, ${userName}!`,
            `┊Status Atual: *${statusTexto}* | Modo: *${modoAtual}*`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco = [
            '╭┈❁ *⚙️ COMANDOS DISPONÍVEIS*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}antibot on ➔ Ativar proteção`,
            `┊•.̇𖥨֗👻⭟${prefix}antibot off ➔ Desativar proteção`,
            `┊•.̇𖥨֗👻⭟${prefix}antibot modo ban ➔ Banir apenas o bot invasor`,
            `┊•.̇𖥨֗👻⭟${prefix}antibot modo duplo ➔ Banir bot + quem adicionou`,
            `┊•.̇𖥨֗👻⭟${prefix}antibot status ➔ Ver detalhes da proteção`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const footer = [
            '╭┈⊰ 🔒 *BLINDAGEM TOTAL*',
            '┊Administradores e robôs oficiais possuem imunidade total.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply([header, '', bloco, '', footer].join('\n'))
        return true
    }

    if (subCmd === 'status') {
        const isAtivo = groupConfig[from].antibot === true || groupConfig[from].antiBot === true
        const modoAtual = (groupConfig[from].antibotModo || 'ban').toLowerCase()
        const modoDesc = modoAtual === 'duplo' || modoAtual === 'total'
            ? 'Banir o bot invasor E quem o adicionou'
            : 'Banir apenas o bot invasor'

        const cardStatus = [
            '╭┈⊰ 🛡️ 『 *STATUS DO ANTI-BOT* 』',
            '┊',
            `┊•.̇𖥨֗🛡️⭟ *Proteção:* ${isAtivo ? '🟢 ATIVADA' : '🔴 DESATIVADA'}`,
            `┊•.̇𖥨֗⚔️⭟ *Modo:* ${modoAtual.toUpperCase()} (${modoDesc})`,
            '┊•.̇𖥨֗🔍⭟ *Detecções:* Botões API, Spam de Aluguel/Licença,',
            '┊      e colisão de erros robóticos.',
            '┊•.̇𖥨֗🔒⭟ *Imunidade:* Administradores e Dono 100% protegidos.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardStatus)
        return true
    }

    if (subCmd === 'on' || subCmd === 'ativar') {
        groupConfig[from].antibot = true
        if (!groupConfig[from].antibotModo) {
            groupConfig[from].antibotModo = 'ban'
        }
        configManager.saveGroupConfig(groupConfig)

        const cardAtivado = [
            '╭┈⊰ 🛡️ 『 *ANTI-BOT ATIVADO* 』',
            '┊',
            '┊•.̇𖥨֗✅⭟ *Proteção contra robôs invasores ATIVADA!*',
            `┊•.̇𖥨֗⚔️⭟ *Modo padrão:* BANIR BOT INVASOR`,
            '┊•.̇𖥨֗🗑️⭟ Mensagens de outros bots serão apagadas na hora.',
            `┊•.̇𖥨֗💡⭟ Para banir também quem convidou o bot: *${prefix}antibot modo duplo*`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardAtivado)
        try { await sock.sendMessage(from, { react: { text: '🛡️', key: msg.key } }) } catch {}
        return true
    }

    if (subCmd === 'off' || subCmd === 'desativar') {
        groupConfig[from].antibot = false
        configManager.saveGroupConfig(groupConfig)

        const cardDesativado = [
            '╭┈⊰ 🛡️ 『 *ANTI-BOT DESATIVADO* 』',
            '┊',
            '┊•.̇𖥨֗❌⭟ *A proteção Anti-Bot foi desligada neste grupo.*',
            `┊•.̇𖥨֗💡⭟ Para reativar quando quiser, use *${prefix}antibot on*`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardDesativado)
        try { await sock.sendMessage(from, { react: { text: '⚪', key: msg.key } }) } catch {}
        return true
    }

    if (subCmd === 'modo') {
        if (subParam === 'ban' || subParam === 'simples') {
            groupConfig[from].antibotModo = 'ban'
            configManager.saveGroupConfig(groupConfig)
            await reply([
                '╭┈⊰ 🛡️ 『 *MODO ATUALIZADO* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Modo Anti-Bot definido para: BANIR APENAS O BOT*',
                '┊•.̇𖥨֗👤⭟ O membro que adicionou receberá um alerta/menção.',
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n'))
            return true
        }

        if (subParam === 'duplo' || subParam === 'total' || subParam === 'ambos') {
            groupConfig[from].antibotModo = 'duplo'
            configManager.saveGroupConfig(groupConfig)
            await reply([
                '╭┈⊰ 🛡️ 『 *MODO ATUALIZADO* 』',
                '┊',
                '┊•.̇𖥨֗⚠️⭟ *Modo Anti-Bot definido para: BANIMENTO DUPLO*',
                '┊•.̇𖥨֗🚫⭟ O bot invasor E quem o adicionou serão banidos!',
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n'))
            return true
        }

        await reply(`⚠️ Uso correto: *${prefix}antibot modo ban* ou *${prefix}antibot modo duplo*`)
        return true
    }

    await reply(`⚠️ Comando não reconhecido. Use *${prefix}antibot* para ver o painel.`)
    return true
}
