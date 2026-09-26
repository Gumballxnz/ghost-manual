const config = require('../../../data/config.json')
const configManager = require('../../utils/configManager')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys.js')
const { avisosStore } = require('../../utils/firebaseDataLayer')

function loadAvisos() {
    return avisosStore.loadSync() || {}
}

function saveAvisos(data) {
    avisosStore.save(data)
}

function obterBotNumbers(sock) {
    const nums = new Set()
    const myId = sock?.user?.id
    if (myId) {
        nums.add(myId.split(':')[0].split('@')[0].replace(/\D/g, ''))
    }
    if (config.ownerNumber) {
        nums.add(String(config.ownerNumber).replace(/\D/g, ''))
    }
    if (config.numeroDono) {
        nums.add(String(config.numeroDono).replace(/\D/g, ''))
    }
    return nums
}

/**
 * Middleware para processamento do Anti-Foto antes do OCR.
 * Executa exclusão da foto, advertência (strikes 1 e 2) e ban no 3º strike.
 */
async function processarAntiFoto(sock, msg, from, sender) {
    try {
        if (!from || !from.endsWith('@g.us')) return false
        if (msg.key?.fromMe) return false

        const groupConfig = configManager.loadGroupConfig()
        const isAtivo = groupConfig[from]?.antifoto === true || groupConfig[from]?.antiFoto === true
        if (!isAtivo) return false

        const messageContent = msg.message?.ephemeralMessage?.message ||
                               msg.message?.viewOnceMessage?.message ||
                               msg.message?.viewOnceMessageV2?.message ||
                               msg.message

        if (!messageContent?.imageMessage) return false

        // Blindagem contra imunidades: bot e donos
        const senderNum = String(sender || '').split('@')[0].split(':')[0].replace(/\D/g, '')
        const botNumbers = obterBotNumbers(sock)
        if (botNumbers.has(senderNum)) return false

        // Imunidade para administradores reais e dono
        const isOwner = isOwnerCheck(sender, msg)
        if (isOwner) return false

        let isAdminUser = false
        try {
            isAdminUser = await checkIsAdmin(sock, from, sender)
        } catch { }
        if (isAdminUser) return false

        console.log(`[ANTI-FOTO] 📸 Imagem detectada de @${senderNum} em grupo com anti-foto ativo (${from}). Apagando...`)

        // 1. Apagar mensagem imediatamente
        let apagou = false
        try {
            await sock.sendMessage(from, { delete: msg.key })
            apagou = true
        } catch (errDel) {
            console.error('[ANTI-FOTO] Erro ao deletar imagem:', errDel.message)
            try {
                const deleteKey = {
                    remoteJid: from,
                    fromMe: false,
                    id: msg.key.id,
                    participant: msg.key.participant || sender
                }
                await sock.sendMessage(from, { delete: deleteKey })
                apagou = true
            } catch { }
        }

        // 2. Sistema de Avisos / Strikes
        const avisos = loadAvisos()
        if (!avisos.fotos) avisos.fotos = {}
        if (!avisos.fotos[from]) avisos.fotos[from] = {}
        if (!avisos.fotos[from][sender]) avisos.fotos[from][sender] = 0

        avisos.fotos[from][sender]++
        const strike = avisos.fotos[from][sender]
        saveAvisos(avisos)

        const mention = [sender]

        // 3. Punição baseada nos strikes
        if (strike >= 3) {
            try {
                await sock.groupParticipantsUpdate(from, [sender], 'remove')
                const cardBan = [
                    '╭┈⊰ 🚫 『 *BANIMENTO - ANTI-FOTO* 』',
                    '┊',
                    `┊👤 *Infrator:* @${senderNum}`,
                    '┊🚫 *Motivo:* Envio proibido de fotos (3 avisos)',
                    '┊⚖️ *Ação:* Removido do grupo!',
                    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
                ].join('\n')

                await sock.sendMessage(from, { text: cardBan, mentions: mention })

                delete avisos.fotos[from][sender]
                saveAvisos(avisos)
            } catch (errRem) {
                console.error('[ANTI-FOTO] Erro ao remover usuário:', errRem.message)
                await sock.sendMessage(from, {
                    text: `⚠️ @${senderNum} atingiu o 3º aviso de foto, mas não consegui removê-lo (o bot é administrador?).`,
                    mentions: mention
                })
            }
        } else if (strike === 1) {
            const cardAviso1 = [
                '╭┈⊰ ⚠️ 『 *AVISO - ANTI-FOTO (1/3)* 』',
                '┊',
                `┊👤 *Usuário:* @${senderNum}`,
                '┊🚫 *Infração:* O envio de fotos/imagens é proibido neste grupo!',
                `┊📢 *Status:* Sua foto foi apagada automaticamente.${apagou ? '' : ' (Falha ao apagar - bot é admin?)'}`,
                '┊⚠️ *Próximo envio:* 2º aviso! (Com 3 avisos = BAN)',
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')

            await sock.sendMessage(from, { text: cardAviso1, mentions: mention })
        } else if (strike === 2) {
            const cardAviso2 = [
                '╭┈⊰ 🚨 『 *ÚLTIMO AVISO - ANTI-FOTO (2/3)* 』',
                '┊',
                `┊👤 *Usuário:* @${senderNum}`,
                '┊🚫 *Infração:* O envio de fotos/imagens é proibido neste grupo!',
                `┊📢 *Status:* Sua foto foi apagada automaticamente.${apagou ? '' : ' (Falha ao apagar - bot é admin?)'}`,
                '┊🚨 *ATENÇÃO:* Se você enviar mais 1 foto, será BANIDO IMEDIATAMENTE!',
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')

            await sock.sendMessage(from, { text: cardAviso2, mentions: mention })
        }

        return true
    } catch (err) {
        console.error('[ANTI-FOTO] Erro no processamento:', err)
        return false
    }
}

/**
 * Comando administrativo .antifoto
 */
async function antifotoCommand(sock, msg, from, sender, text) {
    const { getPrefixForChat } = require('../../utils/configManager')
    const prefix = getPrefixForChat ? getPrefixForChat(from) : config.prefix
    const lower = text.trim().toLowerCase()

    if (!lower.startsWith(prefix + 'antifoto')) return false

    const isGroup = from.endsWith('@g.us')
    const reply = (texto, mentions = []) => sock.sendMessage(from, { text: texto, mentions }, { quoted: msg })

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
        await reply('❌ Apenas administradores do grupo podem configurar o Anti-Foto!')
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}

    const args = text.trim().split(/\s+/)
    const subCmd = args[1]?.toLowerCase()

    const userName = msg.pushName || 'Administrador'

    if (!subCmd || subCmd === 'ajuda' || subCmd === 'help') {
        const isAtivo = groupConfig[from].antifoto === true || groupConfig[from].antiFoto === true
        const statusTexto = isAtivo ? '🟢 ATIVADO' : '🔴 DESATIVADO'

        const header = [
            '╭┈⊰ 🛡️ 『 *SISTEMA ANTI-FOTO* 』',
            `┊Olá, ${userName}!`,
            `┊Status Atual: *${statusTexto}*`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco = [
            '╭┈❁ *⚙️ COMANDOS DISPONÍVEIS*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}antifoto on ➔ Ativar bloqueio de fotos`,
            `┊•.̇𖥨֗👻⭟${prefix}antifoto off ➔ Desativar bloqueio de fotos`,
            `┊•.̇𖥨֗👻⭟${prefix}antifoto status ➔ Ver status e regras`,
            `┊•.̇𖥨֗👻⭟${prefix}antifoto reset @user ➔ Resetar avisos de alguém`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const footer = [
            '╭┈⊰ 🔒 *REGRAS & FUNCIONAMENTO*',
            '┊• Fotos são apagadas na hora (inclusive comprovantes).',
            '┊• 1ª foto = 1º aviso | 2ª foto = 2º aviso | 3ª foto = BAN.',
            '┊• Administradores possuem imunidade total.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply([header, '', bloco, '', footer].join('\n'))
        return true
    }

    if (subCmd === 'status') {
        const isAtivo = groupConfig[from].antifoto === true || groupConfig[from].antiFoto === true

        const cardStatus = [
            '╭┈⊰ 🛡️ 『 *STATUS DO ANTI-FOTO* 』',
            '┊',
            `┊•.̇𖥨֗📸⭟ *Proteção:* ${isAtivo ? '🟢 ATIVADA' : '🔴 DESATIVADA'}`,
            '┊•.̇𖥨֗🗑️⭟ *Ação:* Exclusão imediata da foto.',
            '┊•.̇𖥨֗⚖️⭟ *Regra de Punição:* 2 advertências e BAN no 3º envio.',
            '┊•.̇𖥨֗🔒⭟ *Imunidade:* Administradores e Dono liberados.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardStatus)
        return true
    }

    if (subCmd === 'on' || subCmd === 'ativar') {
        groupConfig[from].antifoto = true
        configManager.saveGroupConfig(groupConfig)

        try { await sock.sendMessage(from, { react: { text: '🛡️', key: msg.key } }) } catch { }

        const cardAtivado = [
            '╭┈⊰ 📸 『 *ANTI-FOTO ATIVADO* 』',
            '┊',
            '┊✅ O bloqueio de fotos agora está *ATIVADO* neste grupo!',
            '┊🗑️ Qualquer imagem enviada por membros será apagada na hora.',
            '┊🚨 Membros reincidentes receberão avisos e serão banidos no 3º envio.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardAtivado)
        return true
    }

    if (subCmd === 'off' || subCmd === 'desativar' || subCmd === 'of') {
        groupConfig[from].antifoto = false
        configManager.saveGroupConfig(groupConfig)

        try { await sock.sendMessage(from, { react: { text: '⚪', key: msg.key } }) } catch { }

        const cardDesativado = [
            '╭┈⊰ 📸 『 *ANTI-FOTO DESATIVADO* 』',
            '┊',
            '┊⚪ O bloqueio de fotos foi *DESATIVADO* neste grupo.',
            '┊Imagens e comprovantes voltarão a ser processados normalmente.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardDesativado)
        return true
    }

    if (subCmd === 'reset') {
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        const avisos = loadAvisos()

        if (args[2]?.toLowerCase() === 'all' || args[2]?.toLowerCase() === 'todos') {
            if (avisos.fotos?.[from]) {
                avisos.fotos[from] = {}
                saveAvisos(avisos)
            }
            await reply('✅ Todos os avisos de fotos deste grupo foram resetados!')
            return true
        }

        if (mentions.length === 0) {
            await reply(`❌ Mencione o usuário que deseja resetar!\n\nExemplo: ${prefix}antifoto reset @usuario\nOu: ${prefix}antifoto reset all`)
            return true
        }

        if (avisos.fotos?.[from]) {
            for (const mention of mentions) {
                delete avisos.fotos[from][mention]
            }
            saveAvisos(avisos)
        }

        await reply(`✅ Avisos de foto resetados para o(s) usuário(s) mencionado(s)!`, mentions)
        return true
    }

    await reply(`❌ Subcomando inválido! Use *${prefix}antifoto* para ver as opções.`)
    return true
}

antifotoCommand.processarAntiFoto = processarAntiFoto
antifotoCommand.antifotoCommand = antifotoCommand

module.exports = antifotoCommand
