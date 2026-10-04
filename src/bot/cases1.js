const fs = require('fs')
const path = require('path')
const { admCommands, memberCommands } = require('./loader')
const config = require('../../data/config.json')
const core = require(path.join(__dirname, 'core.js'))
const { handleOTPCommands } = require('./otpManager')
const menu = require('./menu')
const similarity = require('../utils/similarity')
const { isOwnerCheck, isLeaderCheck } = require('../utils/baileys')
const pluginManager = require('../comandos/pluginManager')

const atividadePath = path.join(__dirname, '../../data/atividade.json')
let atividadeCache = null
let atividadeSaveTimer = null

function loadAtividade() {
    if (atividadeCache) return atividadeCache
    try {
        atividadeCache = fs.existsSync(atividadePath) ? JSON.parse(fs.readFileSync(atividadePath)) : {}
    } catch {
        atividadeCache = {}
    }
    return atividadeCache
}

function registrarAtividade(groupId, memberId) {
    try {
        const atividade = loadAtividade()
        if (!atividade[groupId]) atividade[groupId] = {}
        if (!atividade[groupId][memberId]) {
            atividade[groupId][memberId] = { msgs: 0, ultimaMsg: null }
        }
        atividade[groupId][memberId].msgs++
        atividade[groupId][memberId].ultimaMsg = new Date().toISOString()

        if (!atividadeSaveTimer) {
            atividadeSaveTimer = setTimeout(() => {
                atividadeSaveTimer = null
                try { fs.writeFileSync(atividadePath, JSON.stringify(atividadeCache, null, 2)) } catch { }
            }, 10000)
        }
    } catch { }
}

module.exports = async function (sock, msg) {
    const { buscarNumero } = require('./core')
    const { isAdmin } = require('../utils/baileys')
    let from = msg.key.remoteJid
    const { getSender } = require('../utils/baileys')
    let sender = getSender(msg)

    if (sender.includes('@lid') && from.endsWith('@g.us')) {
        const { resolverParticipanteGrupo } = require('../utils/baileys')
        sender = await resolverParticipanteGrupo(sock, from, sender)
    }

    if (!from.endsWith('@g.us')) {
        if (from.endsWith('@lid')) {
            const fromLID = from.split('@')[0]
            const numeroReal = buscarNumero(fromLID)
            if (numeroReal && numeroReal !== fromLID) {
                from = numeroReal + '@s.whatsapp.net'
                msg.key.remoteJid = from
                sender = from
                console.log(`[PV RESOLVIDO] Convertido de ${fromLID}@lid para ${from}`)
            }
        }
        if (sender.endsWith('@lid')) {
            const sLID = sender.split('@')[0]
            const sReal = buscarNumero(sLID)
            if (sReal && sReal !== sLID) {
                sender = sReal + '@s.whatsapp.net'
            }
        }
    }

    const messageContent = msg.message?.viewOnceMessageV2?.message ||
                         msg.message?.ephemeralMessage?.message ||
                         msg.message || {};

    let rawBody =
        messageContent.conversation ||
        messageContent.extendedTextMessage?.text ||
        messageContent.imageMessage?.caption ||
        messageContent.videoMessage?.caption ||
        ''

    let body = (rawBody || '').trim()

    const { getPrefixForChat } = require('../utils/configManager')
    const effectivePrefix = getPrefixForChat(from)
    const basePrefix = config.prefix || '.'

    if (body.startsWith(effectivePrefix)) {
        const rest = body.substring(effectivePrefix.length).trimStart()

        body = basePrefix + rest
    }

    const text = (body || '').trim().toLowerCase()

    const { getSessao, salvarSessao, limparSessao } = require('../vendas/sessao')
    const sessao = getSessao(sender)


    try {
        const handledByOTP = await handleOTPCommands(sock, msg, from, sender, text);
        if (handledByOTP) return true;
    } catch (err) {
        console.error('Erro no OTP Manager:', err);
    }

    try {
        const { botStatusStore } = require('../utils/firebaseDataLayer')
        const botStatus = botStatusStore.loadSync() || { ativo: true }
        if (botStatus.ativo === false) {
            const { isLeaderCheck } = require('../utils/baileys')
            const isLeader = isLeaderCheck(sender, msg)
            const prefix = config.prefix || '.'
            const cleanLower = (text || '').trim().toLowerCase()
            const isOnAllCmd = cleanLower === (prefix + 'onall') ||
                               cleanLower.startsWith(prefix + 'onall ') ||
                               cleanLower.startsWith(prefix + 'onall\t') ||
                               cleanLower === (prefix + 'on todos') ||
                               cleanLower.startsWith(prefix + 'on todos ') ||
                               cleanLower === (prefix + 'on all')

            if (isLeader && isOnAllCmd) {
                const onCmd = require('../comandos/adm/on')
                await onCmd(sock, msg, from, sender, body)
            }
            return true
        }
    } catch (e) {}

     const isGroup = from.endsWith('@g.us')
     const isOwner = isOwnerCheck(sender, msg)

     if (isGroup && !isOwner) {
         const configMgr = require('../utils/configManager')
        const groupConfig = configMgr.loadGroupConfig()
        const grupoInfo = groupConfig[from] || groupConfig[from.replace(/\./g, '___dot___')] || groupConfig[from.replace(/___dot___/g, '.')] || {}

        const isConfigCmd = text.startsWith(config.prefix + 'aluguel') ||
            text.startsWith(config.prefix + 'ativarlicenca') ||
            text.startsWith(config.prefix + 'renovar') ||
            text.startsWith(config.prefix + 'entrar') ||
            text.startsWith(config.prefix + 'sair') ||
            text.toLowerCase().startsWith('ghost-') ||
            text === config.prefix + 'bot'

        const { getDataMocambique } = require('../utils/timezone')
        const agoraMz = getDataMocambique().getTime()
        const isGroupAuthorized = (grupoInfo?.authorized === true) && (!grupoInfo?.expiraEm || agoraMz < grupoInfo?.expiraEm)

        if (!isGroupAuthorized && !isConfigCmd) {
            return true
        }

        if (grupoInfo?.botDesligado && !isConfigCmd) {
            const prefix = config.prefix || '.'
            const cleanText = (text || '').trim()
            const isOnCmd = cleanText === (prefix + 'on') || cleanText.startsWith(prefix + 'on ') || cleanText.startsWith(prefix + 'on\t')
            if (!isOnCmd) {
                return true
            }

            const { isLeaderCheck } = require('../utils/baileys')
            if (!isLeaderCheck(sender, msg)) {
                return true
            }

            const onCmd = require('../comandos/adm/on')
            await onCmd(sock, msg, from, sender, body)
            return true
        }

        if (grupoInfo?.expiraEm && !isConfigCmd) {
            const now = new Date()
            const offset = 2 * 60
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
            const agoraMocambique = utc + (offset * 60000)

            if (agoraMocambique >= grupoInfo.expiraEm) {
                const suporteNum = configMgr.getSuporteNumber()

                if (!grupoInfo.avisouExpiracao) {
                    try {
                        await sock.sendMessage(from, {
                            text: `⏰ *Tempo expirado!*\n\n❌ O período de uso do bot neste grupo acabou.\n\n📞 Para continuar usando, entre em contato com o suporte:\nwa.me/${suporteNum}`
                        })
                        groupConfig[from].avisouExpiracao = true
                        configMgr.saveGroupConfig(true)
                    } catch (e) { }
                    return true
                }

                const isCommand = text.startsWith(config.prefix)
                if (isCommand) {
                    const agora = Date.now()
                    if (!global.lastExpiredAviso) global.lastExpiredAviso = {}
                    const lastSent = global.lastExpiredAviso[from] || 0
                    if (agora - lastSent > 60000) {
                        global.lastExpiredAviso[from] = agora
                        try {
                            await sock.sendMessage(from, {
                                text: `⏰ *BOT EXPIRADO NESTE GRUPO!*\n\n❌ A licença deste grupo expirou e o bot está inativo.\n\n🔑 Para reativar, envie uma chave de licença (\`ghost-xxxx-xxxx\`) ou fale com o suporte:\nwa.me/${suporteNum}`
                            }, { quoted: msg })
                        } catch (e) {}
                    }
                }

                return true
            }
        }
    }

    await core(sock, msg)

    if (!isGroup && isLeaderCheck(sender, msg)) {
        const senderNum = sender.split('@')[0].split(':')[0]
        const donoList = Array.isArray(config.dono) ? config.dono : [config.dono]
        const realDonos = donoList.filter(d => d.startsWith('258'))
        const donoPrincipal = realDonos[0]

        if (donoPrincipal && senderNum !== donoPrincipal) {
            try {
                const mapeamentoPath = path.join(__dirname, '../../data/mapeamentoUsuarios.json')
                let mapeamento = {}
                if (fs.existsSync(mapeamentoPath)) {
                    mapeamento = JSON.parse(fs.readFileSync(mapeamentoPath))
                }
                if (!mapeamento[donoPrincipal]) {
                    mapeamento[donoPrincipal] = {
                        sender: donoPrincipal + '@s.whatsapp.net',
                        numero: donoPrincipal,
                        nome: 'Ghost Gumball',
                        lids: []
                    }
                }
                if (!mapeamento[donoPrincipal].lids) {
                    mapeamento[donoPrincipal].lids = []
                }
                if (!mapeamento[donoPrincipal].lids.includes(senderNum)) {
                    mapeamento[donoPrincipal].lids.push(senderNum)
                    fs.writeFileSync(mapeamentoPath, JSON.stringify(mapeamento, null, 2))
                    console.log(`[VINCULO DONO] Mapeado LID ${senderNum} ao dono principal ${donoPrincipal}`)
                }

                if (from.startsWith(senderNum)) {
                    from = donoPrincipal + '@s.whatsapp.net'
                    msg.key.remoteJid = from
                    console.log(`[PV RESOLVIDO IMEDIATO] Convertido from para ${from}`)
                }
            } catch (e) {
                console.error('[ERRO VINCULO DONO]', e.message)
            }
        }

        if (realDonos.includes(senderNum)) {
            try {
                const groups = await sock.groupFetchAllParticipating()
                const newLIDs = []
                for (const groupId in groups) {
                    const participants = groups[groupId].participants || []
                    for (const p of participants) {
                        const pId = p.id ? p.id.split('@')[0].split(':')[0] : ''
                        const pLid = p.lid ? p.lid.split('@')[0].split(':')[0] : ''
                        if (realDonos.includes(pId) && pLid && !donoList.includes(pLid)) {
                            newLIDs.push(pLid)
                        }
                    }
                }
                if (newLIDs.length > 0) {
                    const configPath = path.join(__dirname, '../../data/config.json')
                    const configFile = JSON.parse(fs.readFileSync(configPath))
                    const updatedDono = [...new Set([...(Array.isArray(configFile.dono) ? configFile.dono : [configFile.dono]), ...newLIDs])]
                    configFile.dono = updatedDono
                    fs.writeFileSync(configPath, JSON.stringify(configFile, null, 2))
                    config.dono = updatedDono
                }
            } catch { }
        }
    }

    if (isGroup && msg.message) {
        registrarAtividade(from, sender)
    }

    if (!isGroup && !isOwner) {
        return true
    }

    const cleanRaw = (rawBody || '').trim().toLowerCase()
    const isTxtPrefixo = (cleanRaw === 'prefixo' || cleanRaw === 'prefix' || cleanRaw === 'prefixo?' || cleanRaw === 'qual o prefixo' || cleanRaw === 'qual o prefixo?')
    if (isGroup && isTxtPrefixo) {
        const configMgr = require('../utils/configManager')
        const groupConfig = configMgr.loadGroupConfig()
        const grupoInfo = groupConfig[from] || groupConfig[from.replace(/\./g, '___dot___')] || groupConfig[from.replace(/___dot___/g, '.')] || {}
        const { getDataMocambique } = require('../utils/timezone')
        const agoraMz = getDataMocambique().getTime()
        const isAuthorized = (grupoInfo.authorized === true) && (!grupoInfo.expiraEm || agoraMz < grupoInfo.expiraEm)

        if (isAuthorized) {
            const currentPrefix = configMgr.getPrefixForChat(from)
            const respostaPrefixo = [
                '╭┈⊰ 👻 『 *PREFIXO DO GRUPO* 』',
                '┊',
                `┊•.̇𖥨֗👻⭟Prefixo: *${currentPrefix}*`,
                `┊•.̇𖥨֗👻⭟${currentPrefix}menu`,
                `┊•.̇𖥨֗👻⭟${currentPrefix}menuprefix`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')

            const logoPath = path.join(__dirname, '../../assets', 'menuadm.jpg')

            if (fs.existsSync(logoPath)) {
                await sock.sendMessage(from, {
                    image: fs.readFileSync(logoPath),
                    caption: respostaPrefixo
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: respostaPrefixo }, { quoted: msg })
            }
            return true
        }
    }

    if (text === config.prefix + 'menu') {
        await menu(sock, msg, from)
        return true
    }

    for (const cmd of admCommands) {
        try {
            const handled = await cmd(sock, msg, from, sender, text)
            if (handled) return true
        } catch (err) {
            console.error('[ERRO CMD ADM]', err)
        }
    }

    for (const cmd of memberCommands) {
        try {
            const handled = await cmd(sock, msg, from, sender, text)
            if (handled) return true
        } catch (err) {
            console.error('[ERRO CMD MEMBRO]', err.message)
        }
    }

    if (body.startsWith(config.prefix)) {

        const cleanCmd = text.replace(/\./g, '').trim()
        if (cleanCmd.length === 0) {
            return true
        }

        const comandosValidos = [

            `${config.prefix}menu`,
            `${config.prefix}menuadm`,
            `${config.prefix}menudono`,
            `${config.prefix}grupos`,
            `${config.prefix}listagrupos`,
            `${config.prefix}desbloquearsecreto`,
            `${config.prefix}desbloquear`,
            `${config.prefix}bloquearsecreto`,
            `${config.prefix}bloquear`,
            `${config.prefix}unlock`,
            `${config.prefix}semanal`,
            `${config.prefix}sem`,
            `${config.prefix}mensal`,
            `${config.prefix}mes`,
            `${config.prefix}diamante`,
            `${config.prefix}dia`,
            `${config.prefix}top`,
            `${config.prefix}tudotop`,
            `${config.prefix}ilimitado`,
            `${config.prefix}comprovativo`,
            `${config.prefix}comprovante`,
            `${config.prefix}recibo`,
            `${config.prefix}extrato`,
            `${config.prefix}movimentos`,
            `${config.prefix}historico`,
            `${config.prefix}hist`,
            `${config.prefix}faturamento`,

            `${config.prefix}bot`,

            `${config.prefix}nano`,
            `${config.prefix}nanos`,
            `${config.prefix}limparnano`,
            `${config.prefix}limparnanos`,
            `${config.prefix}delnano`,
            `${config.prefix}delnanos`,
            `${config.prefix}removernano`,
            `${config.prefix}removernanos`,
            `${config.prefix}listanano`,
            `${config.prefix}listananos`,
            `${config.prefix}renovar`,
            `${config.prefix}renovargrupo`,

            `${config.prefix}grupo`,
            `${config.prefix}abrir`,
            `${config.prefix}fechar`,
            `${config.prefix}ban`,
            `${config.prefix}promover`,
            `${config.prefix}rebaixar`,
            `${config.prefix}delete`,
            `${config.prefix}del`,
            `${config.prefix}hidetag`,
            `${config.prefix}marcar`,
            `${config.prefix}todos`,
            `${config.prefix}id`,
            `${config.prefix}aprovar`,
            `${config.prefix}antigringo`,
            `${config.prefix}get-lid`,

            `${config.prefix}antilink`,
            `${config.prefix}antibot`,
            `${config.prefix}antifoto`,
            `${config.prefix}antiaudio`,
            `${config.prefix}antivideo`,
            `${config.prefix}antidoc`,
            `${config.prefix}antiarquivo`,
            `${config.prefix}antimidia`,
            `${config.prefix}antimedia`,
            `${config.prefix}boas-vindas`,
            `${config.prefix}boasvindas`,
            `${config.prefix}adeus`,
            `${config.prefix}detectarimg`,
            `${config.prefix}configurar`,

            `${config.prefix}compra`,
            `${config.prefix}saldo`,
            `${config.prefix}anular`,
            `${config.prefix}ranking`,
            `${config.prefix}rank`,
            `${config.prefix}meuranking`,
            `${config.prefix}meuposto`,
            `${config.prefix}top`,
            `${config.prefix}top10`,
            `${config.prefix}top20`,
            `${config.prefix}top50`,
            `${config.prefix}topclientes`,
            `${config.prefix}clientes`,
            `${config.prefix}clienteshj`,
            `${config.prefix}placar`,
            `${config.prefix}picos`,



            `${config.prefix}teste`,
            `${config.prefix}ping`,
            `${config.prefix}empregado`,
            `${config.prefix}pagamento`, 'pagamento',
            `${config.prefix}pagamentos`, 'pagamentos',
            `${config.prefix}conta`, 'conta',
            `${config.prefix}contas`, 'contas',
            `${config.prefix}pagar`, 'pagar',
            `${config.prefix}tabela`, 'tabela',
            `${config.prefix}tabelas`, 'tabelas',
            `${config.prefix}precos`, 'precos',
            `${config.prefix}preço`, 'preço',
            `${config.prefix}preços`, 'preços',
            `${config.prefix}preco`, 'preco',
            `${config.prefix}diario`, 'diario',
            `${config.prefix}diarios`, 'diarios',
            `${config.prefix}diário`, 'diário',
            `${config.prefix}diários`, 'diários',
            `${config.prefix}semanal`, 'semanal',
            `${config.prefix}semanais`, 'semanais',
            `${config.prefix}mensal`, 'mensal',
            `${config.prefix}mensais`, 'mensais',
            `${config.prefix}diamante`, 'diamante',
            `${config.prefix}diamantes`, 'diamantes',
            `${config.prefix}tudotop`, 'tudotop',
            `${config.prefix}tudo top`, 'tudo top',
            `${config.prefix}ilimitado`, 'ilimitado',
            `${config.prefix}tabelasaldo`, 'tabelasaldo',
            `${config.prefix}tabela saldo`, 'tabela saldo',
            `${config.prefix}precossaldo`, 'precossaldo',
            `${config.prefix}precos saldo`, 'precos saldo',
            `${config.prefix}saldo`, 'saldo',
            `${config.prefix}saldos`, 'saldos',
            `${config.prefix}informacoes`, 'informacoes',
            `${config.prefix}informações`, 'informações',
            `${config.prefix}info`, 'info',
            `${config.prefix}regras`, 'regras',
            `${config.prefix}ajuda`, 'ajuda',
            `${config.prefix}help`, 'help',
            `${config.prefix}github`,
            `${config.prefix}dono`,
            `${config.prefix}aluguel`, 'aluguel',

            `${config.prefix}delgrupo`,
            `${config.prefix}grupos`,
            `${config.prefix}entrar`,
            `${config.prefix}sair`,

            `${config.prefix}antipalavrao`,
            `${config.prefix}antimensao`,
            `${config.prefix}antimencao`,
            `${config.prefix}antimenção`,
            `${config.prefix}antifurtivo`,
            `${config.prefix}anticoncorrencia`,
            `${config.prefix}anticoncorrentes`,
            `${config.prefix}concorrentes`,
            `${config.prefix}concorrente`,
            `${config.prefix}mapearconcorrentes`,
            `${config.prefix}banirconcorrentes`,
            `${config.prefix}antigringo`,
            `${config.prefix}antiestrangeiro`,
            `${config.prefix}antigringos`,
            `${config.prefix}gringos`,
            `${config.prefix}gringo`,
            `${config.prefix}mapeargringos`,
            `${config.prefix}mapgringos`,

            `${config.prefix}limparcompras`,
            `${config.prefix}recuperarcompras`,
            `${config.prefix}naocompra`,
            `${config.prefix}fantasmas`,
            `${config.prefix}banghost`,
            `${config.prefix}lista`,
            `${config.prefix}add`,
            `${config.prefix}limpar`,
            `${config.prefix}gestor`,

            `${config.prefix}menudono`,
            `${config.prefix}mute`,
            `${config.prefix}unmute`,
            `${config.prefix}antiflood`,
            `${config.prefix}av`,
            `${config.prefix}on`,
            `${config.prefix}off`,

            `${config.prefix}subdono`,
            `${config.prefix}addsubdono`,
            `${config.prefix}delsubdono`,

            `${config.prefix}suporte`
        ]

        const isValid = comandosValidos.some(cmd => text === cmd || text.startsWith(cmd + ' '))

        const cmdSemPrefixo = text.replace(config.prefix, '').split(/\s+/)[0].toLowerCase()
        const isPluginCmd = pluginManager.getPlugins().some(p => {
            if (p.name === cmdSemPrefixo) return true
            if (p.aliases && p.aliases.includes(cmdSemPrefixo)) return true
            return false
        })

        if (isValid || isPluginCmd) {
            return false
        }

        const isAdm = isGroup ? await isAdmin(sock, from, sender) : false
        if (isGroup && !isOwner && !isAdm) {
            return true
        }

        const errMsg = [
            '╭┈⊰ 👻 『 *COMANDO INVÁLIDO* 』',
            '┊',
            '┊•.̇𖥨֗❌⭟ *Esse comando não foi encontrado.*',
            `┊•.̇𖥨֗💡⭟ Digite *${config.prefix}menuadm* para visualizar a lista`,
            '┊      completa de comandos disponíveis.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await sock.sendMessage(from, { text: errMsg }, { quoted: msg })
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return true
    }

    return false
}
