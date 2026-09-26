const config = require('../../data/config.json')
const configManager = require('../utils/configManager')
const { isAdmin, isOwnerCheck, getSender, getGroupMetadataCached } = require('../utils/baileys')

// Cache em memória de quem adicionou quem nos grupos: groupId -> { [participantNum]: { addedBy: authorNum, addedAt: timestamp } }
const convitesCache = new Map()

// Cache do último comando enviado no grupo: groupId -> { timestamp: number, sender: string }
const comandosRecentes = new Map()

// Expressão regular para bots não cadastrados / expirados (Sem Aluguel / Sem Licença)
const REGEX_SEM_ALUGUEL = /(?:(?:grupo\s+)?(?:n[aã]o\s+possui|sem)\s+(?:aluguel|licen[çc]a)|grupo\s+n[aã]o\s+(?:registrado|autorizado|cadastrado|alugado)|aluguel\s+(?:vencido|expirado|pendente|inativo)|licen[çc]a\s+(?:vencida|expirada|inativa)|bot\s+(?:desativado|inativo)\s+neste\s+grupo|adquira\s+(?:sua\s+licen[çc]a|o\s+bot|seu\s+aluguel)|para\s+alugar\s+(?:esse|este)?\s*bot|per[ií]odo\s+de\s+teste\s+(?:encerrado|acabou|expirou)|renove\s+seu\s+(?:bot|aluguel)|este\s+grupo\s+n[aã]o\s+tem\s+(?:autoriza[çc][aã]o|permiss[aã]o)\s+para\s+usar\s+(?:esse|o)?\s*bot)/i

// Expressão regular para mensagens de erro/resposta típica de outros bots
const REGEX_ERRO_OUTRO_BOT = /(?:comando\s+(?:n[aã]o\s+encontrado|inv[aá]lido|desconhecido|n[aã]o\s+existe)|unknown\s+command|command\s+not\s+found|digite\s+[.!/#]\s*(?:menu|help|ajuda|comandos)|n[aã]o\s+reconhe[çc]o\s+(?:esse|o)?\s*comando|esse\s+comando\s+n[aã]o\s+est[aá]\s+dispon[ií]vel)/i

// Expressão regular para menus ou headers de status de outros bots
const REGEX_HEADER_OUTRO_BOT = /(?:(?:╭|┏|╔|━═|══)\s*.*(?:MENU|COMANDOS|PAINEL|BOT|VELOCIDADE|UPTIME)|(?:Velocidade|Ping):\s*\d+\s*(?:ms|segundos)|(?:Criador|Dono|Owner|Prefix|Prefixo):\s*@?\d+|Sistema\s+operacional:\s*\w+)/i

function registrarParticipanteAdicionado(groupId, participant, author) {
    if (!groupId || !participant) return
    const pNum = String(participant).split('@')[0].split(':')[0].replace(/\D/g, '')
    const aNum = author ? String(author).split('@')[0].split(':')[0].replace(/\D/g, '') : null
    if (!pNum) return

    if (!convitesCache.has(groupId)) {
        convitesCache.set(groupId, {})
    }
    const mapaGrupo = convitesCache.get(groupId)
    mapaGrupo[pNum] = {
        adicionadoPor: aNum,
        adicionadoEm: Date.now()
    }
}

function registrarComandoRecente(groupId, sender) {
    if (!groupId) return
    comandosRecentes.set(groupId, {
        timestamp: Date.now(),
        sender: sender || null
    })
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

async function processarAntiBot(sock, msg) {
    const from = msg.key?.remoteJid
    if (!from || !from.endsWith('@g.us')) return false

    // TRAVA 1: Protocolo Baileys - mensagens enviadas pelo próprio bot NUNCA são processadas
    if (msg.key?.fromMe) return false

    const sender = getSender(msg)
    if (!sender) return false

    const senderNum = sender.split('@')[0].split(':')[0].replace(/\D/g, '')
    if (!senderNum) return false

    // TRAVA 2: Whitelist dos números oficiais do bot e dono
    const botNumbers = obterBotNumbers(sock)
    if (botNumbers.has(senderNum)) return false
    if (isOwnerCheck(sender, msg)) return false

    // Verificar se o grupo está autorizado e se o antibot está ativado
    const groupConfig = configManager.loadGroupConfig()
    const configGrupo = groupConfig[from] || groupConfig[from.replace(/\./g, '___dot___')] || groupConfig[from.replace(/___dot___/g, '.')] || {}

    const { getDataMocambique } = require('../utils/timezone')
    const agoraMz = getDataMocambique().getTime()
    if (configGrupo.expiraEm && agoraMz >= configGrupo.expiraEm) return false
    if (configGrupo.authorized === false) return false

    const isAtivo = configGrupo.antibot === true || configGrupo.antiBot === true
    if (!isAtivo) return false

    // TRAVA 3: Administradores do grupo têm imunidade total
    try {
        const isAdminUser = await isAdmin(sock, from, sender)
        if (isAdminUser) return false
    } catch {
        return false
    }

    // Extrair o conteúdo da mensagem
    let messageContent = msg.message
    if (messageContent?.viewOnceMessage) messageContent = messageContent.viewOnceMessage.message
    if (messageContent?.viewOnceMessageV2) messageContent = messageContent.viewOnceMessageV2.message
    if (messageContent?.ephemeralMessage) messageContent = messageContent.ephemeralMessage.message
    if (messageContent?.documentWithCaptionMessage) messageContent = messageContent.documentWithCaptionMessage.message

    const textPieces = [
        messageContent?.conversation,
        messageContent?.extendedTextMessage?.text,
        messageContent?.imageMessage?.caption,
        messageContent?.videoMessage?.caption,
        messageContent?.documentMessage?.caption
    ]
    const text = textPieces.filter(Boolean).join(' ').trim()

    let ehBotInvasor = false
    let motivoDeteccao = ''

    // ASSINATURA 1: Botões e Mensagens Interativas Nativas
    const isInteractive = Boolean(
        messageContent?.buttonsMessage ||
        messageContent?.templateMessage ||
        messageContent?.interactiveMessage ||
        messageContent?.listMessage ||
        messageContent?.buttonsResponseMessage ||
        messageContent?.templateButtonReplyMessage
    )
    if (isInteractive) {
        ehBotInvasor = true
        motivoDeteccao = 'Envio de botões nativos via API (não-humano)'
    }

    // ASSINATURA 2: Bot Expirado / Sem Aluguel / Sem Licença
    if (!ehBotInvasor && text && REGEX_SEM_ALUGUEL.test(text)) {
        ehBotInvasor = true
        motivoDeteccao = 'Spam automático de bot sem licença/aluguel'
    }

    // ASSINATURA 3: Colisão Rápida com Comandos (< 2.5 segundos)
    if (!ehBotInvasor && text) {
        const cmdRecente = comandosRecentes.get(from)
        const agora = Date.now()
        const foiLogoAposComando = cmdRecente && (agora - cmdRecente.timestamp) <= 2500

        if (foiLogoAposComando) {
            if (REGEX_ERRO_OUTRO_BOT.test(text)) {
                ehBotInvasor = true
                motivoDeteccao = 'Colisão de comando com resposta de erro robótica'
            } else if (REGEX_HEADER_OUTRO_BOT.test(text)) {
                ehBotInvasor = true
                motivoDeteccao = 'Menu ou painel automático de outro bot'
            }
        } else {
            // Mesmo se não foi imediatamente após comando, se mandar um cabeçalho completo de outro bot
            if (REGEX_HEADER_OUTRO_BOT.test(text) && (text.includes('Prefix') || text.includes('Uptime') || text.includes('MENU PRINCIPAL'))) {
                ehBotInvasor = true
                motivoDeteccao = 'Painel/Menu estruturado de bot secundário'
            }
        }
    }

    if (!ehBotInvasor) return false

    console.log(`[ANTIBOT] 🚨 Bot invasor detectado no grupo ${from}: @${senderNum} | Motivo: ${motivoDeteccao}`)

    // 1. Apagar a mensagem do invasor
    try {
        const deleteKey = {
            remoteJid: from,
            fromMe: false,
            id: msg.key.id,
            participant: msg.key.participant || sender
        }
        await sock.sendMessage(from, { delete: deleteKey })
    } catch (e) {
        try { await sock.sendMessage(from, { delete: msg.key }) } catch {}
    }

    // Resolver JID real do invasor no grupo
    let targetJidToBan = msg.key.participant || sender
    try {
        const groupMeta = await getGroupMetadataCached(sock, from)
        if (groupMeta && groupMeta.participants) {
            const found = groupMeta.participants.find(p => {
                const pBase = (p.id || '').split(':')[0].split('@')[0]
                const pLidBase = (p.lid || '').split(':')[0].split('@')[0]
                return pBase === senderNum || pLidBase === senderNum
            })
            if (found) targetJidToBan = found.id
        }
    } catch {}

    // TRAVA 4: Bloqueio físico absoluto contra auto-remoção
    const targetCleanNum = targetJidToBan.split('@')[0].split(':')[0].replace(/\D/g, '')
    if (botNumbers.has(targetCleanNum)) {
        console.error('[ANTIBOT] ⛔ Tentativa de auto-ban prevenida pela Trava 4!')
        return true
    }

    // Identificar quem adicionou o bot
    const mapaGrupo = convitesCache.get(from) || {}
    const infoEntrada = mapaGrupo[senderNum]
    const autorNum = infoEntrada?.adicionadoPor || null
    const autorJid = autorNum ? `${autorNum}@s.whatsapp.net` : null

    const modoPunico = (configGrupo.antibotModo || 'ban').toLowerCase()
    const banDuplo = modoPunico === 'duplo' || modoPunico === 'total'

    const mentions = [targetJidToBan]
    if (autorJid) mentions.push(autorJid)

    // 2. Banir o bot invasor
    let baniuBot = false
    try {
        await sock.groupParticipantsUpdate(from, [targetJidToBan], 'remove')
        baniuBot = true
    } catch (errBan) {
        console.error('[ANTIBOT] Falha ao remover bot invasor:', errBan.message)
    }

    // 3. Se modo duplo, banir também quem adicionou (a menos que seja admin ou dono)
    let baniuAutor = false
    if (banDuplo && autorJid && !botNumbers.has(autorNum)) {
        try {
            let autorIsAdmin = false
            try { autorIsAdmin = await isAdmin(sock, from, autorJid) } catch {}
            if (!autorIsAdmin) {
                await sock.groupParticipantsUpdate(from, [autorJid], 'remove')
                baniuAutor = true
            }
        } catch (errAutor) {
            console.error('[ANTIBOT] Falha ao remover autor do bot:', errAutor.message)
        }
    }

    // 4. Enviar cartão de notificação no estilo Ghost Bot
    let textoAviso = ''
    if (baniuBot && baniuAutor) {
        textoAviso = [
            '╭┈⊰ 🛡️ 『 *ANTI-BOT: INVASOR ELIMINADO* 』',
            '┊',
            `┊•.̇𖥨֗🤖⭟ *Bot Invasor:* @${senderNum} (Banido)`,
            `┊•.̇𖥨֗👤⭟ *Adicionado por:* @${autorNum} (Banido)`,
            `┊•.̇𖥨֗⚠️⭟ *Motivo:* ${motivoDeteccao}`,
            '┊',
            '┊🔒 _Bots secundários são proibidos. Mensagem apagada._',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
    } else if (baniuBot) {
        textoAviso = [
            '╭┈⊰ 🛡️ 『 *ANTI-BOT: INVASOR ELIMINADO* 』',
            '┊',
            `┊•.̇𖥨֗🤖⭟ *Bot Invasor:* @${senderNum} (Banido)`,
            ...(autorNum ? [`┊•.̇𖥨֗👤⭟ *Adicionado por:* @${autorNum}`] : []),
            `┊•.̇𖥨֗⚠️⭟ *Motivo:* ${motivoDeteccao}`,
            '┊',
            '┊🔒 _Mensagens do bot apagadas com sucesso._',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
    } else {
        textoAviso = [
            '╭┈⊰ ⚠️ 『 *ANTI-BOT: ALERTA* 』',
            '┊',
            `┊•.̇𖥨֗🤖⭟ *Detectado:* @${senderNum}`,
            `┊•.̇𖥨֗⚠️⭟ *Motivo:* ${motivoDeteccao}`,
            '┊',
            '┊❌ _Não foi possível banir. Verifique se sou Administrador!_',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
    }

    try {
        await sock.sendMessage(from, { text: textoAviso, mentions })
    } catch {}

    return true
}

module.exports = {
    processarAntiBot,
    registrarParticipanteAdicionado,
    registrarComandoRecente
}
