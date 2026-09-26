const path = require('path')
const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck, isLeaderCheck } = require('../../utils/baileys.js')
const { mutesStore } = require('../../utils/firebaseDataLayer')

function loadMutes() {
    return mutesStore.loadSync() || {}
}

function saveMutes(mutes) {
    mutesStore.save(mutes)
}

function parsearTempo(texto) {
    if (!texto) return null
    const match = texto.match(/(\d+)\s*(s|seg|segundo|min|minuto|m|h|hora|d|dia)/i)
    if (!match) return null
    const num = parseInt(match[1])
    const unidade = match[2].toLowerCase()
    if (unidade.startsWith('s')) return num * 1000
    if (unidade.startsWith('m')) return num * 60 * 1000
    if (unidade.startsWith('h')) return num * 3600 * 1000
    if (unidade.startsWith('d')) return num * 86400 * 1000
    return null
}

module.exports = async (sock, msg, from, sender, text) => {

    if (!text.startsWith(config.prefix + 'mute') && !text.startsWith(config.prefix + 'unmute')) return false

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

    if (text.startsWith(config.prefix + 'unmute')) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
            || msg.message?.extendedTextMessage?.contextInfo?.participant
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant

        let target = null
        if (mentioned && mentioned.length > 0) {
            target = mentioned[0]
        } else if (quotedParticipant) {
            target = quotedParticipant
        }

        if (!target) {
            await reply('❌ Marque ou mencione o membro para desmutar.\n\n_Exemplo: .unmute @user_')
            return true
        }

        const mutes = loadMutes()
        if (mutes[from] && mutes[from][target]) {
            delete mutes[from][target]
            saveMutes(mutes)
            await reply(`✅ @${target.split('@')[0]} foi desmutado.`)
        } else {
            await reply(`ℹ️ @${target.split('@')[0]} não está mutado.`)
        }
        return true
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant

    let target = null
    if (mentioned && mentioned.length > 0) {
        target = mentioned[0]
    } else if (quotedParticipant) {
        target = quotedParticipant
    }

    if (!target) {
        await reply(`❌ Marque ou mencione o membro para mutar.\n\n_Exemplos:_\n${config.prefix}mute @user\n${config.prefix}mute @user 5min\n${config.prefix}mute @user 2h\n${config.prefix}unmute @user`)
        return true
    }

    if (isLeaderCheck(target)) {
        await reply('❌ Não é possível mutar o dono líder do bot!')
        return true
    }

    if (isOwnerCheck(target) && !isLeaderCheck(sender, msg)) {
        await reply('❌ Não é possível mutar um dono/subdono do bot!')
        return true
    }
    try {
        const targetIsAdmin = await checkIsAdmin(sock, from, target)
        if (targetIsAdmin) {
            await reply('❌ Não é possível mutar um administrador!')
            return true
        }
    } catch { }

    const args = text.split(/\s+/).filter(a => !a.startsWith('@') && a !== config.prefix + 'mute')
    const tempoTexto = args.join(' ')
    const duracao = parsearTempo(tempoTexto)

    const mutes = loadMutes()
    if (!mutes[from]) mutes[from] = {}

    const now = Date.now()
    mutes[from][target] = {
        mutadoPor: sender,
        mutadoEm: now,
        expiraEm: duracao ? now + duracao : null
    }
    saveMutes(mutes)

    if (duracao) {
        const minutos = Math.round(duracao / 60000)
        await reply(`🔇 @${target.split('@')[0]} foi *mutado por ${minutos > 60 ? Math.round(minutos / 60) + 'h' : minutos + 'min'}*!\n\n⚠️ Se enviar mensagem durante o mute, será *banido automaticamente*.`)
    } else {
        await reply(`🔇 @${target.split('@')[0]} foi *mutado permanentemente*!\n\n⚠️ Se enviar mensagem, será *banido automaticamente*.\n\n_Para desmutar: ${config.prefix}unmute @user_`)
    }

    return true
}

module.exports.loadMutes = loadMutes
module.exports.saveMutes = saveMutes
