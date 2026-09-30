const fs = require('fs')
const path = require('path')
const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys.js')
const configManager = require('../../utils/configManager')

module.exports = async (sock, msg, from, sender, text) => {
    if (!text.startsWith(config.prefix + 'antiflood')) return false

    const isGroup = from.endsWith('@g.us')
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
        await reply('❌ Apenas administradores podem usar este comando!')
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}

    const action = text.split(/\s+/)[1]?.toLowerCase()

    if (!action) {
        const status = groupConfig[from].antiflood ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await reply(`🌊 *ANTI-FLOOD*\n\nStatus: ${status}\n\n_Limita a 5 mensagens em 4 segundos._\n_Quem ultrapassar será banido e mensagens apagadas._\n\n_Para alterar use:_\n${config.prefix}antiflood on\n${config.prefix}antiflood off`)
        return true
    }

    if (action === 'on' || action === 'ativar') {
        groupConfig[from].antiflood = true
        configManager.saveGroupConfig(true)
        await reply('✅ *Anti-Flood ATIVADO!*\n\n🌊 Limite: 5 mensagens em 4 segundos.\n⚠️ Quem ultrapassar será banido automaticamente.')
        return true
    }

    if (action === 'off' || action === 'desativar') {
        groupConfig[from].antiflood = false
        configManager.saveGroupConfig(true)
        await reply('❌ *Anti-Flood DESATIVADO!*')
        return true
    }

    await reply(`⚠️ Use: ${config.prefix}antiflood on ou ${config.prefix}antiflood off`)
    return true
}
