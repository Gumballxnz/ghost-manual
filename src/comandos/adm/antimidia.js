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
 * Middleware genérico para proteção de mídias (Áudio, Vídeo, Documento)
 * @param {string} tipo 'audio' | 'video' | 'doc'
 * @param {string} nomeLegivel 'Áudios/Mensagens de Voz' | 'Vídeos' | 'Arquivos/Documentos'
 * @param {string} emoji '🎙️' | '🎥' | '📄'
 */
async function processarBloqueioMidia(sock, msg, from, sender, tipo, nomeLegivel, emoji) {
    try {
        if (!from || !from.endsWith('@g.us')) return false
        if (msg.key?.fromMe) return false

        const groupConfig = configManager.loadGroupConfig()
        const configKey = 'anti' + tipo
        const isAtivo = groupConfig[from]?.[configKey] === true || groupConfig[from]?.[`anti${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`] === true
        if (!isAtivo) return false

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

        console.log(`[ANTI-${tipo.toUpperCase()}] ${emoji} Mídia proibida detectada de @${senderNum} em grupo com proteção ativa (${from}). Apagando...`)

        // 1. Apagar mensagem imediatamente
        let apagou = false
        try {
            await sock.sendMessage(from, { delete: msg.key })
            apagou = true
        } catch (errDel) {
            console.error(`[ANTI-${tipo.toUpperCase()}] Erro ao deletar mídia:`, errDel.message)
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
        const chaveAvisos = 'midia_' + tipo
        if (!avisos[chaveAvisos]) avisos[chaveAvisos] = {}
        if (!avisos[chaveAvisos][from]) avisos[chaveAvisos][from] = {}
        if (!avisos[chaveAvisos][from][sender]) avisos[chaveAvisos][from][sender] = 0

        avisos[chaveAvisos][from][sender]++
        const strike = avisos[chaveAvisos][from][sender]
        saveAvisos(avisos)

        const mention = [sender]
        const tagTipo = `ANTI-${tipo.toUpperCase()}`

        // 3. Punição baseada nos strikes
        if (strike >= 3) {
            try {
                await sock.groupParticipantsUpdate(from, [sender], 'remove')
                const cardBan = [
                    `╭┈⊰ 🚫 『 *BANIMENTO - ${tagTipo}* 』`,
                    '┊',
                    `┊👤 *Infrator:* @${senderNum}`,
                    `┊🚫 *Motivo:* Envio proibido de ${nomeLegivel} (3 avisos)`,
                    '┊⚖️ *Ação:* Removido do grupo!',
                    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
                ].join('\n')

                await sock.sendMessage(from, { text: cardBan, mentions: mention })

                delete avisos[chaveAvisos][from][sender]
                saveAvisos(avisos)
            } catch (errRem) {
                console.error(`[ANTI-${tipo.toUpperCase()}] Erro ao remover usuário:`, errRem.message)
                await sock.sendMessage(from, {
                    text: `⚠️ @${senderNum} atingiu o 3º aviso de ${nomeLegivel}, mas não consegui removê-lo (o bot é administrador?).`,
                    mentions: mention
                })
            }
        } else if (strike === 1) {
            const cardAviso1 = [
                `╭┈⊰ ⚠️ 『 *AVISO - ${tagTipo} (1/3)* 』`,
                '┊',
                `┊👤 *Usuário:* @${senderNum}`,
                `┊🚫 *Infração:* O envio de ${nomeLegivel} é proibido neste grupo!`,
                `┊📢 *Status:* Sua mensagem foi apagada automaticamente.${apagou ? '' : ' (Falha ao apagar - bot é admin?)'}`,
                '┊⚠️ *Próximo envio:* 2º aviso! (Com 3 avisos = BAN)',
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')

            await sock.sendMessage(from, { text: cardAviso1, mentions: mention })
        } else if (strike === 2) {
            const cardAviso2 = [
                `╭┈⊰ 🚨 『 *ÚLTIMO AVISO - ${tagTipo} (2/3)* 』`,
                '┊',
                `┊👤 *Usuário:* @${senderNum}`,
                `┊🚫 *Infração:* O envio de ${nomeLegivel} é proibido neste grupo!`,
                `┊📢 *Status:* Sua mensagem foi apagada automaticamente.${apagou ? '' : ' (Falha ao apagar - bot é admin?)'}`,
                `┊🚨 *ATENÇÃO:* Se você enviar mais 1 vez, será BANIDO IMEDIATAMENTE!`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')

            await sock.sendMessage(from, { text: cardAviso2, mentions: mention })
        }

        return true
    } catch (err) {
        console.error(`[ANTI-${tipo.toUpperCase()}] Erro no processamento:`, err)
        return false
    }
}

async function processarAntiAudio(sock, msg, from, sender) {
    const messageContent = msg.message?.ephemeralMessage?.message ||
                           msg.message?.viewOnceMessage?.message ||
                           msg.message?.viewOnceMessageV2?.message ||
                           msg.message
    if (!messageContent?.audioMessage) return false
    return await processarBloqueioMidia(sock, msg, from, sender, 'audio', 'áudio ou notas de voz', '🎙️')
}

async function processarAntiVideo(sock, msg, from, sender) {
    const messageContent = msg.message?.ephemeralMessage?.message ||
                           msg.message?.viewOnceMessage?.message ||
                           msg.message?.viewOnceMessageV2?.message ||
                           msg.message
    if (!messageContent?.videoMessage) return false
    return await processarBloqueioMidia(sock, msg, from, sender, 'video', 'vídeos', '🎥')
}

async function processarAntiDoc(sock, msg, from, sender) {
    const messageContent = msg.message?.ephemeralMessage?.message ||
                           msg.message?.viewOnceMessage?.message ||
                           msg.message?.viewOnceMessageV2?.message ||
                           msg.message
    if (!messageContent?.documentMessage) return false
    return await processarBloqueioMidia(sock, msg, from, sender, 'doc', 'documentos ou arquivos', '📄')
}

/**
 * Handler administrativo reutilizável para .antiaudio, .antivideo, .antidoc
 */
async function comandoAdminMidia(sock, msg, from, sender, text, tipo, nomeComando, nomeLegivel, emoji) {
    const { getPrefixForChat } = require('../../utils/configManager')
    const prefix = getPrefixForChat ? getPrefixForChat(from) : config.prefix
    const lower = text.trim().toLowerCase()

    const cmdAliases = [prefix + nomeComando]
    if (tipo === 'doc') {
        cmdAliases.push(prefix + 'antiarquivo')
        cmdAliases.push(prefix + 'antidocumento')
    }

    const matchedCmd = cmdAliases.find(c => lower.startsWith(c))
    if (!matchedCmd) return false

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
        await reply(`❌ Apenas administradores do grupo podem configurar o ${nomeComando}!`)
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}

    const args = text.trim().split(/\s+/)
    const subCmd = args[1]?.toLowerCase()
    const configKey = 'anti' + tipo
    const userName = msg.pushName || 'Administrador'
    const tagTitulo = `ANTI-${tipo.toUpperCase()}`

    if (!subCmd || subCmd === 'ajuda' || subCmd === 'help') {
        const isAtivo = groupConfig[from][configKey] === true || groupConfig[from][`anti${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`] === true
        const statusTexto = isAtivo ? '🟢 ATIVADO' : '🔴 DESATIVADO'

        const header = [
            `╭┈⊰ 🛡️ 『 *SISTEMA ${tagTitulo}* 』`,
            `┊Olá, ${userName}!`,
            `┊Status Atual: *${statusTexto}*`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco = [
            '╭┈❁ *⚙️ COMANDOS DISPONÍVEIS*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}${nomeComando} on ➔ Ativar bloqueio de ${nomeLegivel}`,
            `┊•.̇𖥨֗👻⭟${prefix}${nomeComando} off ➔ Desativar bloqueio`,
            `┊•.̇𖥨֗👻⭟${prefix}${nomeComando} status ➔ Ver status e regras`,
            `┊•.̇𖥨֗👻⭟${prefix}${nomeComando} reset @user ➔ Resetar avisos de alguém`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const footer = [
            '╭┈⊰ 🔒 *REGRAS & FUNCIONAMENTO*',
            `┊• ${emoji} Mensagens de ${nomeLegivel} são apagadas na hora.`,
            '┊• 1º envio = 1º aviso | 2º envio = 2º aviso | 3º envio = BAN.',
            '┊• Administradores possuem imunidade total.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply([header, '', bloco, '', footer].join('\n'))
        return true
    }

    if (subCmd === 'status') {
        const isAtivo = groupConfig[from][configKey] === true || groupConfig[from][`anti${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`] === true

        const cardStatus = [
            `╭┈⊰ 🛡️ 『 *STATUS DO ${tagTitulo}* 』`,
            '┊',
            `┊•.̇𖥨֗${emoji}⭟ *Proteção:* ${isAtivo ? '🟢 ATIVADA' : '🔴 DESATIVADA'}`,
            `┊•.̇𖥨֗🗑️⭟ *Ação:* Exclusão imediata de ${nomeLegivel}.`,
            '┊•.̇𖥨֗⚖️⭟ *Regra de Punição:* 2 advertências e BAN no 3º envio.',
            '┊•.̇𖥨֗🔒⭟ *Imunidade:* Administradores e Dono liberados.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardStatus)
        return true
    }

    if (subCmd === 'on' || subCmd === 'ativar') {
        groupConfig[from][configKey] = true
        configManager.saveGroupConfig(groupConfig)

        try { await sock.sendMessage(from, { react: { text: '🛡️', key: msg.key } }) } catch { }

        const cardAtivado = [
            `╭┈⊰ ${emoji} 『 *${tagTitulo} ATIVADO* 』`,
            '┊',
            `┊✅ O bloqueio de ${nomeLegivel} agora está *ATIVADO* neste grupo!`,
            '┊🗑️ Qualquer envio por membros comuns será apagado na hora.',
            '┊🚨 Membros reincidentes receberão avisos e serão banidos no 3º envio.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardAtivado)
        return true
    }

    if (subCmd === 'off' || subCmd === 'desativar' || subCmd === 'of') {
        groupConfig[from][configKey] = false
        configManager.saveGroupConfig(groupConfig)

        try { await sock.sendMessage(from, { react: { text: '⚪', key: msg.key } }) } catch { }

        const cardDesativado = [
            `╭┈⊰ ${emoji} 『 *${tagTitulo} DESATIVADO* 』`,
            '┊',
            `┊⚪ O bloqueio de ${nomeLegivel} foi *DESATIVADO* neste grupo.`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardDesativado)
        return true
    }

    if (subCmd === 'reset') {
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        const avisos = loadAvisos()
        const chaveAvisos = 'midia_' + tipo

        if (args[2]?.toLowerCase() === 'all' || args[2]?.toLowerCase() === 'todos') {
            if (avisos[chaveAvisos]?.[from]) {
                avisos[chaveAvisos][from] = {}
                saveAvisos(avisos)
            }
            await reply(`✅ Todos os avisos de ${nomeLegivel} deste grupo foram resetados!`)
            return true
        }

        if (mentions.length === 0) {
            await reply(`❌ Mencione o usuário que deseja resetar!\n\nExemplo: ${prefix}${nomeComando} reset @usuario\nOu: ${prefix}${nomeComando} reset all`)
            return true
        }

        if (avisos[chaveAvisos]?.[from]) {
            for (const mention of mentions) {
                delete avisos[chaveAvisos][from][mention]
            }
            saveAvisos(avisos)
        }

        await reply(`✅ Avisos de ${nomeLegivel} resetados para o(s) usuário(s) mencionado(s)!`, mentions)
        return true
    }

    await reply(`❌ Subcomando inválido! Use *${prefix}${nomeComando}* para ver as opções.`)
    return true
}

async function antiaudioCommand(sock, msg, from, sender, text) {
    return await comandoAdminMidia(sock, msg, from, sender, text, 'audio', 'antiaudio', 'áudio ou notas de voz', '🎙️')
}

async function antivideoCommand(sock, msg, from, sender, text) {
    return await comandoAdminMidia(sock, msg, from, sender, text, 'video', 'antivideo', 'vídeos', '🎥')
}

async function antidocCommand(sock, msg, from, sender, text) {
    return await comandoAdminMidia(sock, msg, from, sender, text, 'doc', 'antidoc', 'documentos ou arquivos', '📄')
}

async function antimidiaMasterCommand(sock, msg, from, sender, text) {
    const { getPrefixForChat } = require('../../utils/configManager')
    const prefix = getPrefixForChat ? getPrefixForChat(from) : config.prefix
    const lower = text.trim().toLowerCase()

    if (!lower.startsWith(prefix + 'antimidia') && !lower.startsWith(prefix + 'antimedia')) return false

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
        await reply('❌ Apenas administradores do grupo podem configurar o Anti-Mídia!')
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}

    const args = text.trim().split(/\s+/)
    const subCmd = args[1]?.toLowerCase()
    const userName = msg.pushName || 'Administrador'

    if (!subCmd || subCmd === 'ajuda' || subCmd === 'help') {
        const fotoOn = !!groupConfig[from].antifoto
        const audioOn = !!groupConfig[from].antiaudio
        const videoOn = !!groupConfig[from].antivideo
        const docOn = !!groupConfig[from].antidoc
        const allOn = fotoOn && audioOn && videoOn && docOn

        const header = [
            '╭┈⊰ 🛡️ 『 *SISTEMA ANTI-MÍDIA GERAL* 』',
            `┊Olá, ${userName}!`,
            `┊Status Geral: *${allOn ? '🟢 TODAS ATIVADAS' : (fotoOn || audioOn || videoOn || docOn ? '🟡 PARCIAL' : '🔴 TODAS DESATIVADAS')}*`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco = [
            '╭┈❁ *⚙️ CONTROLE GLOBAL*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}antimidia on ➔ Ativar TODAS as proteções de mídia`,
            `┊•.̇𖥨֗👻⭟${prefix}antimidia off ➔ Desativar TODAS as proteções`,
            `┊•.̇𖥨֗👻⭟${prefix}antimidia status ➔ Ver painel completo`,
            `┊•.̇𖥨֗👻⭟${prefix}antimidia reset ➔ Resetar avisos de todas as mídias`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const individual = [
            '╭┈❁ *🎯 MÍDIAS COBERTAS*',
            '┊',
            `┊📸 Fotos: ${fotoOn ? '🟢 ON' : '🔴 OFF'} (${prefix}antifoto)`,
            `┊🎙️ Áudios: ${audioOn ? '🟢 ON' : '🔴 OFF'} (${prefix}antiaudio)`,
            `┊🎥 Vídeos: ${videoOn ? '🟢 ON' : '🔴 OFF'} (${prefix}antivideo)`,
            `┊📄 Documentos: ${docOn ? '🟢 ON' : '🔴 OFF'} (${prefix}antidoc)`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const footer = [
            '╭┈⊰ 🔒 *REGRAS & IMUNIDADE*',
            '┊• Exclusão imediata da mídia sem leitura.',
            '┊• 1º envio: Aviso 1/3 | 2º envio: Aviso 2/3 | 3º envio: BAN.',
            '┊• Administradores e donos possuem imunidade total.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply([header, '', bloco, '', individual, '', footer].join('\n'))
        return true
    }

    if (subCmd === 'status') {
        const fotoOn = !!groupConfig[from].antifoto
        const audioOn = !!groupConfig[from].antiaudio
        const videoOn = !!groupConfig[from].antivideo
        const docOn = !!groupConfig[from].antidoc

        const cardStatus = [
            '╭┈⊰ 🛡️ 『 *STATUS COMPLETO ANTI-MÍDIA* 』',
            '┊',
            `┊•.̇𖥨֗📸⭟ *Anti-Foto:* ${fotoOn ? '🟢 ATIVADO' : '🔴 DESATIVADO'}`,
            `┊•.̇𖥨֗🎙️⭟ *Anti-Áudio:* ${audioOn ? '🟢 ATIVADO' : '🔴 DESATIVADO'}`,
            `┊•.̇𖥨֗🎥⭟ *Anti-Vídeo:* ${videoOn ? '🟢 ATIVADO' : '🔴 DESATIVADO'}`,
            `┊•.̇𖥨֗📄⭟ *Anti-Documento:* ${docOn ? '🟢 ATIVADO' : '🔴 DESATIVADO'}`,
            '┊',
            '┊•.̇𖥨֗⚖️⭟ *Punição:* 2 advertências e BAN no 3º envio.',
            '┊•.̇𖥨֗🔒⭟ *Imunidade:* Administradores e Dono 100% liberados.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardStatus)
        return true
    }

    if (subCmd === 'on' || subCmd === 'ativar') {
        groupConfig[from].antifoto = true
        groupConfig[from].antiaudio = true
        groupConfig[from].antivideo = true
        groupConfig[from].antidoc = true
        configManager.saveGroupConfig(groupConfig)

        try { await sock.sendMessage(from, { react: { text: '🛡️', key: msg.key } }) } catch { }

        const cardAtivado = [
            '╭┈⊰ 🛡️ 『 *ANTI-MÍDIA GLOBAL ATIVADO* 』',
            '┊',
            '┊✅ Todas as proteções de mídia foram *ATIVADAS* com sucesso!',
            '┊',
            '┊🚫 *Bloqueios ativos para membros comuns:*',
            '┊  • 📸 Fotos e Imagens',
            '┊  • 🎙️ Áudios e Mensagens de Voz',
            '┊  • 🎥 Vídeos',
            '┊  • 📄 Documentos e Arquivos (PDFs/DOCs)',
            '┊',
            '┊🗑️ Qualquer mídia enviada será apagada na hora.',
            '┊🚨 Reincidências geram avisos até o BAN automático no 3º strike.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardAtivado)
        return true
    }

    if (subCmd === 'off' || subCmd === 'desativar' || subCmd === 'of') {
        groupConfig[from].antifoto = false
        groupConfig[from].antiaudio = false
        groupConfig[from].antivideo = false
        groupConfig[from].antidoc = false
        configManager.saveGroupConfig(groupConfig)

        try { await sock.sendMessage(from, { react: { text: '⚪', key: msg.key } }) } catch { }

        const cardDesativado = [
            '╭┈⊰ ⚪ 『 *ANTI-MÍDIA GLOBAL DESATIVADO* 』',
            '┊',
            '┊⚪ Todas as proteções de mídia foram *DESATIVADAS* neste grupo.',
            '┊Membros podem enviar fotos, áudios, vídeos e documentos livremente.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await reply(cardDesativado)
        return true
    }

    if (subCmd === 'reset') {
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        const avisos = loadAvisos()

        const categorias = ['fotos', 'midia_audio', 'midia_video', 'midia_doc']

        if (args[2]?.toLowerCase() === 'all' || args[2]?.toLowerCase() === 'todos' || mentions.length === 0) {
            for (const cat of categorias) {
                if (avisos[cat]?.[from]) {
                    avisos[cat][from] = {}
                }
            }
            saveAvisos(avisos)
            await reply('✅ Todos os avisos de todas as mídias deste grupo foram resetados!')
            return true
        }

        for (const cat of categorias) {
            if (avisos[cat]?.[from]) {
                for (const mention of mentions) {
                    delete avisos[cat][from][mention]
                }
            }
        }
        saveAvisos(avisos)

        await reply('✅ Todos os avisos de mídia resetados para o(s) usuário(s) mencionado(s)!', mentions)
        return true
    }

    await reply(`❌ Subcomando inválido! Use *${prefix}antimidia* para ver o menu.`)
    return true
}

async function antimidiaMain(sock, msg, from, sender, text) {
    if (await antimidiaMasterCommand(sock, msg, from, sender, text)) return true
    if (await antiaudioCommand(sock, msg, from, sender, text)) return true
    if (await antivideoCommand(sock, msg, from, sender, text)) return true
    if (await antidocCommand(sock, msg, from, sender, text)) return true
    return false
}

antimidiaMain.processarAntiAudio = processarAntiAudio
antimidiaMain.processarAntiVideo = processarAntiVideo
antimidiaMain.processarAntiDoc = processarAntiDoc
antimidiaMain.antiaudioCommand = antiaudioCommand
antimidiaMain.antivideoCommand = antivideoCommand
antimidiaMain.antidocCommand = antidocCommand
antimidiaMain.antimidiaMasterCommand = antimidiaMasterCommand

module.exports = antimidiaMain
