const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys.js')
const configManager = require('../../utils/configManager')

async function execute(sock, msg, from, sender, text) {
    const rawCmd = (text || '').trim().toLowerCase().split(/\s+/)[0]
    const basePrefix = config.prefix || '.'
    const allowedCmds = [
        basePrefix + 'x9',
        basePrefix + 'x-9',
        basePrefix + 'modox9'
    ]

    if (!allowedCmds.includes(rawCmd)) return false

    const isGroup = from && from.endsWith('@g.us')
    const reply = (texto) => sock.sendMessage(from, { text: texto }, { quoted: msg })

    if (!isGroup) {
        await reply('❌ Este comando só funciona em grupos!')
        return true
    }

    const isOwner = isOwnerCheck(sender, msg)
    let isAdmin = false
    try {
        if (!isOwner) isAdmin = await checkIsAdmin(sock, from, sender)
    } catch { }

    if (!isAdmin && !isOwner) {
        await reply('❌ Apenas administradores do grupo ou o dono do bot podem alterar o modo X9.')
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    const safeKey = from.replace(/\./g, '___dot___')
    if (!groupConfig[from] && !groupConfig[safeKey]) {
        groupConfig[from] = {}
    }
    const currentGroup = groupConfig[from] || groupConfig[safeKey]

    const action = text.trim().split(/\s+/)[1]?.toLowerCase()

    if (!action) {
        const isAtivo = Boolean(currentGroup.x9)
        const status = isAtivo ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        const effectivePrefix = configManager.getPrefixForChat(from) || basePrefix

        await reply(
            `👁️ *MODO X9 (AVISO DE ADMINS)*\n\n` +
            `Status atual: ${status}\n\n` +
            `_Quando ativado, o bot avisa no grupo sempre que alguém for promovido a administrador ou rebaixado._\n\n` +
            `*Comandos:*\n` +
            `• \`${effectivePrefix}x9 on\` (Ativar avisos de admin)\n` +
            `• \`${effectivePrefix}x9 off\` (Desativar avisos de admin)`
        )
        return true
    }

    if (action === 'on' || action === 'ativar' || action === '1' || action === 'ligar') {
        currentGroup.x9 = true
        configManager.saveGroupConfig(groupConfig, true)
        await reply('👁️ *Modo X9 ATIVADO!*\n\nO bot agora enviará avisos no grupo quando houver promoções ou rebaixamentos de administradores.')
        return true
    }

    if (action === 'off' || action === 'desativar' || action === '0' || action === 'desligar') {
        currentGroup.x9 = false
        configManager.saveGroupConfig(groupConfig, true)
        await reply('🔕 *Modo X9 DESATIVADO!*\n\nO bot não enviará mais avisos de promoções ou rebaixamentos de administradores neste grupo.')
        return true
    }

    const effectivePrefix = configManager.getPrefixForChat(from) || basePrefix
    await reply(`⚠️ Uso incorreto! Utilize:\n• \`${effectivePrefix}x9 on\`\n• \`${effectivePrefix}x9 off\``)
    return true
}

module.exports = execute
module.exports.execute = execute
module.exports.name = 'x9'
module.exports.aliases = ['x-9', 'modox9']
module.exports.categoria = 'adm'
module.exports.subcategoria = 'MODERAÇÃO'
module.exports.descricao = 'Ativa ou desativa avisos de novos admins promovidos ou rebaixados no grupo'
module.exports.uso = '.x9 [on/off]'
