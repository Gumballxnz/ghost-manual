const config = require('../../../data/config.json')
const fs = require('fs')
const path = require('path')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys')

const configPath = path.join(__dirname, '../../../data/groupConfig.json')
const avisosPath = path.join(__dirname, '../../../avisos.json')
const configManager = require('../../utils/configManager')

const defaultPalavroes = ['vsfr', 'vai a merda', 'caralho', 'mrd', 'fds', 'fodese', 'foda-se', 'filho da puta', 'puta', 'merda', 'fdp', 'crlh', 'pqp', 'cona', 'vai a merda vc']

function loadConfig() {
    return configManager.loadGroupConfig()
}

function saveConfig() {
    configManager.saveGroupConfig(true)
}

function obterPalavras(cfg, from) {
    if (!cfg[from]) cfg[from] = {}
    if (cfg[from].palavrasProibidas === undefined) {
        cfg[from].palavrasProibidas = [...defaultPalavroes]
        saveConfig(cfg)
    }
    return cfg[from].palavrasProibidas
}

const { avisosStore } = require('../../utils/firebaseDataLayer')

function loadAvisos() {
    return avisosStore.loadSync() || {}
}

function saveAvisos(data) {
    avisosStore.save(data)
}

module.exports = async (sock, msg, from, sender, text) => {
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''

    const isOwner = isOwnerCheck(sender, msg)

    let adminStatus = isOwner
    if (!isOwner) {
        adminStatus = await checkIsAdmin(sock, from, sender)
    }

    const isAdminUser = adminStatus

    if (text === config.prefix + 'antipalavrao') {
        const cfg = loadConfig()
        const grupoConfig = cfg[from] || {}
        const status = grupoConfig.antipalavrao ? '✅ Ativado' : '❌ Desativado'
        const palavras = obterPalavras(cfg, from)

        await sock.sendMessage(from, {
            text: `⚙️ *Anti-Palavrão*\n\nStatus: ${status}\nPalavras proibidas: ${palavras.length}\n\n*Comandos:*\n• .antipalavrao on/off\n• .antipalavrao dd <palavra>\n• .antipalavrao del <palavra>\n• .antipalavrao list`
        }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antipalavrao on') {
        if (!isAdminUser) {
            await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg })
            return true
        }

        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antipalavrao = true
        saveConfig(cfg)

        await sock.sendMessage(from, { text: '✅ *Anti-Palavrão ativado!*\n\n⚠️ Certifique-se que o bot é admin do grupo para poder apagar mensagens e remover usuários.' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antipalavrao off' || text === config.prefix + 'antipalavrao of') {
        if (!isAdminUser) {
            await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg })
            return true
        }

        const cfg = loadConfig()
        if (!cfg[from]) cfg[from] = {}
        cfg[from].antipalavrao = false
        saveConfig(cfg)

        await sock.sendMessage(from, { text: '❌ *Anti-Palavrão desativado!*' }, { quoted: msg })
        return true
    }

    if (text.startsWith(config.prefix + 'antipalavrao dd ')) {
        if (!isAdminUser) {
            await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg })
            return true
        }

        const palavra = body.slice((config.prefix + 'antipalavrao dd ').length).trim().toLowerCase()
        if (!palavra) {
            await sock.sendMessage(from, { text: '❌ Informe a palavra!\n\nEx: .antipalavrao dd puta' }, { quoted: msg })
            return true
        }

        const cfg = loadConfig()
        const palavras = obterPalavras(cfg, from)

        if (palavras.includes(palavra)) {
            await sock.sendMessage(from, { text: `⚠️ "${palavra}" já está na lista.` }, { quoted: msg })
            return true
        }

        cfg[from].palavrasProibidas.push(palavra)
        saveConfig(cfg)

        await sock.sendMessage(from, { text: `✅ Palavra proibida adicionada: "${palavra}"` }, { quoted: msg })
        return true
    }

    if (text.startsWith(config.prefix + 'antipalavrao del ')) {
        if (!isAdminUser) {
            await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg })
            return true
        }

        const palavra = body.slice((config.prefix + 'antipalavrao del ').length).trim().toLowerCase()

        const cfg = loadConfig()
        if (!cfg[from]?.palavrasProibidas?.includes(palavra)) {
            await sock.sendMessage(from, { text: `❌ "${palavra}" não está na lista.` }, { quoted: msg })
            return true
        }

        cfg[from].palavrasProibidas = cfg[from].palavrasProibidas.filter(p => p !== palavra)
        saveConfig(cfg)

        await sock.sendMessage(from, { text: `🗑️ Palavra removida: "${palavra}"` }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'antipalavrao list') {
        const cfg = loadConfig()
        const palavras = obterPalavras(cfg, from)

        if (palavras.length === 0) {
            await sock.sendMessage(from, { text: '📋 *Palavras Proibidas:*\n\n_Nenhuma palavra cadastrada._' }, { quoted: msg })
            return true
        }

        let lista = '📋 *Palavras Proibidas:*\n\n'
        palavras.forEach((p, i) => {
            lista += `${i + 1}. ${p}\n`
        })

        await sock.sendMessage(from, { text: lista }, { quoted: msg })
        return true
    }

    if (text.startsWith(config.prefix + 'antipalavrao reset')) {
        if (!isAdminUser) {
            await sock.sendMessage(from, { text: '❌ Apenas admins.' }, { quoted: msg })
            return true
        }

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        if (mentions.length === 0) {
            await sock.sendMessage(from, { text: '❌ Mencione o usuário!\n\nEx: .antipalavrao reset @user' }, { quoted: msg })
            return true
        }

        const avisos = loadAvisos()
        for (const mention of mentions) {
            if (avisos[from]?.[mention]) {
                avisos[from][mention] = 0
            }
        }
        saveAvisos(avisos)

        await sock.sendMessage(from, { text: '✅ Avisos resetados para o(s) usuário(s) mencionado(s).' }, { quoted: msg })
        return true
    }

    if (from.endsWith('@g.us') && !text.startsWith(config.prefix)) {
        const cfg = loadConfig()
        if (!cfg[from]?.antipalavrao) return false

        const palavras = obterPalavras(cfg, from)
        if (palavras.length === 0) return false

        const mensagem = body.toLowerCase()
        const palavraEncontrada = palavras.find(p => mensagem.includes(p))

        if (palavraEncontrada && !isAdminUser) {
            const numero = sender.split('@')[0]

            let apagou = false
            try {
                await sock.sendMessage(from, { delete: msg.key })
                apagou = true
            } catch (err) {
                console.error('[ANTIPALAVRAO] Erro ao apagar:', err.message)
            }

            const avisos = loadAvisos()
            if (!avisos[from]) avisos[from] = {}
            if (!avisos[from][sender]) avisos[from][sender] = 0

            avisos[from][sender]++
            const numAviso = avisos[from][sender]
            saveAvisos(avisos)

            if (numAviso >= 3) {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], 'remove')
                    await sock.sendMessage(from, {
                        text: `🚫 @${numero} foi removido por excesso de palavrões! (3 avisos)`,
                        mentions: [sender]
                    })

                    avisos[from][sender] = 0
                    saveAvisos(avisos)
                } catch (err) {
                    console.error('[ANTIPALAVRAO] Erro ao remover:', err.message)
                    await sock.sendMessage(from, {
                        text: `⚠️ Não consegui remover @${numero}. Verifique se o bot é admin do grupo.`,
                        mentions: [sender]
                    })
                }
            } else {
                let proximoAviso = ''
                if (numAviso === 1) proximoAviso = 'Próximo = ⚠️ Segundo aviso'
                else if (numAviso === 2) proximoAviso = 'Próximo = 🚨 BAN!'

                let msgTexto = `⚠️ *${numAviso}º aviso* para @${numero}\n🚫 Palavrão detectado!${apagou ? '' : '\n\n⚠️ Não consegui apagar a mensagem (bot não é admin?)'}\n\n${proximoAviso}`

                await sock.sendMessage(from, {
                    text: msgTexto,
                    mentions: [sender]
                })
            }

            return true
        }
    }

    return false
}
