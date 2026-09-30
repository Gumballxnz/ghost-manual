const path = require('path')
const fs = require('fs')
const config = require(path.join(__dirname, '../../../data/config.json'))

const configManager = require('../../utils/configManager')

function loadGroupConfig() {
    return configManager.loadGroupConfig()
}

function saveGroupConfig() {
    configManager.saveGroupConfig(true)
}

const { isAdmin: checkIsAdmin, isOwnerCheck, addSubdono } = require('../../utils/baileys')

module.exports = async (sock, msg, from, sender, text) => {

    const isOwner = isOwnerCheck(sender, msg)

    let adminStatus = isOwner
    if (!isOwner) {
        adminStatus = await checkIsAdmin(sock, from, sender)
    }

    const isAdmin = adminStatus

    if (text.startsWith(config.prefix + 'config subdono')) {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono principal pode configurar o subdono.' }, { quoted: msg })
            return true
        }
        const args = text.split(' ')
        const numero = args[2] || ''
        const numClean = numero.replace(/\D/g, '')

        if (!numClean) {
            await sock.sendMessage(from, { text: `❌ Uso correto:\n• \`.config subdono 258xxx\`` }, { quoted: msg })
            return true
        }

        addSubdono(numClean)

        await sock.sendMessage(from, { text: `✅ *Subdono configurado com sucesso!*\n\nNúmero: ${numClean}` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antilink') {
        const groups = loadGroupConfig()
        const status = groups[from]?.antilink ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `🔗 *ANTILINK*\n\nStatus: ${status}\n\n_Para alterar use:_\n.antilink on\n.antilink off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antilink on') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].antilink) {
            await sock.sendMessage(from, { text: '⚠️ O *Antilink* já está ativado neste grupo!' }, { quoted: msg })
            return true
        }

        groups[from].antilink = true
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '🔗 *Antilink ativado!*\n\nLinks serão detectados e o usuário será removido.'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antilink off' || text === config.prefix + 'antilink of') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].antilink === false) {
            await sock.sendMessage(from, { text: '⚠️ O *Antilink* já está desativado!' }, { quoted: msg })
            return true
        }

        groups[from].antilink = false
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '🔗 *Antilink desativado!*'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'detectarimg') {
        const groups = loadGroupConfig()
        const status = groups[from]?.detectarImg ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `🖼️ *DETECÇÃO OCR*\n\nStatus: ${status}\n\n_Para alterar use:_\n.detectarimg on\n.detectarimg off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'detectarimg on') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].detectarImg) {
            await sock.sendMessage(from, { text: '⚠️ A *Detecção de Imagem* já está ativada!' }, { quoted: msg })
            return true
        }

        groups[from].detectarImg = true
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '🖼️ *Detecção de imagem ativada!*\n\nComprovativos por imagem serão detectados.'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'detectarimg off') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].detectarImg === false) {
            await sock.sendMessage(from, { text: '⚠️ A *Detecção de Imagem* já está desativada!' }, { quoted: msg })
            return true
        }

        groups[from].detectarImg = false
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '🖼️ *Detecção de imagem desativada!*'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'boas-vindas' || text === config.prefix + 'boasvindas') {
        const groups = loadGroupConfig()
        const status = groups[from]?.bemvindo ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `👋 *BOAS-VINDAS*\n\nStatus: ${status}\n\n_Para alterar use:_\n.boas-vindas on\n.boas-vindas off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'boas-vindas on') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].bemvindo) {
            await sock.sendMessage(from, { text: '⚠️ O *Boas-Vindas* já está ativado!' }, { quoted: msg })
            return true
        }

        groups[from].bemvindo = true
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '👋 *Boas-vindas ativado!*\n\nNovos membros receberão mensagem de boas-vindas.'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'boas-vindas off') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].bemvindo === false) {
            await sock.sendMessage(from, { text: '⚠️ O *Boas-Vindas* já está desativado!' }, { quoted: msg })
            return true
        }

        groups[from].bemvindo = false
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '👋 *Boas-vindas desativado!*'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'adeus') {
        const groups = loadGroupConfig()
        const status = groups[from]?.adeus ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `👋 *NOTIFICAÇÃO DE SAÍDA*\n\nStatus: ${status}\n\n_Para alterar use:_\n.adeus on\n.adeus off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'adeus on') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].adeus) {
            await sock.sendMessage(from, { text: '⚠️ A *Notificação de Saída* já está ativada!' }, { quoted: msg })
            return true
        }

        groups[from].adeus = true
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '👋 *Notificação de Saída ativada!*\n\nO bot avisará quando alguém sair ou for removido.'
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'adeus off') {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas admins podem usar este comando.' }, { quoted: msg })
            return true
        }
        const groups = loadGroupConfig()
        if (!groups[from]) groups[from] = {}

        if (groups[from].adeus === false) {
            await sock.sendMessage(from, { text: '⚠️ A *Notificação de Saída* já está desativada!' }, { quoted: msg })
            return true
        }

        groups[from].adeus = false
        saveGroupConfig(groups)
        await sock.sendMessage(from, {
            text: '👋 *Notificação de Saída desativada!*'
        }, { quoted: msg })
        return true
    }

    return false
}
