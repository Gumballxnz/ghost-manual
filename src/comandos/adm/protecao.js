const config = require('../../../data/config.json')
const fs = require('fs')
const path = require('path')
const { isAdmin } = require('../../utils/baileys')
const { isOwnerCheck } = require('../../utils/baileys')

const configManager = require('../../utils/configManager')

function loadConfig() {
    return configManager.loadGroupConfig()
}

function saveConfig() {
    configManager.saveGroupConfig(true)
}

function loadConcorrentes() {
    return configManager.loadConcorrentes()
}

function saveConcorrentes(data) {
    configManager.saveConcorrentes(data)
}

module.exports = async (sock, msg, from, sender, text) => {
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''

    const isOwner = isOwnerCheck(sender, msg)

    let adminStatus = isOwner
    if (!isOwner) {
        adminStatus = await isAdmin(sock, from, sender)
    }
    const isAdminUser = adminStatus

    if (text.startsWith(config.prefix + 'get-lid')) {
        let alvoArg = body.slice((config.prefix + 'get-lid').length).trim()
        let alvoNumero = ''

        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            alvoNumero = msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0]
        }

        else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            alvoNumero = msg.message.extendedTextMessage.contextInfo.participant.split('@')[0]
        }

        else if (alvoArg) {
            alvoNumero = alvoArg.replace(/\D/g, '')
        }

        if (!alvoNumero) {
            await sock.sendMessage(from, { text: '❌ Informe o número, mencione alguém ou responda a uma mensagem!\n\nEx: .get-lid 25884...' }, { quoted: msg })
            return true
        }

        try {
            const metadata = await sock.groupMetadata(from)
            const participant = metadata.participants.find(p => p.id.includes(alvoNumero))

            if (participant) {

                const jid = participant.id

                await sock.sendMessage(from, { text: `📱 *Alvo:* ${alvoNumero}\n🔖 *JID/LID:* ${jid.split('@')[0]}` }, { quoted: msg })
            } else {

                const [result] = await sock.onWhatsApp(alvoNumero + '@s.whatsapp.net')
                if (result && result.exists) {
                    const jid = result.jid
                    const lid = jid.split('@')[0]
                    await sock.sendMessage(from, {
                        text: `⚠️ *Usuário fora do grupo*\n\n📱 *Número:* ${alvoNumero}\n🔖 *ID:* ${lid}\n\n_Use este ID para configurações._`
                    }, { quoted: msg })
                } else {
                    await sock.sendMessage(from, { text: '❌ Usuário não encontrado no WhatsApp.' }, { quoted: msg })
                }
            }
        } catch (err) {
            await sock.sendMessage(from, { text: '❌ Erro ao buscar ID.' }, { quoted: msg })
        }
        return true
    }

    if (text === config.prefix + 'antistatus') {
        const cfg = loadConfig()
        const status = cfg[from]?.antistatus ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `🛡️ *ANTI-STATUS*\n\nStatus: ${status}\n\n_Para alterar use:_\n.antistatus on\n.antistatus off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antistatus on') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antistatus = true
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '✅ *Anti-Status ativado!*\n\nMembros que marcarem/compartilharem status no grupo serão banidos imediatamente.' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antistatus off') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antistatus = false
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '❌ *Anti-Status desativado!*' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'detectardoc') {
        const cfg = loadConfig()
        const status = cfg[from]?.detectardoc !== false ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `📄 *LEITURA DE DOCUMENTOS (OCR)*\n\nStatus: ${status}\n\n_Para alterar use:_\n.detectardoc on\n.detectardoc off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'detectardoc on') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].detectardoc = true
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '📄 *Leitura de Documentos ativada!*\n\nO bot procurará recibos em arquivos PDF e imagens enviadas como documento.' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'detectardoc off') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].detectardoc = false
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '❌ *Leitura de Documentos desativada!*\n\nO bot irá ignorar arquivos PDF e documentos enviados.' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antifurtivo') {
        const cfg = loadConfig()
        const status = cfg[from]?.antifurtivo ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `🛡️ *ANTI-FURTIVO*\n\nStatus: ${status}\n\n_Para alterar use:_\n.antifurtivo on\n.antifurtivo off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antifurtivo on') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antifurtivo = true
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '🛡️ *Anti-Furtivo ativado!*\n\nLinks suspeitos e redirecionamentos serão bloqueados.' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antifurtivo off') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antifurtivo = false
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '❌ *Anti-Furtivo desativado!*' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antipalavrao') {
        const cfg = loadConfig()
        const status = cfg[from]?.antipalavrao ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        await sock.sendMessage(from, { text: `🤬 *ANTI-PALAVRÃO*\n\nStatus: ${status}\n\n_Para alterar use:_\n.antipalavrao on\n.antipalavrao off` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antipalavrao on') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antipalavrao = true
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '🤬 *Anti-Palavrão ativado!*\n\nUsuários com linguagem imprópria receberão avisos (3 strikes).' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antipalavrao off') {
        if (!isAdminUser) return await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg }), true
        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antipalavrao = false
        saveConfig(cfg)
        await sock.sendMessage(from, { text: '❌ *Anti-Palavrão desativado!*' }, { quoted: msg })
        return true
    }

    return false
}
