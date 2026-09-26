const config = require('../../data/config.json')
const { addNanoCommand, getNanoCommand, getExactNanoCommand, deleteNanoCommand, clearNanoCommands, listNanoCommands, addNanosCommand, getNanosCommand, deleteNanosCommand, clearNanosCommands, listNanosCommands } = require('./nano.js')
const fs = require('fs')
const path = require('path')
const menu = require('./menu.js')
const similarity = require('../utils/similarity')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const core = require(path.join(__dirname, 'core.js'))
const { isAdmin, isOwnerCheck, getGroupMetadataCached, resolverParticipanteGrupo } = require('../utils/baileys')
const aprovarCommand = require('../comandos/adm/aprovar')
const protecaoCommand = require('../comandos/adm/protecao')
const configCommand = require('../comandos/adm/configurar')
const antipalavraoCommand = require('../comandos/adm/antipalavrao')
const rankingCommand = require('../comandos/adm/ranking')
const menuadmCommand = require('../comandos/adm/menuadm')
const historicoCommand = require('../comandos/adm/historico')
const banCommand = require('../comandos/adm/ban')
const detectorCommand = require('../comandos/adm/detectorCmd')
const antigringoCommand = require('../comandos/adm/antigringo')
const concorrentesCommand = require('../comandos/adm/concorrentesCmd')
const antibotCmd = require('../comandos/adm/antibotCmd')
const { antifotoCommand, processarAntiFoto } = require('../comandos/adm/antifoto')
const {
  processarAntiAudio,
  processarAntiVideo,
  processarAntiDoc,
  antiaudioCommand,
  antivideoCommand,
  antidocCommand,
  antimidiaMasterCommand
} = require('../comandos/adm/antimidia')
const pluginManager = require('../comandos/pluginManager')
const { salvarSessao, getSessao, limparSessao, bufferizarNumeroCandidato, consumirNumeroCandidato } = require('../vendas/sessao')
const { extrairNumerosEDistribuirPacotes, formatarDadosDisplay } = require('../vendas/distribuidorPacotes')
const {
  calcularMegas,
  calcularMegasPorTexto,
  obterTabelaMegasGrupo,
  obterTabelaDiariosGrupo,
  obterTabelaSemanalGrupo,
  obterTabelaMensalGrupo,
  obterTabelaDiamanteGrupo,
  obterTabelaSaldoGrupo
} = require('../vendas/tabela')

if (!global.gestores) global.gestores = {}

const REGEX_PARECE_COMPROVANTE = /Confirmado|Confirmed|Transferiste|transfered|transferred|You transfered|You have transferred|M-Pesa|E-mola|saldo M-Pesa|account balance|ID da transacao|Transaction ID|Transaction|ID\s*Trans|Montante|Transação|Destinat[aá]rio|Valor enviado|Enviou para|sent to|PP\d{6}\.|CO\d{6}\.|Fee:\s*[\d.]+\s*MT/i

function formatarDataHoraMensagem(dateObj = new Date()) {
  const now = new Date(dateObj)
  const offset = 2 * 60
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  const mz = new Date(utc + (offset * 60000))
  const dd = String(mz.getDate()).padStart(2, '0')
  const mm = String(mz.getMonth() + 1).padStart(2, '0')
  const yy = String(mz.getFullYear()).slice(-2)
  const hh = String(mz.getHours()).padStart(2, '0')
  const min = String(mz.getMinutes()).padStart(2, '0')
  const ss = String(mz.getSeconds()).padStart(2, '0')
  return `${dd}-${mm}-${yy} às ${hh}.${min}.${ss}`
}

function obterTextoContasGrupo(groupId) {
  if (!groupId) return null
  const { contasStore } = require('../utils/firebaseDataLayer')
  const dados = contasStore?.loadSync ? (contasStore.loadSync() || {}) : {}
  const grupoContas = dados[groupId] || dados[groupId.replace(/\./g, '___dot___')] || dados[groupId.replace(/___dot___/g, '.')] || null
  if (!grupoContas) return null

  const mpesa = Array.isArray(grupoContas.mpesa) ? grupoContas.mpesa : []
  const emola = Array.isArray(grupoContas.emola) ? grupoContas.emola : []

  if (mpesa.length === 0 && emola.length === 0) return null

  let texto = `💳 *FORMAS DE PAGAMENTO*\n────────────────────────\n`
  if (mpesa.length > 0) {
    mpesa.forEach(c => {
      texto += `🔸 *M-Pesa:* ${c.numero} (${c.nome})\n`
    })
  }
  if (emola.length > 0) {
    emola.forEach(c => {
      texto += `🔸 *e-Mola:* ${c.numero} (${c.nome})\n`
    })
  }
  texto += `────────────────────────\n`
  texto += `_Instruções: Faça o pagamento e envie o comprovativo no grupo para ativação automática!_`
  return texto
}

module.exports = async function (sock, msg) {
  let from = msg.key.remoteJid
  const { getSender } = require('../utils/baileys')
  let sender = getSender(msg)

  if (sender.includes('@lid') && from.endsWith('@g.us')) {
    sender = await resolverParticipanteGrupo(sock, from, sender, msg)
  }

  if (!from.endsWith('@g.us')) {
    const { buscarNumero } = require('./core')
    if (from.endsWith('@lid')) {
      const fromLID = from.split('@')[0]
      const numeroReal = buscarNumero(fromLID)
      if (numeroReal && numeroReal !== fromLID) {
        from = numeroReal + '@s.whatsapp.net'
        msg.key.remoteJid = from
        sender = from
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

  const reactMsg = (emoji, targetMsgKey = null) => {
    try {
      if (!sock || !from) return Promise.resolve()
      const k = targetMsgKey || msg.key
      if (!k) return Promise.resolve()
      const keyObj = {
        remoteJid: from,
        id: k.id,
        participant: k.participant || msg.key?.participant || sender
      }
      return sock.sendMessage(from, { react: { text: emoji, key: keyObj } }).catch(() => {})
    } catch (e) {
      return Promise.resolve()
    }
  }

  let messageContent = msg.message

  if (messageContent?.viewOnceMessage) {
    messageContent = messageContent.viewOnceMessage.message
  }
  if (messageContent?.viewOnceMessageV2) {
    messageContent = messageContent.viewOnceMessageV2.message
  }

  if (messageContent?.ephemeralMessage) {
    messageContent = messageContent.ephemeralMessage.message
  }

  let rawBody = messageContent?.conversation
    || messageContent?.extendedTextMessage?.text
    || messageContent?.imageMessage?.caption
    || messageContent?.videoMessage?.caption
    || messageContent?.buttonsResponseMessage?.selectedButtonId
    || messageContent?.listResponseMessage?.singleSelectReply?.selectedRowId
    || ''

  let body = (rawBody || '').trim()

  const { getPrefixForChat } = require('../utils/configManager')
  const effectivePrefix = getPrefixForChat(from)
  const basePrefix = config.prefix || '.'

  if (body.startsWith(effectivePrefix)) {
    const rest = body.substring(effectivePrefix.length).trimStart()
    body = basePrefix + rest
  }

  const text = (body || '').trim().toLowerCase()

  const msgKeys = Object.keys(msg.message || {})

  if (!body && messageContent?.imageMessage) {
  }

  const isGroup = from.endsWith('@g.us')
  const isOwner = isOwnerCheck(sender, msg)

  let isAdminUser = false
  if (isGroup) {
    try {
      isAdminUser = await isAdmin(sock, from, sender)
    } catch { }
  }

  const isComprovantePattern = REGEX_PARECE_COMPROVANTE.test(text)
  const reservedSystemCmds = new Set([
    'tabela', 'tabelas', 'precos', 'preços', 'tabelasaldo', 'saldo', 'diarios', 'diários', 'diario', 'diário',
    'semanal', 'semanais', 'mensal', 'mensais', 'diamante', 'diamantes', 'tudotop', 'tudo top',
    'pagamento', 'pagamentos', 'conta', 'contas', 'informacoes', 'informações', 'menu', 'bot', 'ping', 'ajuda', 'help'
  ])
  const textNormalizedCmd = text.replace(/^[.!/]/, '').trim().toLowerCase()

  const startsWithPrefix = text.startsWith(config.prefix || '.')

  if (isGroup && (startsWithPrefix || reservedSystemCmds.has(textNormalizedCmd))) {
    try {
      const { registrarComandoRecente } = require('../middlewares/antibot')
      registrarComandoRecente(from, sender)
    } catch {}
  }

  if (isGroup && text.length > 2 && !startsWithPrefix && !reservedSystemCmds.has(textNormalizedCmd) && !isComprovantePattern) {
    const { getNanosCommand } = require('./nano.js')
    const respostaNano = getNanosCommand(from, text)
    if (respostaNano) {
      console.log(`[NANOS] Auto-resposta disparada para: "${text}"`)
      await sock.sendMessage(from, { text: respostaNano }, { quoted: msg })
      return
    }
  }


  if (isGroup && !isOwner) {
    try {
      const configMgr2 = require('../utils/configManager')
      const groupConfig = configMgr2.loadGroupConfig()
      const configGrupo = groupConfig[from] || groupConfig[from.replace(/\./g, '___dot___')] || groupConfig[from.replace(/___dot___/g, '.')] || {}

      const { getDataMocambique } = require('../utils/timezone')
      const agoraMz = getDataMocambique().getTime()
      if (configGrupo.expiraEm && agoraMz >= configGrupo.expiraEm) {
        return
      }
      if (configGrupo.authorized === false) {
        return
      }
      // Proteção ANTI-BOT (Zero Falso Positivo)
      if (!isAdminUser) {
        try {
          const { processarAntiBot } = require('../middlewares/antibot')
          const interceptouBot = await processarAntiBot(sock, msg)
          if (interceptouBot) return
        } catch (errAntiBot) {
          console.error('[ANTIBOT] Erro no processamento:', errAntiBot.message)
        }
      }

      if ((configGrupo.antilink || configGrupo.antiLink) && !isAdminUser) {
        const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/(?:channel|invite)\/[^\s]+|t\.me\/[^\s]+|telegram\.me\/[^\s]+|tinyurl\.com\/[^\s]+|bit\.ly\/[^\s]+|\b[a-zA-Z0-9-]+\.(com|org|net|mz|xyz|online|site|info|shop|store|app|co|io|me|link|top|cc|tv|club|tech|pro|vip)[^\s]*)/gi

        if (linkRegex.test(body)) {

          try {
            const deleteKey = {
              remoteJid: from,
              fromMe: false,
              id: msg.key.id,
              participant: msg.key.participant || sender
            }
            await sock.sendMessage(from, { delete: deleteKey })
          } catch (e) {
            console.log('[ANTILINK] Falha ao apagar msg:', e.message)
            try { await sock.sendMessage(from, { delete: msg.key }) } catch {}
          }

          try {
            const rawParticipant = msg.key.participant || sender || '';
            let targetJidToBan = rawParticipant;

            try {
              const { getGroupMetadataCached } = require('../utils/baileys');
              const groupMeta = await getGroupMetadataCached(sock, from);
              const senderBase = rawParticipant.split(':')[0].split('@')[0];

              const found = groupMeta.participants.find(p => {
                const pBase = p.id.split(':')[0].split('@')[0];
                return pBase === senderBase;
              });

              if (found) {
                targetJidToBan = found.id;
                  } else {
                  }
            } catch (metaErr) {
              console.log('[ANTILINK] Falha ao buscar metadados:', metaErr.message);
            }

            await sock.groupParticipantsUpdate(from, [targetJidToBan], 'remove');
            await sock.sendMessage(from, { text: `🚫 *Link detectado!* O infrator foi removido do grupo.` });
          } catch (err) {
            console.error('[ANTILINK] Erro ao remover infrator:', err.message);
            await sock.sendMessage(from, { text: `⚠️ *Detectei um Link!* Mas não consegui banir o usuário. (Verifique se as permissões de Administrador do Bot estão ativas)` });
          }
          return
        }
      }

      if ((configGrupo.antistatus || configGrupo.antiStatus || configGrupo.antimensao) && !isAdminUser) {
        const regexStatusMention = /(?:estado\s+de|status\s+(?:from|de))[\s\S]*?(?:este\s+grupo\s+foi\s+mencionado|this\s+group\s+was\s+mentioned|se\s+mencion[oó]\s+a\s+este\s+grupo|grupo\s+mencionado|mencionou\s+este\s+grupo|mentioned\s+in\s+(?:a\s+)?status)/i
        const isStatusHeader = regexStatusMention.test(body) || body.includes('Estado de') || body.toLowerCase().includes('status de') || body.toLowerCase().includes('status from')
        const isMentionText = body.includes('Este grupo foi mencionado') || body.toLowerCase().includes('mentioned you') || body.toLowerCase().includes('se mencionó a este grupo') || body.toLowerCase().includes('mencionado')

        const isForwardedStatus = (messageContent?.extendedTextMessage?.contextInfo?.isForwarded || messageContent?.imageMessage?.contextInfo?.isForwarded)
          && (body.toLowerCase().includes('mencionado') || body.toLowerCase().includes('mentioned') || isStatusHeader)

        const isProtoStatus = !!messageContent?.extendedTextMessage?.contextInfo?.isMentionedInStatus
          || !!messageContent?.statusMentionMessage
          || !!messageContent?.groupStatusMentionMessage
          || (Array.isArray(messageContent?.extendedTextMessage?.contextInfo?.statusMentions) && messageContent.extendedTextMessage.contextInfo.statusMentions.length > 0)

        if ((isStatusHeader && isMentionText) || isForwardedStatus || isProtoStatus) {
          console.log(`[ANTIMENSAO] Banindo ${sender} por menção em status.`)

          const deleteKey = {
            remoteJid: from,
            fromMe: false,
            id: msg.key.id,
            participant: msg.key.participant || sender
          }
          try { await sock.sendMessage(from, { delete: deleteKey }) } catch {
            try { await sock.sendMessage(from, { delete: msg.key }) } catch {}
          }

          try {

            const rawParticipant = msg.key.participant || sender || ''
            let targetJidToBan = rawParticipant

            try {
              const { getGroupMetadataCached } = require('../utils/baileys')
              const groupMeta = await getGroupMetadataCached(sock, from)
              const senderBase = rawParticipant.split(':')[0].split('@')[0]
              const found = groupMeta.participants.find(p => {
                const pBase = (p.id || '').split(':')[0].split('@')[0]
                const pLidBase = (p.lid || '').split(':')[0].split('@')[0]
                return pBase === senderBase || pLidBase === senderBase || p.id === rawParticipant || p.lid === rawParticipant
              })
              if (found) targetJidToBan = found.id
            } catch (metaErr) { console.log('[ANTIMENSAO] Falha metadados:', metaErr.message) }

            await sock.groupParticipantsUpdate(from, [targetJidToBan], 'remove')
            await sock.sendMessage(from, {
              text: `🚫 *ANTI-STATUS / MENÇÃO PROIBIDA!*\n\n👤 O infrator foi banido por marcar o grupo no status.\n\n🔒 _Segurança ativada._`,
              mentions: [sender, targetJidToBan]
            })
          } catch (err) {
            console.error('[ANTIMENSAO] Erro ao remover infrator:', err.message)
            await sock.sendMessage(from, { text: `⚠️ *Menção Proibida detectada!* Mas o bot não tem permissão de Admin para remover o membro.` })
          }
          return
        }
      }

    } catch (e) {
      console.error('[PROTECAO] Erro:', e.message)
    }
  }

  if (isGroup && !isOwner && !isAdminUser) {
    try {
      const { mutesStore } = require('../utils/firebaseDataLayer')
      const mutes = mutesStore.loadSync() || {}
      const dotJid = from.replace(/\./g, '___dot___')
      const grupoMutes = mutes[from] || mutes[dotJid]
      if (grupoMutes && grupoMutes[sender]) {
        const muteData = grupoMutes[sender]

        if (muteData.expiraEm && Date.now() > muteData.expiraEm) {

          delete grupoMutes[sender]
          mutesStore.save(mutes)
        } else {

          console.log(`[MUTE] ${sender} mutado em ${from}, banindo.`)
          await sock.sendMessage(from, { delete: msg.key })
          await sock.sendMessage(from, {
            text: `🔇 @${sender.split('@')[0].split(':')[0]} estava *mutado* e enviou mensagem. Banido automaticamente.`,
            mentions: [sender]
          })
          await sock.groupParticipantsUpdate(from, [sender], 'remove')

          delete grupoMutes[sender]
          mutesStore.save(mutes)
          return
        }
      }
    } catch (e) {
      console.error('[MUTE] Erro:', e.message)
    }
  }

  if (isGroup && !isOwner && !isAdminUser) {
    try {
      const configMgr3 = require('../utils/configManager')
      const gConfig = configMgr3.loadGroupConfig()
      if (gConfig[from]?.antiflood) {

        if (!global.floodTracker) global.floodTracker = {}
        const key = `${from}:${sender}`
        const now = Date.now()

        if (!global.floodTracker[key]) {
          global.floodTracker[key] = []
        }

        global.floodTracker[key] = global.floodTracker[key].filter(t => now - t < 4000)
        global.floodTracker[key].push(now)

        if (global.floodTracker[key].length > 5) {
          console.log(`[ANTIFLOOD] ${sender} excedeu limite em ${from}. Banindo.`)

          await sock.sendMessage(from, { delete: msg.key })
          await sock.sendMessage(from, {
            text: `🌊 *FLOOD DETECTADO!*\n\n@${sender.split('@')[0]} foi banido por enviar muitas mensagens em sequência.`,
            mentions: [sender]
          })
          await sock.groupParticipantsUpdate(from, [sender], 'remove')
          delete global.floodTracker[key]
          return
        }
      }
    } catch (e) {
      console.error('[ANTIFLOOD] Erro:', e.message)
    }
  }

  let podeProcessarRecibo = true
  if (isGroup) {
    podeProcessarRecibo = false
    try {
      const cfgMgr = require('../utils/configManager')
      const gConfigAll = cfgMgr.loadGroupConfig()
      const gInfo = gConfigAll[from] || gConfigAll[from.replace(/\./g, '___dot___')] || gConfigAll[from.replace(/___dot___/g, '.')] || {}

      const { getGrupoConfig } = require('../vendas/gruposConfig')
      const gVendasCfg = getGrupoConfig(from)
      const hasCentral = !!(gVendasCfg && (gVendasCfg.apiKey || gVendasCfg.centralCode))

      const { contasStore } = require('../utils/firebaseDataLayer')
      const todasContas = contasStore.loadSync() || {}
      const gContas = todasContas[from] || todasContas[from.replace(/\./g, '___dot___')] || todasContas[from.replace(/___dot___/g, '.')] || {}
      const temContas = (Array.isArray(gContas.mpesa) && gContas.mpesa.length > 0) || (Array.isArray(gContas.emola) && gContas.emola.length > 0)

      const autorizado = isOwner || (gInfo.authorized === true) || (gInfo.authorized !== false && (hasCentral || temContas))

      if (gInfo && gInfo.authorized === undefined && (hasCentral || temContas)) {
        gInfo.authorized = true
        gConfigAll[from] = gInfo
        cfgMgr.saveGroupConfig(gConfigAll)
      }

      let naoExpirado = true
      if (gInfo?.expiraEm) {
        const nowR = new Date()
        const utcR = nowR.getTime() + (nowR.getTimezoneOffset() * 60000)
        const agoraMzR = utcR + (2 * 60 * 60000)
        naoExpirado = agoraMzR < gInfo.expiraEm
      }
      const detectorAtivo = gInfo?.detector !== false
      podeProcessarRecibo = autorizado && naoExpirado && detectorAtivo
    } catch { podeProcessarRecibo = false }
  }

  // Interceptadores ANTI-MÍDIA (Áudio, Vídeo, Foto)
  if (isGroup) {
    try {
      if (messageContent?.audioMessage) {
        const bloqueouAudio = await processarAntiAudio(sock, msg, from, sender)
        if (bloqueouAudio) return
      }
      if (messageContent?.videoMessage) {
        const bloqueouVideo = await processarAntiVideo(sock, msg, from, sender)
        if (bloqueouVideo) return
      }
      if (messageContent?.imageMessage) {
        const bloqueouFoto = await processarAntiFoto(sock, msg, from, sender)
        if (bloqueouFoto) return
      }
    } catch (errMidia) {
      console.error('[ANTI-MIDIA] Erro na verificação:', errMidia.message)
    }
  }

  if (messageContent?.imageMessage && podeProcessarRecibo) {
    const imgMime = String(messageContent.imageMessage.mimetype || '')
    if (imgMime && !imgMime.startsWith('image/')) return

    try {
      const configMgr = require('../utils/configManager')
      const groupConfig = configMgr.loadGroupConfig()

      if (groupConfig[from]?.detectarImg === false) return
    } catch { }

    try {
      const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger })

      let textoImagem = ''

      if (mediaBuffer && mediaBuffer.length > 0) {
          let ocrBuffer = null
          try {
            const Jimp = require('jimp')
            const img = await Jimp.read(mediaBuffer)

            if (img.bitmap.width > 1100) {
              img.resize(1000, Jimp.AUTO)
            } else if (img.bitmap.width < 500) {
              const factor = Math.min(2, 800 / img.bitmap.width)
              img.resize(Math.round(img.bitmap.width * factor), Jimp.AUTO)
            }
            img.greyscale()
            ocrBuffer = await img.getBufferAsync(Jimp.MIME_PNG)
          } catch (errJimp) {
            console.error('[OCR-JIMP] Erro no pré-processamento:', errJimp.message)
            ocrBuffer = null
          }

          if (ocrBuffer) {
            try {
              const tesseract = require('node-tesseract-ocr')
              const cfg = {
                lang: 'por+eng',
                oem: 1,
                psm: 6,
                load_system_dawg: '0',
                load_freq_dawg: '0'
              }
              textoImagem = await tesseract.recognize(ocrBuffer, cfg)

              if (!textoImagem || textoImagem.trim().length < 15) {
                const cfg3 = {
                  lang: 'por+eng',
                  oem: 1,
                  psm: 3,
                  load_system_dawg: '0',
                  load_freq_dawg: '0'
                }
                textoImagem = await tesseract.recognize(ocrBuffer, cfg3)
              }

              if (textoImagem) {
                textoImagem = textoImagem
                  .replace(/[|]/g, 'l')
                  .replace(/\b([A-Z0-9]{4,14})\s*\.\s*/g, '$1. ')
                  .replace(/O(\d)/g, '0$1')
                  .replace(/(\d)O/g, '$10')
                  .replace(/(\d),(\d{2})MT/g, '$1.$2MT')
                  .replace(/lD da/gi, 'ID da')
                  .replace(/Trans\s*feriste/gi, 'Transferiste')
                  .replace(/Transieriste/gi, 'Transferiste')
                  .replace(/transfered/gi, 'transfered')
                  .replace(/transferred/gi, 'transfered')
                  .replace(/-\s*\n\s*/g, '')
                  .replace(/-\s+/g, '')
              }
            } catch (errOcr) {
              console.error('[OCR-TESSERACT] Erro:', errOcr.message)
            }
          }
      }

      if (textoImagem && textoImagem.length > 8) {

        const isChatScreenshot = /Comprovativo Aprovado|Comprovante Lido|GHOST BOT|ghost bot|Bot Gum|GRUPO ABERTO|Mencionou voc|N[aã]o mandou isso|Comprovativo Invalido/i.test(textoImagem)
        if (isChatScreenshot) {
          console.log('[OCR] 🚫 Imagem identificada como print de conversa do WhatsApp. Ignorando para validação de comprovante.')
        } else {

          const bodyOCR = (body + '\n' + textoImagem).trim()

          msg.textoOCR = bodyOCR
          msg.textoOCRPuro = textoImagem

          const isReceiptIndicator = /DHS|PP\d{6}\.|Confirmado|Confirmed|Transferiste|transfered|Valor enviado|Transaction ID|ID da transa|Enviou para/i.test(bodyOCR)
          if (isReceiptIndicator) {
            await sock.sendMessage(from, { react: { text: '👁️', key: msg.key } })
          }

          const regexEnvioOCR = /Transferiste com sucesso\s+(\d+)\s*(?:MB|GB)[^]*?para o numero\s+(258\d{9}|\d{9})/i
          const regexEnvioOCREN = /You have successfully transferred\s+(\d+)\s*(?:MB|GB)[^]*?to number\s+(258\d{9}|\d{9})/i
          if (regexEnvioOCR.test(bodyOCR) || regexEnvioOCREN.test(bodyOCR)) {
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            msg.textoOCR = bodyOCR
          }
        }
      }
    } catch (errMedia) {
      console.error('[OCR-MEDIA] Erro ao baixar/processar mídia:', errMedia.message)
    }
  }

  if (messageContent?.documentMessage && isGroup) {
    try {
      const bloqueouDoc = await processarAntiDoc(sock, msg, from, sender)
      if (bloqueouDoc) return
    } catch (errDoc) {
      console.error('[ANTI-DOC] Erro na execução:', errDoc.message)
    }
  }

  if (messageContent?.documentMessage && podeProcessarRecibo) {

    try {
      const configMgr = require('../utils/configManager')
      const groupConfig = configMgr.loadGroupConfig()
      if (groupConfig[from]?.detectardoc === false) return
    } catch { }

    try {
      const mimetype = messageContent.documentMessage.mimetype || ''
      const fileName = messageContent.documentMessage.fileName || ''

      if (mimetype.includes('pdf') || mimetype.includes('image') || fileName.toLowerCase().endsWith('.pdf')) {

        const fs = require('fs')
        const path = require('path')
        const os = require('os')

        const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger })

        let textoDocumento = ''

        if (mimetype.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {

          let cleanPdfBuffer = mediaBuffer
          try {
            const pdfHeaderIndex = mediaBuffer.indexOf(Buffer.from('%PDF-'))
            if (pdfHeaderIndex > 0) {
              console.log(`[GHOST-BOT] Removendo ${pdfHeaderIndex} bytes de lixo inicial do PDF.`)
              cleanPdfBuffer = mediaBuffer.subarray(pdfHeaderIndex)
            }
          } catch (e) {
            console.error('[GHOST-BOT] Erro ao limpar buffer do PDF:', e.message)
          }

          const { exec } = require('child_process')
          const util = require('util')
          const execPromise = util.promisify(exec)
          const crypto = require('crypto')
          const tempId = crypto.randomBytes(8).toString('hex')
          const tempPdfPath = path.join(os.tmpdir(), `pdf_${tempId}.pdf`)
          const tempImgPrefix = path.join(os.tmpdir(), `page_${tempId}`)

          try {
            await fs.promises.writeFile(tempPdfPath, cleanPdfBuffer)

            try {
              const { stdout: textFromPdftotext } = await execPromise(`pdftotext -layout "${tempPdfPath}" -`)
              if (textFromPdftotext && textFromPdftotext.trim().length >= 15) {
                textoDocumento = textFromPdftotext.trim()
                console.log(`[PDF] pdftotext extraiu com sucesso ${textoDocumento.length} chars nativos do PDF!`)
              }
            } catch (errPdftotext) { }

            if (!textoDocumento || textoDocumento.length < 15) {
              try {
                const pdfParse = require('pdf-parse')
                const pdfData = await pdfParse(cleanPdfBuffer)
                if (pdfData && pdfData.text && pdfData.text.trim().length >= 15) {
                  textoDocumento = pdfData.text.trim()
                }
              } catch (err) {
                console.error('[GHOST-BOT] Erro ao extrair texto do PDF principal:', err.message)
              }
            }

            const temTextoReciboPdf = textoDocumento && textoDocumento.length >= 15 &&
              /(Transferiste|transfered|Confirmado|ID da transa|Transaction|Destinat|Valor enviado|Montante|e-Mola|Número de recibo|Recibo)/i.test(textoDocumento)

            if (!temTextoReciboPdf) {
              console.log(`[PDF] Sem texto extraível nativo (chars: ${(textoDocumento || '').length}). Renderizando página p/ OCR...`)
              await execPromise(`pdftoppm -png -f 1 -l 1 -r 250 "${tempPdfPath}" "${tempImgPrefix}"`)

              const files = await fs.promises.readdir(os.tmpdir())
              const matchedFile = files.find(f => f.startsWith(`page_${tempId}`) && f.endsWith('.png'))

              if (matchedFile) {
                const generatedImgPath = path.join(os.tmpdir(), matchedFile)
                const imgBuffer = fs.readFileSync(generatedImgPath)

                let ocrBuffer = imgBuffer
                try {
                  const Jimp = require('jimp')
                  const img = await Jimp.read(imgBuffer)
                  if (img.bitmap.width > 1200) img.resize(1000, Jimp.AUTO)

                  img.greyscale().normalize()
                  ocrBuffer = await img.getBufferAsync(Jimp.MIME_PNG)
                } catch { }

                const tesseract = require('node-tesseract-ocr')
                const cfg = {
                  lang: 'por+eng',
                  oem: 1,
                  psm: 4,
                  load_system_dawg: '0',
                  load_freq_dawg: '0'
                }
                const ocrResult = await tesseract.recognize(ocrBuffer, cfg)
                console.log(`[PDF-OCR] Tesseract extraiu ${(ocrResult || '').trim().length} chars da imagem renderizada do PDF.`)

                if (ocrResult) {
                  textoDocumento = ocrResult
                    .replace(/[|]/g, 'l')
                    .replace(/O(\d)/g, '0$1')
                    .replace(/(\d)O/g, '$10')
                    .replace(/lD da/gi, 'ID da')
                    .replace(/Trans feriste/gi, 'Transferiste')
                    .replace(/Transieriste/gi, 'Transferiste')
                    .replace(/-\s*\n\s*/g, '')
                    .replace(/-\s+/g, '')
                }

                try { fs.unlinkSync(generatedImgPath) } catch { }
              }
            }
          } catch (errGlobalPdf) {
            console.error('[PDF-GLOBAL] Erro no processamento de PDF:', errGlobalPdf.message)
          } finally {
            try { fs.unlinkSync(tempPdfPath) } catch { }
          }
        } else if (mimetype.includes('image')) {

          if (!textoDocumento || textoDocumento.length < 10) {
            try {
              let docOcrBuffer = mediaBuffer
              try {
                const Jimp = require('jimp')
                const img = await Jimp.read(mediaBuffer)

                if (img.bitmap.width > 1000) img.resize(1000, Jimp.AUTO)
                img.greyscale().contrast(0.6).normalize()
                docOcrBuffer = await img.getBufferAsync(Jimp.MIME_PNG)
              } catch { }
              const tesseract = require('node-tesseract-ocr')
              textoDocumento = await tesseract.recognize(docOcrBuffer, { lang: 'por+eng', oem: 1, psm: 3 })
            } catch { }
          }
        }

        const fileNameClean = (fileName || '').trim()
        msg.docFileName = fileNameClean

        if (textoDocumento && textoDocumento.length > 10) {
          const bodyDOC = ((fileNameClean ? `[ARQUIVO: ${fileNameClean}]\n` : '') + body + '\n' + textoDocumento).trim()

          msg.textoOCR = bodyDOC
          msg.textoOCRPuro = textoDocumento

          const regexMpesa = /Confirmado\s+([A-Z0-9]+)[\s\S]*?Transferiste\s+([\d.,]+)\s*MT[\s\S]*?para\s+(\d{9,12})/i
          const regexMpesaEN = /Transaction ID\s+([A-Z0-9.]+)[\s\S]*?You transfered\s+([\d.,]+)\s*MT[\s\S]*?to\s+(\d{9,12})/i
          const regexEmola = /ID da transacao\s+([A-Z0-9.\-]+)[\s\S]*?Transferiste\s+([\d.,]+)\s*MT/i
          const regexEmolaEN = /Transaction ID\s+([A-Z0-9.\-]+)[\s\S]*?You transfered\s+([\d.,]+)\s*MT/i

          const regexMpesaApp = /Valor enviado\s*([\d.,]+)\s*MT[\s\S]*?Enviado para[\s\S]*?([0-9\s+]+)[\s\S]*?Número de recibo\s*([A-Z0-9]+)/i
          const regexEmolaAppDetailed = /Destinat[aá]rio\s+(\d{9,12})[\s\S]*?Nome\s+([A-ZÀ-Úa-zà-ú\s]+?)[\s\S]*?Quantia\s+([\d.,]+)\s*MT/i
          const regexEmolaApp = /Destinat[aá]rio\s+(\d{8,12})[\s\S]*?Nome\s+([A-Za-zÀ-Úà-ú\s]+?)[\s]*Quantia\s+([\d.,]+)\s*MT/i
          const regexEmolaPP = /([A-ZÀ-Úa-zà-ú\s]+)\s+([\d.,]+)\s*MT[\s\S]*?(\d{9,12})[\s\S]*?(PP\d+\.[\w.]+)/i
          const isEmolaAppFragmentado = /transacao foi realizada com/i.test(bodyDOC) || /realizada com.*sucesso/i.test(bodyDOC)

          const regexEnvioDoc = /Transferiste com sucesso\s+(\d+)\s*(?:MB|GB)[\s\S]*?(?:para o numero|numero)\s+(?:258)?(\d{9})/i
          const regexEnvioDocEN = /You have successfully transferred\s+(\d+)\s*(?:MB|GB)[\s\S]*?(?:to number|number)\s+(?:258)?(\d{9})/i

          const eReciboValido = regexMpesa.test(bodyDOC) ||
                                regexMpesaEN.test(bodyDOC) ||
                                regexEmola.test(bodyDOC) ||
                                regexEmolaEN.test(bodyDOC) ||
                                regexMpesaApp.test(bodyDOC) ||
                                regexEmolaAppDetailed.test(bodyDOC) ||
                                regexEmolaApp.test(bodyDOC) ||
                                regexEmolaPP.test(bodyDOC) ||
                                isEmolaAppFragmentado;

          if (eReciboValido) {
            await sock.sendMessage(from, { react: { text: '📄', key: msg.key } })
            msg.textoOCR = bodyDOC
            msg.textoOCRPuro = textoDocumento
          }

          if (regexEnvioDoc.test(bodyDOC) || regexEnvioDocEN.test(bodyDOC)) {
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            msg.textoOCR = bodyDOC
            msg.textoOCRPuro = textoDocumento
          }
        }
      }
    } catch { }
  }

  if (text === config.prefix + 'limpar') {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    const space = '\u200B\n'.repeat(500) + '\n'.repeat(500)
    await sock.sendMessage(from, {
      text: `${space}\n\n🤖\n💨💨${space}❲❗❳ Lɪᴍᴘᴇᴢᴀ ᴅᴇ Cʜᴀᴛ Cᴏɴᴄʟᴜɪ́ᴅᴀ ✅`
    })
    return
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
      return
    }
  }

  if (text === config.prefix + 'menu') {
    await menu(sock, msg, from)
    return
  }

  try {

    if (await pluginManager.dispatch(sock, msg, from, sender, text)) return

    if (await rankingCommand(sock, msg, from, sender, text)) return
    if (await protecaoCommand(sock, msg, from, sender, text)) return
    if (await configCommand(sock, msg, from, sender, text)) return
    if (await menuadmCommand(sock, msg, from, sender, text)) return
    if (await historicoCommand(sock, msg, from, sender, text)) return
    if (await antigringoCommand(sock, msg, from, sender, text)) return
    if (await concorrentesCommand(sock, msg, from, sender, text)) return
    if (await detectorCommand(sock, msg, from, sender, text)) return
    if (await antibotCmd(sock, msg, from, sender, text)) return
    if (await antifotoCommand(sock, msg, from, sender, text)) return
    if (await antiaudioCommand(sock, msg, from, sender, text)) return
    if (await antivideoCommand(sock, msg, from, sender, text)) return
    if (await antidocCommand(sock, msg, from, sender, text)) return
    if (await antimidiaMasterCommand(sock, msg, from, sender, text)) return

    if ((text === config.prefix + 'ban' || text.startsWith(config.prefix + 'ban ')) && !text.startsWith(config.prefix + 'banghost')) {
      await banCommand(sock, msg, from, sender, text)
      return
    }
  } catch (err) {
    console.error('Erro ao executar comandos de adm:', err)
  }

  const bodyLower = (body || '').trim().toLowerCase()
  if (
    bodyLower === 'pagamento' || bodyLower === 'pagamentos' || bodyLower === 'conta' || bodyLower === 'contas' || bodyLower === 'pagar' ||
    text === config.prefix + 'pagamento' || text === config.prefix + 'pagamentos' || text === config.prefix + 'conta' || text === config.prefix + 'contas'
  ) {
    const respostaNano = getNanoCommand(from, 'pagamento') ||
                         getNanoCommand(from, 'pagamentos') ||
                         getNanoCommand(from, 'contas') ||
                         getNanoCommand(from, 'conta') ||
                         getNanosCommand(from, 'pagamento') ||
                         getNanosCommand(from, 'contas') ||
                         obterTextoContasGrupo(from)
    if (respostaNano) {
      await sock.sendMessage(from, { text: respostaNano }, { quoted: msg })
    } else {
      const msgErroPagamento = `⚠️ *Informações de Pagamento Não Configuradas!*\n\n` +
        `Esta função ainda não foi configurada para este grupo.\n\n` +
        `👉 *Como configurar (Apenas Administradores):*\n` +
        `Envie o comando \`.configurar M-Pesa <número> <nome>\` ou \`.nano pagamento/\` seguido das instruções de pagamento.\n\n` +
        `*Exemplo:*\n` +
        `.configurar M-Pesa 84XXXXXXX Nome\n` +
        `ou\n` +
        `.nano pagamento/💳 *FORMAS DE PAGAMENTO*\n\n` +
        `🔸 *M-Pesa:* 84XXXXXXX (Nome)\n` +
        `🔸 *e-Mola:* 86XXXXXXX (Nome)\n\n` +
        `_Instruções: Faça o pagamento e envie o comprovativo no grupo para ativação automática!_`
      await sock.sendMessage(from, { text: msgErroPagamento }, { quoted: msg })
    }
    return
  }

  if (
    bodyLower === 'tabela' || bodyLower === 'tabelas' || bodyLower === 'precos' || bodyLower === 'preços' || bodyLower === 'preco' || bodyLower === 'preço' ||
    text === config.prefix + 'tabela' || text === config.prefix + 'tabelas' || text === config.prefix + 'precos' || text === config.prefix + 'preços' || text === config.prefix + 'preco' || text === config.prefix + 'preço'
  ) {
    const respostaTabela = obterTabelaMegasGrupo(from) ||
                           getNanoCommand(from, 'tabela') ||
                           getNanoCommand(from, 'precos') ||
                           getNanoCommand(from, 'preços') ||
                           getNanosCommand(from, 'tabela') ||
                           getNanosCommand(from, 'precos')
    if (respostaTabela) {
      await sock.sendMessage(from, { text: respostaTabela }, { quoted: msg })
    } else {
      const msgErroTabela = `⚠️ *Tabela de Preços Não Configurada!*\n\n` +
        `Esta função ainda não foi configurada para este grupo.\n\n` +
        `👉 *Como configurar (Apenas Administradores):*\n` +
        `Envie o comando \`.configurar tabela/\` seguido do texto da sua tabela.\n\n` +
        `*Exemplo:*\n` +
        `.configurar tabela/\n` +
        `🔹 *10MT* ➝ 500MB (Diário)\n` +
        `🔹 *20MT* ➝ 1.1GB (Diário)\n` +
        `🔹 *50MT* ➝ 3.0GB (Diário)\n` +
        `🔹 *100MT* ➝ 6.5GB (Diário)\n\n` +
        `_Dica: O bot lerá os valores automaticamente e entregará os Megas correspondentes!_`
      await sock.sendMessage(from, { text: msgErroTabela }, { quoted: msg })
    }
    return
  }

  if (bodyLower === 'diarios' || bodyLower === 'diários' || bodyLower === 'diario' || bodyLower === 'diário' || text === config.prefix + 'diarios' || text === config.prefix + 'diários' || text === config.prefix + 'diario') {
    const respostaDiarios = obterTabelaDiariosGrupo(from) || getNanoCommand(from, 'diarios') || getNanoCommand(from, 'diario')
    if (respostaDiarios) {
      await sock.sendMessage(from, { text: respostaDiarios }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `⚠️ *Tabela Diária Não Configurada!*\n\nUse \`.configurar diarios/[texto]\` para cadastrar os pacotes diários deste grupo.`
      }, { quoted: msg })
    }
    return
  }

  if (
    bodyLower === 'saldo' ||
    bodyLower === 'saldos' ||
    bodyLower === 'tabelasaldo' ||
    bodyLower === 'tabela saldo' ||
    bodyLower === 'precos saldo' ||
    bodyLower === 'preços saldo' ||
    bodyLower === 'preco saldo' ||
    bodyLower === 'preço saldo' ||
    text === config.prefix + 'tabelasaldo' ||
    text === config.prefix + 'precossaldo' ||
    (text === config.prefix + 'saldo' && (!args || args.length === 0))
  ) {
    const respostaSaldo = obterTabelaSaldoGrupo(from) || getNanoCommand(from, 'tabelasaldo') || getNanoCommand(from, 'saldo') || getNanoCommand(from, 'precossaldo')
    if (respostaSaldo) {
      await sock.sendMessage(from, { text: respostaSaldo }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `⚠️ *Tabela de Saldo Não Configurada!*\n\nUse \`.configurar saldo/[texto]\` para cadastrar a tabela de saldo deste grupo.`
      }, { quoted: msg })
    }
    return
  }

  if (bodyLower === 'semanal' || bodyLower === 'semanais' || text === config.prefix + 'semanal' || text === config.prefix + 'semanais' || bodyLower === 'pacotes semanal') {
    const respostaSemanal = obterTabelaSemanalGrupo(from) || getNanoCommand(from, 'semanal') || getNanoCommand(from, 'semanais')
    if (respostaSemanal) {
      await sock.sendMessage(from, { text: respostaSemanal }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `⚠️ *Tabela Semanal Não Configurada!*\n\nUse \`.configurar semanal/[texto]\` para cadastrar os pacotes semanais (7 dias) deste grupo.`
      }, { quoted: msg })
    }
    return
  }

  if (bodyLower === 'mensal' || bodyLower === 'mensais' || text === config.prefix + 'mensal' || text === config.prefix + 'mensais' || bodyLower === 'pacotes mensal') {
    const respostaMensal = obterTabelaMensalGrupo(from) || getNanoCommand(from, 'mensal') || getNanoCommand(from, 'mensais')
    if (respostaMensal) {
      await sock.sendMessage(from, { text: respostaMensal }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `⚠️ *Tabela Mensal Não Configurada!*\n\nUse \`.configurar mensal/[texto]\` para cadastrar os pacotes mensais (30 dias) deste grupo.`
      }, { quoted: msg })
    }
    return
  }

  if (bodyLower === 'diamante' || bodyLower === 'diamantes' || text === config.prefix + 'diamante' || text === config.prefix + 'diamantes' || bodyLower === 'tudo top' || bodyLower === 'tudotop' || text === config.prefix + 'tudotop') {
    const respostaDiamante = obterTabelaDiamanteGrupo(from) || getNanoCommand(from, 'diamante') || getNanoCommand(from, 'tudotop')
    if (respostaDiamante) {
      await sock.sendMessage(from, { text: respostaDiamante }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `⚠️ *Tabela Diamante / Tudo Top Não Configurada!*\n\nUse \`.configurar diamante/[texto]\` para cadastrar os pacotes ilimitados (30 dias) deste grupo.`
      }, { quoted: msg })
    }
    return
  }

  if (bodyLower === 'informacoes' || bodyLower === 'informações' || text === config.prefix + 'informacoes' || text === config.prefix + 'informações') {
    if (isGroup) {
      const metadata = await getGroupMetadataCached(sock, from)
      const nomeGrupo = metadata.subject || 'Sem nome'
      const descGrupo = metadata.desc || 'Sem descrição'
      const membros = metadata.participants?.length || 0

      let resposta = `📋 *${nomeGrupo}*\n\n`
      resposta += `📝 *Descrição:* ${descGrupo}\n`
      resposta += `👥 *Membros:* ${membros}\n`

      const respostaNano = getNanoCommand(from, 'informacoes') || getNanoCommand(from, 'informações')
      if (respostaNano) {
        const senderMention = `@${sender.split('@')[0]}`
        const respostaFinal = respostaNano.replace(/@user/gi, senderMention)
        resposta += `\n📌 *Info extra:* ${respostaFinal}`
      }

      await sock.sendMessage(from, { text: resposta, mentions: [sender] }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: 'ℹ️ Este comando só funciona em grupos.' }, { quoted: msg })
    }
    return
  }

  if (text === config.prefix + 'dono') {
    const donoStr = config.ownerDisplayNumber || (Array.isArray(config.dono) ? config.dono[0] : config.dono) || '258879116693'
    await sock.sendMessage(from, { text: `👤 Dono do Bot\n\nNome: ${config.ownerName}\nNúmero: ${donoStr}` }, { quoted: msg })
    return
  }

  if (text === config.prefix + 'github') {
    await sock.sendMessage(from, { text: `🔗 *GitHub Oficial*\n\nAcesse: https://github.com/Gumballxnz/` }, { quoted: msg })
    return
  }

  if (body === 'aluguel' || text === config.prefix + 'aluguel') {
    const botName = config.botName || "Bot"

    let donoNumber = ''
    if (config.ownerDisplayNumber) {
      donoNumber = '258' + config.ownerDisplayNumber.replace(/[^0-9]/g, '')
    } else {
      const pDono = Array.isArray(config.dono) ? config.dono[0] : config.dono
      donoNumber = pDono.replace(/[^0-9]/g, '')
    }

    const linkWhatsApp = `https://wa.me/${donoNumber}?text=Olá%20pretendo%20alugar%20o%20teu%20bot`

    const mensagem = `┌────────────────┐
│  *Informações de Aluguel*│
└──────🏠───_────┘

Deseja alugar o bot *${botName}*❓
Entre em contacto com o dono:

👉 Clique aqui para falar no WhatsApp:
${linkWhatsApp}

Mensagem automática: _"Olá pretendo alugar o teu bot"_`

    await sock.sendMessage(from, { text: mensagem }, { quoted: msg })
    return
  }

  if (body.toLowerCase().startsWith(config.prefix + 'anular')) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas o dono ou administradores podem anular compras.' }, { quoted: msg })
      return
    }

    try {
      const { anularVenda } = require('../vendas/tracker')

      let conteudo = body.slice((config.prefix + 'anular').length).replace(/compra/gi, '').trim()

      conteudo = conteudo.replace(/@\d+/g, '').trim()

      if (!conteudo) {
        await sock.sendMessage(from, { text: '❌ Use: .anular [quantidade] @cliente (ou respondendo a msg)\nExemplo:\n• .anular 500MB @user\n• .anular 100MT @user' }, { quoted: msg })
        return
      }

      let isSaldo = false
      if (/saldo/i.test(conteudo) || /mt/i.test(conteudo) || /^\d+$/.test(conteudo)) {
        isSaldo = true
      }

      const mentions = messageContent?.extendedTextMessage?.contextInfo?.mentionedJid || []

      const quotedMsg = messageContent?.extendedTextMessage?.contextInfo
        || messageContent?.imageMessage?.contextInfo
        || messageContent?.videoMessage?.contextInfo

      let mentionId = mentions[0] || quotedMsg?.participant || quotedMsg?.remoteJid || null

      if (!mentionId) {
        await sock.sendMessage(from, { text: '❌ Marque a mensagem do cliente ou mencione @cliente para anular.\n\nExemplo: .anular 500MB @user' }, { quoted: msg })
        return
      }

      const botJid = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net' : ''
      if (mentionId === botJid) {
        await sock.sendMessage(from, { text: '❌ *Operação inválida!* O bot não pode ter compras anuladas.' }, { quoted: msg })
        return
      }

      const planoClean = isSaldo && !conteudo.toUpperCase().includes('MT') ? `${conteudo}MT Saldo` : conteudo

      const stats = anularVenda(from, mentionId, planoClean, isSaldo)

      const senderMention = `@${sender.split('@')[0]}`
      let mensagemAnulacao = `❌ *COMPRA ANULADA*

👤 Cliente: @${mentionId.split('@')[0]}
📦 Pacote/Valor: *${planoClean}*
👤 Anulado por: ${senderMention}
⏰ Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}

_Esta compra foi cancelada e deduzida do banco de dados com sucesso._`

      if (stats) {
        if (isSaldo) {
          mensagemAnulacao += `\n\n📊 *Saldo atual do cliente:* ${stats.totalSaldo}MT\n🛍️ Compras hoje: ${stats.comprasHoje}`
        } else {
          mensagemAnulacao += `\n\n📊 *Dados atuais do cliente:* ${stats.totalFormatado}\n🛍️ Compras hoje: ${stats.comprasHoje}`
        }
      }

      await sock.sendMessage(from, { text: mensagemAnulacao, mentions: [mentionId, sender] }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (errAnular) {
      console.error('[ERRO-ANULAR] Falha no comando .anular:', errAnular)
      await sock.sendMessage(from, { text: `❌ Erro ao anular compra: ${errAnular.message}` }, { quoted: msg })
    }
    return
  }

  if (text === config.prefix + 'clientes') {
    const { getRanking } = require('../vendas/tracker')
    const ranking = getRanking(from, 50)

    if (ranking.length === 0) {
      await sock.sendMessage(from, { text: '📉 Ainda não há vendas registradas neste grupo.' }, { quoted: msg })
      return
    }

    let resposta = `🛒 *RANKING DE CLIENTES*\n━━━━━━━━━━━━━━━━━━\n\n`
    const medalhas = ['🥇', '🥈', '🥉']

    for (let i = 0; i < ranking.length; i++) {
      const cliente = ranking[i]
      const posicao = i + 1
      const medalha = i < 3 ? medalhas[i] : ''
      const numero = cliente.id.split('@')[0]
      const totalGB = cliente.totalMB >= 1024
        ? (cliente.totalMB / 1024).toFixed(2) + 'GB'
        : cliente.totalMB.toFixed(0) + 'MB'

      let detalhes = `📦 ${totalGB}`
      if (cliente.totalSaldo > 0) {
        detalhes += ` | 💰 ${cliente.totalSaldo}MT`
      }
      detalhes += ` | 🛍️ ${cliente.compras} compras`

      resposta += `${medalha ? medalha + ' ' : ''}*${posicao}.* @${numero}\n`
      resposta += `   ${detalhes}\n\n`
    }

    await sock.sendMessage(from, { text: resposta, mentions: ranking.map(r => r.id) }, { quoted: msg })
    return
  }

  if (text === config.prefix + 'clienteshj') {
    const { getVendasHoje } = require('../vendas/tracker')
    const hoje = getVendasHoje(from)

    if (hoje.total === 0) {
      await sock.sendMessage(from, { text: '📉 Nenhuma venda registrada hoje neste grupo.' }, { quoted: msg })
      return
    }

    let resposta = `📊 *VENDAS DE HOJE*\n━━━━━━━━━━━━━━━━━━\n\n`
    resposta += `📦 Total Megas: *${hoje.totalMB}*\n`
    resposta += `💰 Total Saldo: *${hoje.totalSaldo}MT*\n`
    resposta += `🛍️ Total de compras: *${hoje.total}*\n\n`
    resposta += `*Clientes:*\n`

    for (const venda of hoje.clientes.slice(0, 20)) {
      const numero = venda.clienteId.split('@')[0]
      let detalhe = ''
      if (venda.isSaldo) {
        detalhe = `${venda.valorSaldo}MT (Saldo)`
      } else {
        detalhe = venda.mb >= 1024 ? (venda.mb / 1024).toFixed(2) + 'GB' : venda.mb + 'MB'
      }
      if (venda.isAnulacao) {
        detalhe = `ANULADO: ${detalhe}`
      }
      resposta += `• @${numero} - ${detalhe}\n`
    }

    await sock.sendMessage(from, { text: resposta, mentions: hoje.clientes.map(v => v.clienteId) }, { quoted: msg })
    return
  }

  if (text === config.prefix + 'naocompra') {
    try {
      const { vendasStore } = require('../utils/firebaseDataLayer')
      const vendas = vendasStore.loadSync() || {}
      const grupoVendas = vendas[from] || { clientes: {} }
      const clientesCompraram = Object.keys(grupoVendas.clientes)

      const { getGroupMetadataCached } = require('../utils/baileys')
      const metadata = await getGroupMetadataCached(sock, from)
      const todosParticipantes = metadata.participants.map(p => p.id)

      const naoCompraram = todosParticipantes.filter(p => !clientesCompraram.includes(p))

      if (naoCompraram.length === 0) {
        await sock.sendMessage(from, { text: '🎉 Todos os membros do grupo já compraram!' }, { quoted: msg })
        return
      }

      let resposta = `📋 *MEMBROS QUE NUNCA COMPRARAM*\n━━━━━━━━━━━━━━━━━━\n\n`
      resposta += `Total: ${naoCompraram.length} membros\n\n`

      for (const membro of naoCompraram.slice(0, 30)) {
        resposta += `• @${membro.split('@')[0]}\n`
      }

      if (naoCompraram.length > 30) {
        resposta += `\n... e mais ${naoCompraram.length - 30} membros`
      }

      await sock.sendMessage(from, { text: resposta, mentions: naoCompraram.slice(0, 30) }, { quoted: msg })
    } catch (err) {
      await sock.sendMessage(from, { text: '❌ Erro ao verificar membros.' }, { quoted: msg })
    }
    return
  }

  if (text === config.prefix + 'picos') {
    const tracker = require('../vendas/tracker')
    const stats = tracker.getGroupStats(from)

    if (!stats) {
      await sock.sendMessage(from, { text: '📉 Nenhuma estatística disponível para este grupo.' }, { quoted: msg })
      return
    }

    const resposta = `📊 *ESTATÍSTICAS DO GRUPO*
━━━━━━━━━━━━━━━━━━

👥 Total de clientes: *${stats.totalClientes}*
🛍️ Total de vendas: *${stats.totalVendas}*
📦 Total Megas: *${stats.totalMB}*
💰 Total Saldo: *${stats.totalSaldo}MT*

_Dados desde o início do registro_`

    await sock.sendMessage(from, { text: resposta }, { quoted: msg })
    return
  }
  if (body.toLowerCase().startsWith(config.prefix + 'gestor')) {
    if (!isOwnerCheck(sender, msg)) {
      await sock.sendMessage(from, { text: '❌ Apenas o Dono pode configurar gestor.' }, { quoted: msg })
      return
    }

    const conteudo = body.replace(config.prefix + 'gestor', '').trim()
    if (!conteudo) {
      await sock.sendMessage(from, { text: '❌ Use: .gestor NOME' }, { quoted: msg })
      return
    }

    global.gestores[from] = conteudo
    await sock.sendMessage(from, { text: `✅ Gestor configurado neste grupo: ${conteudo}` }, { quoted: msg })
    return
  }

  if (body.toLowerCase().startsWith(config.prefix + 'grupo f')) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    const argumento = body.toLowerCase().replace(config.prefix + 'grupo f', '').trim()
    const configMgr = require('../utils/configManager')
    const groupConfig = configMgr.loadGroupConfig()

    if (argumento === 'off') {
      if (groupConfig[from]) delete groupConfig[from].horaFechar
      configMgr.saveGroupConfig(true)
      await sock.sendMessage(from, { text: '✅ Agendamento de fechamento desativado.' }, { quoted: msg })
      return
    }

    const horaMatch = argumento.match(/^(\d{1,2}):(\d{2})$/)
    if (!horaMatch) {
      await sock.sendMessage(from, { text: '❌ Use: .grupo f HH:MM (ex: .grupo f 22:00)\nPara desativar: .grupo f off' }, { quoted: msg })
      return
    }

    const hora = horaMatch[1].padStart(2, '0')
    const minuto = horaMatch[2]

    if (!groupConfig[from]) groupConfig[from] = { authorized: true }
    if (groupConfig[from].authorized === undefined) groupConfig[from].authorized = true
    groupConfig[from].horaFechar = `${hora}:${minuto}`
    configMgr.saveGroupConfig(true)

    await sock.sendMessage(from, { text: `✅ Grupo será fechado todos os dias às *${hora}:${minuto}* (horário de Moçambique).\n\nPara desativar: .grupo f off` }, { quoted: msg })
    return
  }

  if (body.toLowerCase().startsWith(config.prefix + 'grupo a')) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    const argumento = body.toLowerCase().replace(config.prefix + 'grupo a', '').trim()
    const configMgr2 = require('../utils/configManager')
    const groupConfig = configMgr2.loadGroupConfig()

    if (argumento === 'off') {
      if (groupConfig[from]) delete groupConfig[from].horaAbrir
      configMgr2.saveGroupConfig(true)
      await sock.sendMessage(from, { text: '✅ Agendamento de abertura desativado.' }, { quoted: msg })
      return
    }

    const horaMatch = argumento.match(/^(\d{1,2}):(\d{2})$/)
    if (!horaMatch) {
      await sock.sendMessage(from, { text: '❌ Use: .grupo a HH:MM (ex: .grupo a 06:00)\nPara desativar: .grupo a off' }, { quoted: msg })
      return
    }

    const hora = horaMatch[1].padStart(2, '0')
    const minuto = horaMatch[2]

    if (!groupConfig[from]) groupConfig[from] = { authorized: true }
    if (groupConfig[from].authorized === undefined) groupConfig[from].authorized = true
    groupConfig[from].horaAbrir = `${hora}:${minuto}`
    configMgr2.saveGroupConfig(true)

    await sock.sendMessage(from, { text: `✅ Grupo será aberto todos os dias às *${hora}:${minuto}* (horário de Moçambique).\n\nPara desativar: .grupo a off` }, { quoted: msg })
    return
  }

  if (text.startsWith(config.prefix + 'nano ') && !text.startsWith(config.prefix + 'nanos ')) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }
    const conteudo = body.slice((config.prefix + 'nano ').length).trim()
    const primeiraBarraIndex = conteudo.indexOf('/')
    let nome = ''
    let resposta = ''

    if (primeiraBarraIndex !== -1) {
      nome = conteudo.slice(0, primeiraBarraIndex).trim().toLowerCase()
      resposta = conteudo.slice(primeiraBarraIndex + 1).trim()
    } else if (conteudo.toLowerCase().startsWith('tabela ')) {
      nome = 'tabela'
      resposta = conteudo.substring('tabela '.length).trim()
    }

    if (!nome || !resposta) {
      await sock.sendMessage(from, { text: `❌ Use: ${config.prefix}nano nome/resposta\n\nExemplo:\n.nano tabela/Texto completo aqui...` }, { quoted: msg })
      return
    }

    if (nome === 'tabela' || nome === 'precos' || nome === 'preços') {
      const { salvarTabelaMegasGrupo } = require('../vendas/tabela')
      salvarTabelaMegasGrupo(from, resposta)
      addNanoCommand(from, 'tabela', resposta)
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
          '┊',
          '┊•.̇𖥨֗✅⭟ *Tabela Geral configurada e unificada!*',
          '┊•.̇𖥨֗📊⭟ Sincronizada diretamente com o painel de tabelas.',
          `┊•.̇𖥨֗👀⭟ Digite *${config.prefix}tabela* para visualizar.`,
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
      try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
      return
    }

    const existente = getExactNanoCommand(from, nome)
    if (existente) {
      const preview = existente.length > 100 ? existente.substring(0, 100) + '...' : existente
      await sock.sendMessage(from, {
        text: `⚠️ *O comando "${nome}" já existe!*\n\n📝 Resposta atual:\n${preview}\n\n━━━━━━━━━━━━━━━━━━\n🗑️ Para *remover*, use:\n\`.limparnano ${nome}\`\n\nDepois, rode novamente o comando .nano para criar.`
      }, { quoted: msg })
    } else {
      addNanoCommand(from, nome, resposta)
      await sock.sendMessage(from, { text: `✅ Comando Exato "${nome}" criado com sucesso!\n\n📝 Tamanho: ${resposta.length} caracteres` }, { quoted: msg })
    }
    return
  }

  if (text.startsWith(config.prefix + 'nanos ')) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }
    const conteudo = body.slice((config.prefix + 'nanos ').length).trim()
    const primeiraBarraIndex = conteudo.indexOf('/')
    let nome = ''
    let resposta = ''

    if (primeiraBarraIndex !== -1) {
      nome = conteudo.slice(0, primeiraBarraIndex).trim().toLowerCase()
      resposta = conteudo.slice(primeiraBarraIndex + 1).trim()
    } else if (conteudo.toLowerCase().startsWith('tabela ')) {
      nome = 'tabela'
      resposta = conteudo.substring('tabela '.length).trim()
    }

    if (!nome || !resposta) {
      await sock.sendMessage(from, { text: `❌ Use: ${config.prefix}nanos nome/resposta\n\nExemplo:\n.nanos peço megas/Texto completo aqui...` }, { quoted: msg })
      return
    }

    if (nome === 'tabela' || nome === 'precos' || nome === 'preços') {
      const { salvarTabelaMegasGrupo } = require('../vendas/tabela')
      salvarTabelaMegasGrupo(from, resposta)
      addNanosCommand(from, 'tabela', resposta)
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
          '┊',
          '┊•.̇𖥨֗✅⭟ *Tabela Geral configurada e unificada!*',
          '┊•.̇𖥨֗📊⭟ Sincronizada diretamente com o painel de tabelas.',
          `┊•.̇𖥨֗👀⭟ Digite *${config.prefix}tabela* para visualizar.`,
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
      try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
      return
    }

    const chavesParciais = listNanosCommands(from)
      const existe = chavesParciais.some(k => k.toLowerCase().trim() === nome.toLowerCase().trim())

      if (existe) {
        const respostaAtual = getNanosCommand(from, nome) || '..."(Resposta oculta)"'
        const preview = respostaAtual.length > 100 ? respostaAtual.substring(0, 100) + '...' : respostaAtual
        await sock.sendMessage(from, {
          text: `⚠️ *O comando parcial "${nome}" já existe!*\n\n📝 Resposta atual:\n${preview}\n\n━━━━━━━━━━━━━━━━━━\n🗑️ Para *remover*, use:\n\`.limparnanos ${nome}\`\n\nDepois, rode novamente o comando .nanos para criar.`
        }, { quoted: msg })
      } else {
        addNanosCommand(from, nome, resposta)
        await sock.sendMessage(from, { text: `✅ Comando Parcial "${nome}" criado com sucesso!\nO bot responderá se a mensagem contiver essa frase.\n\n📝 Tamanho: ${resposta.length} caracteres` }, { quoted: msg })
      }
    return
  }

  if (text === config.prefix + 'listanano') {
    const nanos = listNanoCommands(from)
    if (nanos.length === 0) {
      await sock.sendMessage(from, { text: '📭 Nenhum comando nano (exato) neste grupo.' }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `📋 *COMANDOS NANO (Exatos)*\n━━━━━━━━━━━━━━━━━━\n\n${nanos.map(n => `• ${n}`).join('\n')}\n\n💡 Digite o nome exato para usar`
      }, { quoted: msg })
    }
    return
  }

  if (text === config.prefix + 'listananos') {
    const nanos = listNanosCommands(from)
    if (nanos.length === 0) {
      await sock.sendMessage(from, { text: '📭 Nenhum comando nanos (parcial) neste grupo.' }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: `📋 *COMANDOS NANOS (Parciais)*\n━━━━━━━━━━━━━━━━━━\n\n${nanos.map(n => `• ${n}`).join('\n')}\n\n💡 O bot responde caso a mensagem contenha a frase`
      }, { quoted: msg })
    }
    return
  }

  const isLimparNanoExato = (text.startsWith(config.prefix + 'limparnano') && !text.startsWith(config.prefix + 'limparnanos')) ||
                            (text.startsWith(config.prefix + 'delnano') && !text.startsWith(config.prefix + 'delnanos')) ||
                            (text.startsWith(config.prefix + 'removernano') && !text.startsWith(config.prefix + 'removernanos'))

  if (isLimparNanoExato) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    const prefixUsed = text.startsWith(config.prefix + 'limparnano') ? (config.prefix + 'limparnano') :
                       text.startsWith(config.prefix + 'delnano') ? (config.prefix + 'delnano') : (config.prefix + 'removernano')
    const argumento = text.slice(prefixUsed.length).trim().toLowerCase()

    if (argumento === 'confirmar' || argumento === 'todos' || argumento === 'all') {
      const count = clearNanoCommands(from)
      await sock.sendMessage(from, { text: `🗑️ *${count} comandos nano (exatos)* foram removidos deste grupo!` }, { quoted: msg })
    } else if (argumento) {
      const deleted = deleteNanoCommand(from, argumento)
      if (deleted) {
        await sock.sendMessage(from, { text: `✅ Comando exato "${argumento}" removido com sucesso!` }, { quoted: msg })
      } else {
        await sock.sendMessage(from, { text: `❌ Comando "${argumento}" não encontrado em nanos exatos.` }, { quoted: msg })
      }
    } else {
      await sock.sendMessage(from, { text: `💡 Use: .limparnano [nome] para remover um específico\n💡 Use: .limparnano confirmar para remover todos` }, { quoted: msg })
    }
    return
  }

  const isLimparNanosParcial = text.startsWith(config.prefix + 'limparnanos') ||
                               text.startsWith(config.prefix + 'delnanos') ||
                               text.startsWith(config.prefix + 'removernanos')

  if (isLimparNanosParcial) {
    if (!isOwner && !isAdminUser) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    const prefixUsed = text.startsWith(config.prefix + 'limparnanos') ? (config.prefix + 'limparnanos') :
                       text.startsWith(config.prefix + 'delnanos') ? (config.prefix + 'delnanos') : (config.prefix + 'removernanos')
    const argumento = text.slice(prefixUsed.length).trim().toLowerCase()

    if (argumento === 'confirmar' || argumento === 'todos' || argumento === 'all') {
      const count = clearNanosCommands(from)
      await sock.sendMessage(from, { text: `🗑️ *${count} comandos nanos (parciais)* foram removidos deste grupo!` }, { quoted: msg })
    } else if (argumento) {
      const deleted = deleteNanosCommand(from, argumento)
      if (deleted) {
        await sock.sendMessage(from, { text: `✅ Comando parcial "${argumento}" removido com sucesso!` }, { quoted: msg })
      } else {
        await sock.sendMessage(from, { text: `❌ Comando "${argumento}" não encontrado em nanos parciais.` }, { quoted: msg })
      }
    } else {
      await sock.sendMessage(from, { text: `💡 Use: .limparnanos [frase] para remover um específico\n💡 Use: .limparnanos confirmar para remover todos` }, { quoted: msg })
    }
    return
  }

  const comandoNano = body.toLowerCase().trim()

  let respostaNano = null
  if (!REGEX_PARECE_COMPROVANTE.test(comandoNano)) {

    respostaNano = getNanoCommand(from, comandoNano)

    if (!respostaNano) {
      respostaNano = getNanosCommand(from, comandoNano)
    }
  }

  if (respostaNano) {

    const senderMention = `@${sender.split('@')[0]}`
    const respostaFinal = respostaNano.replace(/@user/gi, senderMention)

    await sock.sendMessage(from, {
      text: respostaFinal,
      mentions: [sender]
    }, { quoted: msg })
    return
  }

  if (text.startsWith(config.prefix + 'aprovar')) {
    const args = text.split(' ').slice(1)
    const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: msg })
    const { getGroupMetadataCached } = require('../utils/baileys')
    const groupMetadata = isGroup ? await getGroupMetadataCached(sock, from) : null

    const type = Object.keys(msg.message)[0]

    await aprovarCommand(sock, msg, from, args, sender, isGroup, groupMetadata, reply, type, isAdminUser, isOwner)
    return
  }

  if (text.startsWith(config.prefix + 'compra')) {
    if (!isAdminUser && !isOwner) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    try {
      const { registrarVenda } = require('../vendas/tracker')
      const { getNanoCommand } = require('./nano.js')
      const { buscarDadosPorPacoteNaTabela } = require('../vendas/tabela')

      let plano = body.slice((config.prefix + 'compra').length).trim()

      plano = plano.replace(/@\d+/g, '').trim()
      const planoInformado = plano.length > 0

      const mentions = messageContent?.extendedTextMessage?.contextInfo?.mentionedJid || []

      const quotedMsg = messageContent?.extendedTextMessage?.contextInfo
        || messageContent?.imageMessage?.contextInfo
        || messageContent?.videoMessage?.contextInfo

      let mentionId = mentions[0] || quotedMsg?.participant || quotedMsg?.remoteJid || null

      if (!mentionId) {
        await sock.sendMessage(from, { text: '❌ Marque a mensagem do cliente ou mencione @cliente.\n\nExemplo:\n• .compra 1024MB _(respondendo msg)_\n• .compra 500MB @user' }, { quoted: msg })
        return
      }

      if (mentionId.includes('@lid') && from.endsWith('@g.us')) {
        mentionId = await resolverParticipanteGrupo(sock, from, mentionId)
      }

      try {
        const sessoesRaw = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../vendas/sessoes.json'), 'utf8'))
        const mentionDigits = mentionId.split('@')[0].split(':')[0]
        console.log(`[COMPRA-DEBUG2] mentionIdResolvido=${mentionId} mentionDigits=${mentionDigits}`)
        console.log(`[COMPRA-DEBUG2] chaves de sessoes ativas agora=${JSON.stringify(Object.keys(sessoesRaw))}`)
        if (sessoesRaw[mentionDigits]) {
          console.log(`[COMPRA-DEBUG2] MATCH! sessao encontrada para essa chave: ${JSON.stringify(sessoesRaw[mentionDigits])}`)
        } else {
          console.log(`[COMPRA-DEBUG2] SEM MATCH para mentionDigits=${mentionDigits}`)
        }
      } catch (errDebug2) { console.log('[COMPRA-DEBUG2] erro:', errDebug2.message) }

      const configBotNumber = config.botNumber ? config.botNumber.replace(/\D/g, '') : ''
      const botJid = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net' : ''
      const isBotMention = mentionId === botJid
        || (configBotNumber && mentionId.includes(configBotNumber))
        || (sock.user?.id && mentionId.includes(sock.user.id.split(':')[0].split('@')[0]))

      if (isBotMention) {
        await sock.sendMessage(from, { text: '❌ *Operação inválida!* O bot não pode comprar Megas. Por favor, marque um usuário válido.' }, { quoted: msg })
        return
      }

      const { buscarEntregaPendentePorCliente, buscarEntregaPendentePorCodigo, consumirEntregaPendente } = require('./entregasPendentes')
      const { registrarEntregaRecibo } = require('../vendas/recibos')

      const sessaoRecibo = getSessao(mentionId)
      let entregaPendente = buscarEntregaPendentePorCliente(from, mentionId)

      let codigoCitado = null
      let numeroCitado = null
      const quotedText = quotedMsg?.conversation || quotedMsg?.text || quotedMsg?.caption || ''
      if (quotedText) {
        const mRef = quotedText.match(/(?:Referência|Recibo|Código|Ref|ID|Tx|Confirmado)[\s:*#]+([A-Za-z0-9.]{8,30})/i)
        if (mRef) {
          codigoCitado = mRef[1].replace(/[*_~`]/g, '').trim().toUpperCase()
          const epCitada = buscarEntregaPendentePorCodigo(codigoCitado)
          if (epCitada) entregaPendente = epCitada
        }
        const mNum = quotedText.match(/\b(8[457]\d{7})\b/)
        if (mNum) numeroCitado = mNum[1]
      }

      const temReciboPendente = !!(
        (sessaoRecibo && sessaoRecibo.codigo) ||
        (entregaPendente && entregaPendente.codigo) ||
        codigoCitado
      )

      if (!planoInformado && !temReciboPendente) {
        await sock.sendMessage(from, { text: '❌ Informe o pacote.\n\nExemplo:\n• .compra 1024MB _(respondendo msg)_\n• .compra 500MB @user\n\n💡 _Se o cliente enviou um comprovante, basta responder a ele com apenas_ `.compra` _que eu puxo o ID, o valor e os megas reais automaticamente._' }, { quoted: msg })
        return
      }

      const textoTabela = obterTabelaMegasGrupo(from) || getNanoCommand(from, 'tabela')

      let tipoPacote = entregaPendente?.pacote ? 'Diário' : 'Diário/Semanal'
      let valorExib = entregaPendente?.valor || (sessaoRecibo ? sessaoRecibo.valor : 'venda manual')
      let referenciaCompra = entregaPendente?.codigo || sessaoRecibo?.codigo || codigoCitado || null
      let numeroDestinoReal = entregaPendente?.numero || sessaoRecibo?.numero || sessaoRecibo?.numeroPreInformado || numeroCitado || null

      if (!referenciaCompra) {
        const { proximoNumeroManual } = require('../vendas/manualCounter')
        referenciaCompra = proximoNumeroManual()
      }

      if (planoInformado) {

        if (textoTabela) {
          const pacoteDados = buscarDadosPorPacoteNaTabela(plano, textoTabela)
          if (pacoteDados) {
            tipoPacote = pacoteDados.tipo || tipoPacote
            if (!temReciboPendente || !valorExib || valorExib === 'venda manual') valorExib = pacoteDados.preco
            plano = pacoteDados.gb || (pacoteDados.mb >= 1024 ? pacoteDados.gb : pacoteDados.mb + 'MB')
          }
        }
      } else {

        const valorCalc = (valorExib && !String(valorExib).includes('manual')) ? valorExib : 0
        let megas = null
        if (textoTabela && valorCalc) megas = calcularMegasPorTexto(valorCalc, textoTabela)
        if (!megas && valorCalc) megas = calcularMegas(valorCalc, from)
        if (megas) {
          plano = megas.gb || (parseInt(megas.mb, 10) >= 1024 ? (parseInt(megas.mb, 10) / 1024).toFixed(1) + 'GB' : megas.mb + 'MB')
          if (megas.tipo) tipoPacote = megas.tipo
        } else if (entregaPendente?.pacote) {
          plano = entregaPendente.pacote
        } else {
          plano = 'MANUAL'
        }
      }

      const valorDisplay = (valorExib === null || valorExib === undefined || String(valorExib).toLowerCase().includes('manual'))
        ? 'venda manual'
        : (/mt/i.test(String(valorExib)) ? String(valorExib) : `${valorExib}MT`)

      let clienteNome = 'Cliente'
      try {
        const { loadMapeamento } = require('./core.js')
        const mapeamento = loadMapeamento()
        const targetNumber = mentionId.split('@')[0].split(':')[0]
        if (mapeamento[targetNumber] && mapeamento[targetNumber].nome) {
          clienteNome = mapeamento[targetNumber].nome
        } else {
          clienteNome = `@${targetNumber}`
        }
      } catch {
        clienteNome = `@${mentionId.split('@')[0]}`
      }

      const stats = registrarVenda(from, mentionId, clienteNome, plano)

      const { registrarCompraManualRecente } = require('../vendas/compraManualLock')
      registrarCompraManualRecente(from, mentionId)

      if (entregaPendente) consumirEntregaPendente(entregaPendente)
      limparSessao(mentionId, from)
      if (referenciaCompra && !referenciaCompra.startsWith('ML') && !referenciaCompra.startsWith('MANUAL')) {
        const { parseToMB } = require('../vendas/tracker')
        const megasQtd = parseToMB(plano) || 0
        const valorNum = parseFloat(String(valorExib).replace(/[^\d.]/g, '')) || 0
        registrarEntregaRecibo(referenciaCompra, megasQtd, valorNum)
      }

      const isSaldoCompra = tipoPacote && tipoPacote.toLowerCase().includes('saldo')
      const rotuloCompra = isSaldoCompra ? '💰 *Saldo:*' : '📊 *Megas:*'
      const horaStr = formatarDataHoraMensagem()
      const numCompradorLimpo = mentionId ? mentionId.split('@')[0].split(':')[0] : 'Cliente'
      const numDestinoDisplay = numeroDestinoReal ? numeroDestinoReal : `@${numCompradorLimpo}`

      const respostaSistema = [
        '*Transação Concluída Com Sucesso*',
        '',
        `📱 *Número:* ${numDestinoDisplay}`,
        `${rotuloCompra} ${plano}`,
        `🔖 *Referência:* ${referenciaCompra}`,
        `⏰ *Data/Hora:* ${horaStr}`,
        '👤 *Atendente:* Administrador',
        '',
        '_Transferencia Concluída Pelos Administradores_'
      ].join('\n')

      await sock.sendMessage(from, { text: respostaSistema, mentions: [mentionId] }, { quoted: msg })

      const { isRankingAtivo } = require('../vendas/gruposConfig')
      if (isRankingAtivo(from) && stats) {
        try {
          const compDesc = isSaldoCompra ? `${valorDisplay} MT` : (stats.totalHojeMB ? `${plano}` : plano)
          const totalHojeDesc = isSaldoCompra ? stats.totalHojeSaldoFormatado : stats.totalHojeMBFormatado
          const totalSempreDesc = isSaldoCompra ? `${stats.totalSaldo} MT` : stats.totalFormatado
          const posDia = isSaldoCompra ? stats.posicaoDiaSaldo : stats.posicaoDiaMB
          const totalDia = isSaldoCompra ? stats.totalCompradoresHojeSaldo : stats.totalCompradoresHojeMB
          const posGeral = isSaldoCompra ? stats.posicaoSaldo : stats.posicaoMB
          const totalGeral = isSaldoCompra ? stats.totalCompradoresSaldo : stats.totalCompradoresMB
          const topGeral = isSaldoCompra ? stats.topGrupoSaldo : stats.topGrupoMB

          const msgRanking = [
            `✅ Obrigado, @${numCompradorLimpo} Você está fazendo a sua ${stats.comprasHoje}ª compra do dia!`,
            '',
            `💰 Compra: ${compDesc}`,
            `📊 Total Hoje: ${totalHojeDesc}`,
            `📊 Total Sempre: ${totalSempreDesc}`,
            `🏅 Posição Dia: ${posDia}º lugar (de ${totalDia})`,
            '',
            `Você está em ${posGeral}º lugar! (de ${totalGeral} compradores). Continue comprando para subir e desbloquear bônus especiais. O líder já acumulou ${topGeral}! 🏆`
          ].join('\n')

          await sock.sendMessage(from, { text: msgRanking, mentions: [mentionId] })
        } catch (eRank) {
          console.error('[COMPRA] Erro ao enviar ranking:', eRank.message)
        }
      }

    } catch (errCompra) {
      console.error('[ERRO-COMPRA] Falha no comando .compra:', errCompra)
      await sock.sendMessage(from, { text: `❌ Erro ao processar compra: ${errCompra.message}` }, { quoted: msg })
    }
    return
  }

  if (text.startsWith(config.prefix + 'saldo')) {
    if (!isAdminUser && !isOwner) {
      await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
      return
    }

    try {
      const { registrarVenda } = require('../vendas/tracker')
      let valorStr = body.slice((config.prefix + 'saldo').length).trim()

      valorStr = valorStr.replace(/@\d+/g, '').trim()

      if (!valorStr) {
        await sock.sendMessage(from, { text: '❌ Informe o valor do saldo.\n\nExemplo:\n• .saldo 100 _(respondendo msg)_\n• .saldo 100 @user' }, { quoted: msg })
        return
      }

      const valor = parseFloat(valorStr.replace(/[^\d.]/g, ''))
      if (isNaN(valor) || valor <= 0) {
        await sock.sendMessage(from, { text: '❌ Valor de saldo inválido! Informe um número maior que zero.' }, { quoted: msg })
        return
      }

      const mentions = messageContent?.extendedTextMessage?.contextInfo?.mentionedJid || []

      const quotedMsg = messageContent?.extendedTextMessage?.contextInfo
        || messageContent?.imageMessage?.contextInfo
        || messageContent?.videoMessage?.contextInfo

      let mentionId = mentions[0] || quotedMsg?.participant || quotedMsg?.remoteJid || null

      if (!mentionId) {
        await sock.sendMessage(from, { text: '❌ Marque a mensagem do cliente ou mencione @cliente.\n\nExemplo:\n• .saldo 100 _(respondendo msg)_\n• .saldo 100 @user' }, { quoted: msg })
        return
      }

      const configBotNumber = config.botNumber ? config.botNumber.replace(/\D/g, '') : ''
      const botJid = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net' : ''
      const isBotMention = mentionId === botJid
        || (configBotNumber && mentionId.includes(configBotNumber))
        || (sock.user?.id && mentionId.includes(sock.user.id.split(':')[0].split('@')[0]))

      if (isBotMention) {
        await sock.sendMessage(from, { text: '❌ *Operação inválida!* O bot não pode comprar Saldo. Por favor, marque um usuário válido.' }, { quoted: msg })
        return
      }

      let clienteNome = 'Cliente'
      try {
        const { loadMapeamento } = require('./core.js')
        const mapeamento = loadMapeamento()
        const targetNumber = mentionId.split('@')[0].split(':')[0]
        if (mapeamento[targetNumber] && mapeamento[targetNumber].nome) {
          clienteNome = mapeamento[targetNumber].nome
        } else {
          clienteNome = `@${targetNumber}`
        }
      } catch {
        clienteNome = `@${mentionId.split('@')[0]}`
      }

      const pacoteStr = `${valor}MT Saldo`

      const { buscarEntregaPendentePorCliente, buscarEntregaPendentePorCodigo, consumirEntregaPendente } = require('./entregasPendentes')
      const { registrarEntregaRecibo } = require('../vendas/recibos')

      const sessaoRecibo = getSessao(mentionId)
      let entregaPendente = buscarEntregaPendentePorCliente(from, mentionId)

      let codigoCitado = null
      let numeroCitado = null
      const quotedText = quotedMsg?.conversation || quotedMsg?.text || quotedMsg?.caption || ''
      if (quotedText) {
        const mRef = quotedText.match(/(?:Referência|Recibo|Código|Ref|ID|Tx|Confirmado)[\s:*#]+([A-Za-z0-9.]{8,30})/i)
        if (mRef) {
          codigoCitado = mRef[1].replace(/[*_~`]/g, '').trim().toUpperCase()
          const epCitada = buscarEntregaPendentePorCodigo(codigoCitado)
          if (epCitada) entregaPendente = epCitada
        }
        const mNum = quotedText.match(/\b(8[457]\d{7})\b/)
        if (mNum) numeroCitado = mNum[1]
      }

      let referenciaSaldo = entregaPendente?.codigo || sessaoRecibo?.codigo || codigoCitado || ('SALDO-' + Date.now().toString().slice(-6))
      let numeroDestinoReal = entregaPendente?.numero || sessaoRecibo?.numero || sessaoRecibo?.numeroPreInformado || numeroCitado || null

      if (entregaPendente) consumirEntregaPendente(entregaPendente)
      if (sessaoRecibo && sessaoRecibo.codigo) {
        marcarReciboUsado(sessaoRecibo.codigo, { valor, destino: 'MANUAL_SALDO', por: 'admin' })
        limparSessao(mentionId, from)
      }
      if (referenciaSaldo && !referenciaSaldo.startsWith('SALDO-')) {
        registrarEntregaRecibo(referenciaSaldo, 0, valor)
      }

      const stats = registrarVenda(from, mentionId, clienteNome, pacoteStr, true)

      const { isRankingAtivo } = require('../vendas/gruposConfig')
      const horaStr = formatarDataHoraMensagem()
      const numCompradorLimpo = mentionId ? mentionId.split('@')[0].split(':')[0] : 'Cliente'
      const numDestinoDisplay = numeroDestinoReal ? numeroDestinoReal : `@${numCompradorLimpo}`

      const respostaSistema = [
        '*Transação Concluída Com Sucesso*',
        '',
        `📱 *Número:* ${numDestinoDisplay}`,
        `💰 *Saldo:* ${valor} MT`,
        `🔖 *Referência:* ${referenciaSaldo}`,
        `⏰ *Data/Hora:* ${horaStr}`,
        '👤 *Atendente:* Administrador',
        '',
        '_Transferencia Concluída Pelos Administradores_'
      ].join('\n')

      await sock.sendMessage(from, { text: respostaSistema, mentions: [mentionId] }, { quoted: msg })
      try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}

      if (isRankingAtivo(from) && stats) {
        try {
          const compDesc = `${valor} MT`
          const totalHojeDesc = stats.totalHojeSaldoFormatado
          const totalSempreDesc = `${stats.totalSaldo} MT`
          const posDia = stats.posicaoDiaSaldo
          const totalDia = stats.totalCompradoresHojeSaldo
          const posGeral = stats.posicaoSaldo
          const totalGeral = stats.totalCompradoresSaldo
          const topGeral = stats.topGrupoSaldo

          const msgRanking = [
            `✅ Obrigado, @${numCompradorLimpo} Você está fazendo a sua ${stats.comprasHoje}ª compra do dia!`,
            '',
            `💰 Compra: ${compDesc}`,
            `📊 Total Hoje: ${totalHojeDesc}`,
            `📊 Total Sempre: ${totalSempreDesc}`,
            `🏅 Posição Dia: ${posDia}º lugar (de ${totalDia})`,
            '',
            `Você está em ${posGeral}º lugar! (de ${totalGeral} compradores). Continue comprando para subir e desbloquear bônus especiais. O líder já acumulou ${topGeral}! 🏆`
          ].join('\n')

          await sock.sendMessage(from, { text: msgRanking, mentions: [mentionId] })
        } catch (eRank) {
          console.error('[SALDO] Erro ao enviar ranking:', eRank.message)
        }
      }

    } catch (errSaldo) {
      console.error('[ERRO-SALDO] Falha no comando .saldo:', errSaldo)
      await sock.sendMessage(from, { text: `❌ Erro ao processar saldo: ${errSaldo.message}` }, { quoted: msg })
    }
    return
  }

  const textoAnalise = msg.textoOCR || body

  const isConfirmacaoEnvio = textoAnalise.includes('Transferiste com sucesso') ||
                             textoAnalise.includes('recebeu uma oferta de dados') ||
                             /Pagamento Não Confirmado|NÚMERO DE DESTINO NÃO AUTORIZADO|RECIBO JÁ UTILIZADO|COMPROVANTE ARQUIVADO|Depósito confirmado com sucesso|FORMAS DE PAGAMENTO|GRUPO SEM CONTAS|SMS ainda não recebido|Não consegui ler o valor/i.test(textoAnalise)

  const temIndicioRecibo = podeProcessarRecibo && !isConfirmacaoEnvio && (REGEX_PARECE_COMPROVANTE.test(textoAnalise) || textoAnalise.includes('Transferiste') || textoAnalise.includes('transfered') || textoAnalise.includes('Confirmado') || textoAnalise.includes('Confirmed') || textoAnalise.includes('sent') || textoAnalise.includes('Transaction') || textoAnalise.includes('transacao') || textoAnalise.includes('Valor enviado') || textoAnalise.includes('transferir dinheiro') || textoAnalise.includes('Destinatario') || textoAnalise.includes('Destinatário') || /realizada com.*sucesso/i.test(textoAnalise) || textoAnalise.includes('Montante') || textoAnalise.includes('Transação') || /ID\s*Trans/i.test(textoAnalise) || /Enviou para/i.test(textoAnalise) || /valor[:\s]+[\d.,]+\s*MT/i.test(textoAnalise))

  if (temIndicioRecibo) {

    const regexIdTrans = /ID\s*Trans[:\s]+([A-Z0-9]+(?:[\.\-][A-Z0-9]+)*)[\s\S]*?(?:Enviou|Transferiste|transferiu|paid|sent)[\s\S]*?para\s+(?:o\s+)?(?:MPESA|M-Pesa|e-Mola|conta)?\s*(\d{8,12})[\s\S]*?valor[:\s]+([\d.,]+)\s*MT/i
    const regexIdTransGeneric = /ID\s*Trans[:\s]+([A-Z0-9]+(?:[\.\-][A-Z0-9]+)*)[\s\S]*?valor[:\s]+([\d.,]+)\s*MT/i

    const regexMpesaDefault = /Confirmado[.\s]+([A-Z0-9]+)[.\s]+Transferiste\s+([\d.,]+)\s*MT\s+para\s+(\d+)/i

    const regexMpesaTaxa = /Confirmado\s+([A-Z0-9]+)[.\s]*Transferiste\s+([\d.,]+)\s*MT[\s\S]*?para\s+(\d{8,12})/i

    const regexMpesaEN = /Transaction ID\s+([A-Z0-9.]+)[\s\S]*?You transfer(?:r)?ed\s+([\d.,]+)\s*MT[\s\S]*?to\s+(\d{8,12})(?:[\s\S]*?name:\s*([^\n\r,]+))?/i

    const regexMpesaSentEN = /([A-Z0-9]+)\s+Confirmed\.?\s+([\d.,]+)\s*MT\s+sent[\s\S]*?to\s+(\d+)/i

    const regexEmola = /ID da transacao[:\s]+([A-Z0-9.\-]+)[\s\S]*?Transferiste\s+([\d.,]+)\s*MT[\s\S]*?(?:para\s+(?:conta\s+)?|para\s+)(\d{8,12})/i
    const regexEmolaEN = /Transaction ID\s+([A-Z0-9.\-]+)[\s\S]*?You transfer(?:r)?ed\s+([\d.,]+)\s*MT[\s\S]*?(?:to\s+(?:account\s+)?|to\s+)(\d+)/i

    const regexSimo = /ID da transacao[:\s]+([A-Z0-9.]+)[.\s]*Acabou de transferir dinheiro para o MPESA\s+(\d+)\s+atraves do SIMO[\s\S]*?montante:\s*([\d.,]+)\s*MT/i

    const regexPdfApp = /Valor enviado\s*([\d.,]+)\s*MT[\s\S]*?Enviado para[\s\S]*?([0-9\s+]+)[\s\S]*?Número de recibo\s*([A-Z0-9]+)/i

    const regexEmolaApp = /Destinat[aá]rio\s+(\d{8,12})[\s\S]*?Nome\s+([A-Za-zÀ-Úà-ú\s]+?)[\s]*Quantia\s+([\d.,]+)\s*MT/i;

    const regexEmolaAppDetailed = /Destinat[aá]rio\s+(\d{9,12})[\s\S]*?Nome\s+([A-ZÀ-Úa-zà-ú\s]+?)[\s\S]*?Quantia\s+([\d.,]+)\s*MT/i

    const regexEmolaPP = /([A-ZÀ-Úa-zà-ú\s]+)\s+([\d.,]+)\s*MT[\s\S]*?Para\s+(\d{8,12})[\s\S]*?(PP\d+\.[\w.]+)/i

    let match = null
    let tipo = 'MPESA'
    let codigo = ''
    let valor = 0
    let numeroDestino = ''
    let sistema = ''
    let nome = ''

    const regexMultiGeral = /(?:Confirmado|Confirmed|ID da transacao|Transaction ID)[.\s]+([A-Z0-9.\-]+)[.\s]*(?:Transferiste|You transfer(?:r)?ed|transfer(?:r)?ed|sent)\s+([\d.,]+)\s*MT[\s\S]*?(?:para\s+(?:conta\s+)?|to\s+(?:account\s+)?)([\d]{8,12})/gi;
    const regexMultiSentEN = /([A-Z0-9]+)\s+Confirmed\.?\s+([\d.,]+)\s*MT\s+sent[\s\S]*?to\s+(\d+)/gi;
    const regexMultiEmola = /(?:ID\s+da\s+Transa[cç][aã]o|ID\s+Trans|Recibo)[:\s\n]+([A-Z0-9.\-]+)[\s\S]*?(?:Montante|Quantia|Valor|Transferiste)[:\s\n]+([\d.,]+)\s*MT[\s\S]*?(?:Para|Destinat[aá]rio)[:\s\n]+(?:conta\s+)?(\d{8,12})/gi;
    let multiMatch;
    const { parseMonetaryValue, extractReceiptCodeFromFileName } = require('../utils/monetaryHelper');

    let todasTransacoes = [];
    while ((multiMatch = regexMultiGeral.exec(textoAnalise)) !== null) {
      todasTransacoes.push({ codigo: multiMatch[1].trim().replace(/\.$/, ''), valor: parseMonetaryValue(multiMatch[2]), destino: multiMatch[3] });
    }
    while ((multiMatch = regexMultiSentEN.exec(textoAnalise)) !== null) {
      todasTransacoes.push({ codigo: multiMatch[1].trim().replace(/\.$/, ''), valor: parseMonetaryValue(multiMatch[2]), destino: multiMatch[3] });
    }
    while ((multiMatch = regexMultiEmola.exec(textoAnalise)) !== null) {
      todasTransacoes.push({ codigo: multiMatch[1].trim().replace(/\.$/, ''), valor: parseMonetaryValue(multiMatch[2]), destino: multiMatch[3] });
    }

    const codigosVistos = new Set();
    todasTransacoes = todasTransacoes.filter(t => {
      if (!t.codigo || codigosVistos.has(t.codigo)) return false;
      codigosVistos.add(t.codigo);
      return true;
    });

    let matchCodUniversal = textoAnalise.match(/^([A-Z0-9]{8,22})\s+(?:Confirmado|Confirmed)/i) ||
                              textoAnalise.match(/(?:N[úu]mero de recibo|Recibo|ID Trans|ID da transa[cç][aã]o|Transaction ID|Transa[cç][aã]o)[:\s\n]+([A-Z0-9]+(?:[\.\-][A-Z0-9]+)*)/i) ||
                              textoAnalise.match(/(?:Confirmado|Confirmed)[.\s]+(?!\b(?:Transferiste|You|Recebeste|Comprovativo)\b)(?=.*\d)([A-Z0-9]{8,22})/i) ||
                              textoAnalise.match(/\b(PP\d{6}\.[A-Z0-9.]+)\b/i) ||
                              textoAnalise.match(/\b(PP\d{6}[A-Z0-9]{6,12})\b/i) ||
                              textoAnalise.match(/\b(CO\d{6}\.[A-Z0-9.]+)\b/i) ||
                              textoAnalise.match(/\b(CO\d{6}[A-Z0-9]{6,12})\b/i) ||
                              textoAnalise.match(/\b(DHS[A-Z0-9]{8,12})\b/i) ||
                              textoAnalise.match(/\b(?=.*\d)([DC][A-Z0-9]{9,11})\b/i);

    const docFileName = msg.docFileName || (msg.message?.documentMessage?.fileName || '');
    const codigoDoArquivo = extractReceiptCodeFromFileName(docFileName);
    if (codigoDoArquivo && isValidReceiptCode(codigoDoArquivo)) {
      matchCodUniversal = [docFileName, codigoDoArquivo];
    }

    const matchValorUniversal = textoAnalise.match(/(?:Valor enviado|Montante|Quantia|Valor|Transferiste|You transfer(?:r)?ed|transfer(?:r)?ed|sent)[:\s\n]+([\d.,]+)\s*MT/i) ||
                                textoAnalise.match(/([\d.,]+)\s*MT/i);

    const matchDestUniversal = textoAnalise.match(/(?:Enviado para|Enviou para o|Enviou para|Transferiste para o|Transferiste para)[:\s\n]+(?:(?:MPESA|M-Pesa|e-Mola|conta)\s+)?(?:[A-ZÀ-Úa-zà-ú\s,]+?)?(?:\+?258\s*)?(\d[\d\s]{7,14}\d)/i) ||
                               textoAnalise.match(/(?:to\s+(?:account\s+)?|to\s+)(?:[A-ZÀ-Úa-zà-ú\s,]+?)?(?:\+?258\s*)?(\d[\d\s]{7,14}\d)/i) ||
                               textoAnalise.match(/(?:Para|Destinat[aá]rio)[:\s\n]+(?:conta\s+)?(?:\+?258\s*)?(\d[\d\s]{7,14}\d)/i) ||
                               textoAnalise.match(/(?:para\s+conta|para\s+o\s+n[úu]mero|para\s+o\s+MPESA|para\s+o\s+e-Mola|para\s+MPESA|para\s+e-Mola|para)\s+(?:\+?258\s*)?(\d[\d\s]{7,14}\d)/i);

    const matchNomeUniversal = textoAnalise.match(/(?:Nome|name|Enviado para)[:\s\n]+([A-ZÀ-Úa-zà-ú\s]+?)(?:,|\r?\n|ID|Data|at\s+\d|\+?\d|$)/i);

    if (matchCodUniversal && matchValorUniversal) {
      codigo = matchCodUniversal[1].trim().replace(/\.$/, '');
      valor = parseMonetaryValue(matchValorUniversal[1]);
      if (matchDestUniversal) {
        let rawD = matchDestUniversal[1].replace(/\D/g, '');
        if (rawD.startsWith('258') && rawD.length > 9) rawD = rawD.slice(3);
        numeroDestino = rawD;
      }
      if (matchNomeUniversal) {
        nome = matchNomeUniversal[1].trim();
      }
      sistema = (/e-Mola/i.test(textoAnalise) || /PP\d{6}\./i.test(textoAnalise)) ? 'E-Mola' : 'M-Pesa';
      match = [textoAnalise, codigo, valor, numeroDestino];
    }

    if (todasTransacoes.length < 2) {
      const regexMultiApp = /Destinat[aá]rio\s+(\d{8,12})[\s\S]*?Quantia\s+([\d.,]+)\s*MT/gi;
      let appMatch;
      todasTransacoes = [];
      while ((appMatch = regexMultiApp.exec(textoAnalise)) !== null) {
        todasTransacoes.push({ codigo: 'EMAPP' + Math.random().toString(36).substring(7, 15).toUpperCase(), valor: parseMonetaryValue(appMatch[2]), destino: appMatch[1] });
      }
    }

    if (todasTransacoes.length >= 2) {
      await sock.sendMessage(from, {
        text: `⚠️ *MÚLTIPLAS TRANSAÇÕES DETECTADAS*\n\nForam encontradas ${todasTransacoes.length} transações nesta mensagem. Por favor, envie cada comprovante separadamente para atendimento manual.`
      }, { quoted: msg })
      return
    }

    const isEmolaReceipt = /e-Mola/i.test(textoAnalise) || /PP\d{6}\./i.test(textoAnalise) || /ID\s+da\s+Transa[cç][aã]o/i.test(textoAnalise)
    if (isEmolaReceipt) {
      const matchCodigo = textoAnalise.match(/(?:ID\s+da\s+Transa[cç][aã]o|ID\s+Trans|Recibo)[:\s\n]+([A-Z0-9.\-]+)/i) ||
                          textoAnalise.match(/\b(PP\d{6}\.[A-Z0-9.]+)\b/i)
      const matchValor = textoAnalise.match(/(?:Montante|Quantia|Valor)[:\s\n]+([\d.,]+)\s*MT/i) ||
                         textoAnalise.match(/Transferiste\s+([\d.,]+)\s*MT/i) ||
                         textoAnalise.match(/([\d.,]+)\s*MT/i)
      const matchPara = textoAnalise.match(/(?:Para|Destinat[aá]rio)[:\s\n]+(?:conta\s+)?(\d{8,12})/i) ||
                        textoAnalise.match(/(?:para\s+conta|para\s+o\s+número|para|to\s+(?:account\s+)?|to\s+)(\d{8,12})/i)
      const matchNome = textoAnalise.match(/(?:Nome|name)[:\s\n]+([A-ZÀ-Úa-zà-ú\s]+?)(?:\r?\n|ID|Data|at\s+\d|$)/i)

      if (matchCodigo && matchValor && matchPara) {
        sistema = 'E-Mola'
        codigo = matchCodigo[1].trim().replace(/\.$/, '')
        valor = parseMonetaryValue(matchValor[1])
        numeroDestino = matchPara[1].trim()
        if (matchNome) nome = matchNome[1].trim()
        match = [textoAnalise, codigo, valor, numeroDestino]
      }
    }

    if (match) {

    } else if ((match = textoAnalise.match(regexIdTrans))) {
      sistema = 'M-Pesa'
      codigo = match[1]
      numeroDestino = match[2]
      valor = parseMonetaryValue(match[3])
    } else if ((match = textoAnalise.match(regexIdTransGeneric))) {
      sistema = 'M-Pesa'
      codigo = match[1]
      valor = parseMonetaryValue(match[2])
      const numMatch = textoAnalise.match(/para\s+(?:o\s+)?(?:MPESA|M-Pesa|e-Mola|conta)?\s*(\d{8,12})/i)
      numeroDestino = numMatch ? numMatch[1] : ''
    } else if ((match = textoAnalise.match(regexMpesaDefault))) {
      sistema = 'M-Pesa'
      codigo = match[1]
      valor = parseMonetaryValue(match[2])
      numeroDestino = match[3]
    } else {
      match = textoAnalise.match(regexMpesaTaxa)
      if (match) {
        sistema = 'M-Pesa'
        codigo = match[1]
        valor = parseMonetaryValue(match[2])
        numeroDestino = match[3]
      } else {
        const regexMpesaFlex = /Confirmado\s+([A-Z0-9]+)[.\s]*Transferiste\s+([\d.,]+)\s*MT[\s\S]*?(?:para\s+([^\n\r,]+))?/i
        const matchFlex = textoAnalise.match(regexMpesaFlex)
        if (matchFlex) {
          sistema = 'M-Pesa'
          codigo = matchFlex[1]
          valor = parseMonetaryValue(matchFlex[2])
          const rawDest = (matchFlex[3] || '').trim()
          const digits = rawDest.replace(/\D/g, '')
          if (digits.length >= 8) {
            numeroDestino = digits.slice(-9)
          } else {
            try {
              const { contasStore } = require('../utils/firebaseDataLayer')
              const dContas = contasStore.loadSync() || {}
              const cGp = dContas[from] || {}
              const todasContas = [...(cGp.mpesa || []), ...(cGp.emola || [])]
              const contaEncontrada = todasContas.find(c => (c.nome && rawDest.toLowerCase().includes(c.nome.toLowerCase())) || (c.numero && rawDest.includes(c.numero.slice(0, 4))))
              if (contaEncontrada) {
                numeroDestino = contaEncontrada.numero
              } else if (todasContas.length === 1) {
                numeroDestino = todasContas[0].numero
              }
            } catch {}
          }
          match = matchFlex
        } else {
          match = textoAnalise.match(regexMpesaEN) || textoAnalise.match(regexMpesaSentEN)
          if (match) {
            sistema = 'M-Pesa'
            codigo = match[1].trim().replace(/\.$/, '')
            valor = parseMonetaryValue(match[2])
            numeroDestino = match[3]
          } else {
            match = textoAnalise.match(regexEmola) || textoAnalise.match(regexEmolaEN)
            if (match) {
              sistema = 'E-Mola'
              codigo = match[1].trim().replace(/\.$/, '')
              valor = parseMonetaryValue(match[2])
              numeroDestino = match[3]
            } else {

            match = textoAnalise.match(regexSimo)
            if (match) {
              sistema = 'SIMO'

              codigo = match[1]
              numeroDestino = match[2]
              valor = parseMonetaryValue(match[3])
            } else {

              match = textoAnalise.match(regexPdfApp)
              if (match) {
                sistema = 'M-Pesa App'

                valor = parseMonetaryValue(match[1])

                let rawNum = match[2].replace(/\D/g, '')
                if (rawNum.startsWith('258')) rawNum = rawNum.slice(3)
                numeroDestino = rawNum

                codigo = match[3]
              } else {

                const matchPP = textoAnalise.match(regexEmolaPP);
                if (matchPP) {
                  match = matchPP;
                  sistema = 'E-Mola';
                  nome = match[1].trim();
                  valor = parseMonetaryValue(match[2]);
                  numeroDestino = match[3];
                  codigo = match[4];
                } else {

                  const matchDet = textoAnalise.match(regexEmolaAppDetailed) || textoAnalise.match(regexEmolaApp);
                  if (matchDet) {
                    match = matchDet;
                    sistema = 'E-Mola App';
                    numeroDestino = match[1];
                    nome = match[2]?.trim() || '';
                    valor = parseMonetaryValue(match[3]);

                    const realIdMatch = textoAnalise.match(/(PP\d+\.[\w.]+)/i);
                    codigo = realIdMatch ? realIdMatch[1] : 'EMAPP-' + Date.now().toString().slice(-8);
                  } else {

                  const isEmolaApp = /transacao foi realizada com/i.test(textoAnalise) || /realizada com.*sucesso/i.test(textoAnalise);
                  if (isEmolaApp) {
                    const textoBusca = msg.textoOCRPuro || textoAnalise;
                    const phoneMatch = textoBusca.match(/(?:84|85|86|87)\d{7}/);
                    const amountMatch = textoBusca.match(/([\d.,]+)\s*MT/i) || textoBusca.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:MT|Mt|mt)/i);

                    if (phoneMatch && amountMatch) {
                      match = ["Fragmented Emola"];
                      sistema = 'E-Mola App';
                      numeroDestino = phoneMatch[0];
                      valor = parseMonetaryValue(amountMatch[1]);
                      codigo = 'EMAPP' + Date.now().toString().slice(-8);
                    }
                  }

                  if (!match || match[0] !== "Fragmented Emola") {

                    const regexUniversal = /([A-Z0-9.]+)[.\s]+Transferiste\s+([\d.,]+)\s*MT\s+para\s+(?:conta\s+)?(\d+)/i
                    match = textoAnalise.match(regexUniversal)

                    if (match) {
                      sistema = 'Universal'
                      codigo = match[1]

                      if (codigo.includes('transacao')) codigo = codigo.replace('transacao', '').trim()
                      if (body.includes('Transferiste') || body.includes('confirmado') || body.includes('transacao')) {
                        try {
                          const { processarRecibo } = require('../vendas/recibos')
                          await processarRecibo(sock, msg, body, sender)
                        } catch (err) {
                          console.error('Erro ao processar recibo:', err)
                        }
                      }

                      valor = parseMonetaryValue(match[2])
                      numeroDestino = match[3]
                    } else {

                      const regexUniversalEN = /([A-Z0-9.]+)[.\s]+(?:You transfer(?:r)?ed|transfer(?:r)?ed)\s+([\d.,]+)\s*MT\s+(?:to\s+(?:account\s+)?|to\s+)(\d+)/i
                      match = textoAnalise.match(regexUniversalEN)
                      if (match) {
                        sistema = 'UniversalEN'
                        codigo = match[1].trim().replace(/\.$/, '')
                        if (codigo.includes('Transaction')) codigo = codigo.replace('Transaction', '').trim()
                        if (body.includes('transfered') || body.includes('Transaction')) {
                          try {
                            const { processarRecibo } = require('../vendas/recibos')
                            await processarRecibo(sock, msg, body, sender)
                          } catch (err) {
                            console.error('Erro ao processar recibo em inglês:', err)
                          }
                        }
                        valor = parseMonetaryValue(match[2])
                        numeroDestino = match[3]
                      }
                    }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

    function isValidReceiptCode(code) {
        if (!code || typeof code !== 'string') return false
        const clean = code.trim()

        const palavrasNegadas = /^(confirmado|confirmed|transferiste|transfered|transferred|transferencia|transferência|destinatario|destinatário|comprovativo|pagamento|movitel|vodacom|mpesa|m-pesa|emola|e-mola|transacao|transacção|transação|sucesso|montante|valor|obrigado|recebeste)$/i
        if (palavrasNegadas.test(clean)) {
            return false
        }

        if (/^(PP|CO)\d{6}/i.test(clean)) {
            if (clean.includes('.')) {
                return clean.length >= 14 && /^[A-Z0-9.]+$/i.test(clean)
            }
            return clean.length >= 12 && clean.length <= 22 && /^[A-Z0-9]+$/i.test(clean)
        }

        if (/^(?=.*\d)[A-Z0-9]{8,20}$/i.test(clean)) {
            return true
        }

        if (/^[A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+$/i.test(clean) && clean.length >= 12 && /\d/.test(clean)) {
            return true
        }

        if (clean.startsWith('EMAPP-') || clean.startsWith('EMAPP')) {
            return true
        }

        if (clean.length >= 8 && /^[A-Z0-9.\-]+$/i.test(clean) && /\d/.test(clean)) {
            return true
        }

        return false
    }

    if (codigo) {
        const docFileName = msg.docFileName || (msg.message?.documentMessage?.fileName || '');
        const fnCode = extractReceiptCodeFromFileName(docFileName);
        if (fnCode && isValidReceiptCode(fnCode)) {
            codigo = fnCode;
        } else if (!isValidReceiptCode(codigo)) {
            const fallbackId = textoAnalise.match(/^([A-Z0-9]{8,22})\s+(?:Confirmado|Confirmed)/i) ||
                               textoAnalise.match(/(?:Confirmado|Confirmed)[.\s]+(?!\b(?:Transferiste|You|Recebeste)\b)(?=.*\d)([A-Z0-9]{8,22})/i) ||
                               textoAnalise.match(/(PP\d{6}\.[A-Za-z0-9.]+)/i) ||
                               textoAnalise.match(/\b(PP\d{6}[A-Z0-9]{6,12})\b/i) ||
                               textoAnalise.match(/(CO\d{6}\.[A-Za-z0-9.]+)/i) ||
                               textoAnalise.match(/\b(CO\d{6}[A-Z0-9]{6,12})\b/i) ||
                               textoAnalise.match(/\b(?=.*\d)([A-Z0-9]{10,20})\b/i);
            if (fallbackId && isValidReceiptCode(fallbackId[1])) {
                codigo = fallbackId[1];
            } else {
                console.log(`[RECIBO] ❌ Código inválido ou quebrado descartado: "${codigo}"`);
                match = null;
            }
        }
    }

    if (!match) {
      const temIndicioForteDeFalha = textoAnalise.includes('Transferiste') || textoAnalise.includes('ID da transacao') || textoAnalise.includes('MPESA') || textoAnalise.includes('conta') || textoAnalise.includes('montante') || textoAnalise.includes('SIMO') || textoAnalise.includes('transferir dinheiro') || textoAnalise.includes('Confirmado')

      if (temIndicioForteDeFalha) {
        const regexPartial = /([A-Z0-9.\-]{8,})[\s\S]*?conta\s+(\d+)/i
        const partial = textoAnalise.match(regexPartial)
        if (partial || textoAnalise.includes('Transferiste') || textoAnalise.includes('ID da transacao') || textoAnalise.includes('Confirmado')) {
          if (!valor || valor <= 0) {
            await sock.sendMessage(from, {
              text: '⚠️ *Não consegui ler o valor!*\n\nO bot identificou o pagamento, mas não encontrou o valor em MT legível.\n\n📝 *Por favor, envie o comprovante nítido ou copie e cole o texto completo da mensagem.*'
            }, { quoted: msg })
            return
          }
          if (!codigo) {
            await sock.sendMessage(from, {
              text: '⚠️ *Não consegui ler a referência!*\n\nO bot identificou a mensagem de pagamento, mas não localizou o código da transação (ex: PP..., CO..., ID da transação).\n\n📝 *Por favor, copie e cole o texto completo do SMS do M-Pesa / e-Mola.*'
            }, { quoted: msg })
            return
          }
          if (!numeroDestino) {
            await sock.sendMessage(from, {
              text: '⚠️ *Número de destino não identificado!*\n\nNão foi possível identificar para qual conta foi transferido o valor.\n\n📝 *Por favor, envie o comprovante completo.*'
            }, { quoted: msg })
            return
          }
        }
      }
      return
    }

    if (match) {
      let data, hora

      const senderNumber = sender ? sender.split('@')[0].split(':')[0] : ''
      const remetente = msg.pushName || (senderNumber ? `@${senderNumber}` : '')

      nome = remetente
      data = new Date().toLocaleDateString('pt-BR')
      hora = new Date().toLocaleTimeString('pt-BR')

      let contasAutorizadas = []
      let tabelaPrecos = null

      try {
        const { contasStore } = require('../utils/firebaseDataLayer')
        let dados = contasStore.loadSync() || {}
        let grupoContas = dados[from] || dados[from.replace(/\./g, '___dot___')] || dados[from.replace(/___dot___/g, '.')]
        if (!grupoContas) {
          await contasStore.load()
          dados = contasStore.getCache() || {}
          grupoContas = dados[from] || dados[from.replace(/\./g, '___dot___')] || dados[from.replace(/___dot___/g, '.')] || {}
        }
        const contasMpesa = grupoContas.mpesa || []
        const contasEmola = grupoContas.emola || []
        contasAutorizadas = [...contasMpesa, ...contasEmola]
      } catch { }

      let contaMatch = null
      if (numeroDestino && String(numeroDestino).replace(/\D/g, '').length >= 8) {
        const d9 = String(numeroDestino).replace(/\D/g, '').slice(-9)
        for (const c of contasAutorizadas) {
          const a9 = String(c.numero).replace(/\D/g, '').slice(-9)

          if (d9 === a9 || (d9.length >= 8 && a9.length >= 8 && (d9.includes(a9) || a9.includes(d9)))) {
            contaMatch = c
            break
          }

          if (d9.length === 9 && a9.length === 9) {
            let diffs = 0
            for (let i = 0; i < 9; i++) {
              if (d9[i] !== a9[i]) diffs++
            }
            if (diffs <= 1) {
              console.log(`[OCR-TOLERANCIA] Conta destino corrigida via OCR: ${numeroDestino} -> ${c.numero}`)
              numeroDestino = c.numero
              contaMatch = c
              break
            }
          }
        }
      }

      if (!contaMatch) {

        limparSessao(sender)

        if (!contasAutorizadas || contasAutorizadas.length === 0) {
          await sock.sendMessage(from, {
            text: [
              '⚠️ *GRUPO SEM CONTAS AUTORIZADAS CONFIGURADAS!*',
              '────────────────────────',
              `📋 *Recibo:* \`${codigo}\` | 💰 *Valor:* ${valor} MT`,
              `📞 *Número Destino:* ${numeroDestino}`,
              '────────────────────────',
              '❌ Este grupo ainda não possui contas oficiais cadastradas no sistema.',
              '',
              '👉 *Administradores:* Cadastrem as contas oficiais com:',
              '• `.configurar M-Pesa [número] [nome]`',
              '• `.configurar E-mola [número] [nome]`'
            ].join('\n')
          }, { quoted: msg })
          await reactMsg('⚠️')
          return
        }

        await sock.sendMessage(from, {
          text: [
            '⚠️ *NÚMERO DE DESTINO NÃO AUTORIZADO!*',
            '────────────────────────',
            `📋 *Recibo:* \`${codigo}\` | 💰 *Valor:* ${valor} MT`,
            `📞 *Destino Transferido:* ${numeroDestino}`,
            '────────────────────────',
            '❌ O número para o qual você transferiu *não corresponde a nenhuma conta de pagamento oficial* deste grupo.',
            '',
            '💡 Verifique se realizou o pagamento para o número correto dos administradores.'
          ].join('\n')
        }, { quoted: msg })
        await reactMsg('❌')
        return
      }

      const { reciboJaUsado, marcarReciboUsado, iniciarProcessamentoRecibo } = require('../vendas/recibos')
      if (reciboJaUsado(codigo) || !iniciarProcessamentoRecibo(codigo)) {
        await sock.sendMessage(from, {
          text: `⚠️ *RECIBO JÁ UTILIZADO!*\n\n📋 Recibo: *${codigo}*\n\n❌ Este comprovativo já foi processado anteriormente.`
        }, { quoted: msg })
        await reactMsg('❌')
        return
      }



      const { foiCompraManualRecente } = require('../vendas/compraManualLock')
      const senderNum = sender.split('@')[0].split(':')[0]
      if (foiCompraManualRecente(from, senderNum) || foiCompraManualRecente(from, sender)) {
        console.log(`[COMPRA-MANUAL-LOCK] Recibo ${codigo} arquivado pois o admin executou .compra nos últimos 90s.`)
        marcarReciboUsado(codigo, { valor, destino: numeroDestino, por: 'compra-manual-admin' })
        limparSessao(sender, from)
        await sock.sendMessage(from, {
          text: `ℹ️ *COMPROVANTE ARQUIVADO*\n\n📋 Recibo: *${codigo}*\n\nO comprovante foi validado e arquivado. Os megas já foram lançados pelo administrador via comando manual.`
        }, { quoted: msg })
        return
      }

      const { obterTodosPacotesPorValor } = require('../vendas/tabela')
      let pacotesDisponiveis = obterTodosPacotesPorValor(valor, from)

      if (pacotesDisponiveis.length === 0) {
        const bodyLimpo = body.replace(/(?<=\d)[ \t-]+(?=\d)/g, '')
        const regexMZ = /\b(258)?(8[45]\d{7})\b/g
        const matchesInline = [...bodyLimpo.matchAll(regexMZ)]
        const destClean = String(numeroDestino || '').replace(/\D/g, '').slice(-9)
        const numsEncontrados = []
        for (const m of matchesInline) {
          const n9 = m[0].replace(/\D/g, '').slice(-9)
          if (n9 !== destClean && !numsEncontrados.includes(n9)) {
            numsEncontrados.push(m[0].replace(/\D/g, ''))
          }
        }

        if (numsEncontrados.length > 1) {
          const valorUnitario = Math.round(valor / numsEncontrados.length)
          const pacotesUnitarios = obterTodosPacotesPorValor(valorUnitario, from)
          if (pacotesUnitarios.length > 0) {
            const pUnit = pacotesUnitarios[0]
            pacotesDisponiveis = [{
              gb: `${pUnit.gb || (pUnit.mb >= 1024 ? (pUnit.mb / 1024) + 'GB' : pUnit.mb + 'MB')} (x${numsEncontrados.length})`,
              mb: (pUnit.mb * numsEncontrados.length).toString(),
              tipo: pUnit.tipo || 'Convencional',
              extraDesc: '',
              preco: valor
            }]
          }
        }
      }

      if (pacotesDisponiveis.length === 0) {
        marcarReciboUsado(codigo)
        limparSessao(sender, from)
        const senderNum = sender.split('@')[0].split(':')[0]
        const mentionJid = sender.includes('@lid') ? sender : (senderNum + '@s.whatsapp.net')
        const msgTabelaInvalida = [
          '⚠️ *VALOR NÃO ENCONTRADO NA TABELA*',
          '────────────────────────',
          `👤 *Cliente:* @${senderNum}`,
          `💵 *Valor:* ${valor} MT`,
          `📋 *Recibo:* \`${codigo}\``,
          '────────────────────────',
          'O valor informado não corresponde a nenhum pacote ativo neste grupo.',
          'Um administrador atenderá o seu pedido manualmente.'
        ].join('\n')

        try {
          await sock.sendMessage(from, { text: msgTabelaInvalida, mentions: [mentionJid] }, { quoted: msg })
        } catch {
          await sock.sendMessage(from, { text: msgTabelaInvalida })
        }
        await reactMsg('⚠️')
        return
      }

      if (pacotesDisponiveis.length > 1) {
        const { extrairNumerosEDistribuirPacotes } = require('../vendas/distribuidorPacotes')
        let pedidosIniciais = extrairNumerosEDistribuirPacotes(body, numeroDestino, pacotesDisponiveis[0], valor)
        if (pedidosIniciais.length === 0) {
          const candidato = consumirNumeroCandidato(sender, from)
          if (candidato) {
            pedidosIniciais = extrairNumerosEDistribuirPacotes(candidato, null, pacotesDisponiveis[0], valor)
          }
        }
        const numPreInformado = pedidosIniciais.length > 0 ? pedidosIniciais[0].numero : null

        const { finalizarProcessamentoRecibo } = require('../vendas/recibos')
        finalizarProcessamentoRecibo(codigo)

        salvarSessao(sender, {
          etapa: 'ESCOLHA_PACOTE',
          codigo: codigo,
          valor: valor,
          nome: nome,
          from: from,
          remetente: sender,
          numeroDestino: numeroDestino,
          data: data,
          hora: hora,
          origem: 'ocr',
          pacotesOpcoes: pacotesDisponiveis,
          numeroPreInformado: numPreInformado
        })

        const opcoesLinhas = pacotesDisponiveis.map((p, idx) => {
          const numEmoji = (idx + 1) === 1 ? '1️⃣' : (idx + 1) === 2 ? '2️⃣' : (idx + 1) === 3 ? '3️⃣' : `${idx + 1}️⃣`
          const duracao = p.tipo === 'Semanal' ? ' (Semanal - 7 Dias)' : (p.tipo === 'Mensal' ? ' (Mensal - 30 Dias)' : (p.tipo === 'Ilimitado' || p.tipo === 'Diamante' ? ' (Diamante - 30 Dias)' : (p.tipo === 'Saldo' ? '' : ' (Diário - 24h)')))
          return `${numEmoji} *${p.gb}*${duracao}`
        }).join('\n')

        const msgEscolha = [
          '✅ *Comprovante Lido com Sucesso!*',
          '',
          `💰 *Valor:* ${valor} MT`,
          `📋 *Recibo:* \`${codigo}\``,
          '────────────────────────',
          '👉 *Detectamos mais de uma opção para este valor neste grupo:*',
          opcoesLinhas,
          '────────────────────────',
          '📱 *Responda com o número da opção e o seu número da Vodacom:*',
          '_Exemplo: 1 841234567_'
        ].join('\n')

        await sock.sendMessage(from, { text: msgEscolha }, { quoted: msg })
        await reactMsg('⏳')
        return
      }

      let megas = pacotesDisponiveis[0]

      const { extrairNumerosEDistribuirPacotes, formatarDadosDisplay } = require('../vendas/distribuidorPacotes')
      let pedidosClientes = extrairNumerosEDistribuirPacotes(body, numeroDestino, megas, valor)
      if (pedidosClientes.length === 0) {
        const candidato = consumirNumeroCandidato(sender, from)
        if (candidato) {
          console.log(`[COMPROVANTE] 🎯 Número candidato recuperado do buffer para ${sender}: ${candidato}`)
          pedidosClientes = extrairNumerosEDistribuirPacotes(candidato, null, megas, valor)
        }
      }

      if (pedidosClientes.length > 0) {
        const { salvarEntregaPendente } = require('./entregasPendentes')
        for (const item of pedidosClientes) {
          const dadosEntrega = {
            clienteId: sender,
            clienteNome: nome,
            numero: item.numero,
            pacote: item.displayPacote,
            valor: item.valor,
            codigo: codigo,
            grupoOrigem: from,
            timestamp: Date.now()
          }
          salvarEntregaPendente(item.numero, dadosEntrega)
          if (!item.numero.startsWith('258')) salvarEntregaPendente('258' + item.numero, dadosEntrega)
          if (item.numero.startsWith('258')) salvarEntregaPendente(item.numero.substring(3), dadosEntrega)
          if (sender) salvarEntregaPendente(sender, dadosEntrega)
          if (codigo) salvarEntregaPendente(codigo, dadosEntrega)
        }

        marcarReciboUsado(codigo)
        const dadosDisplay = formatarDadosDisplay(pedidosClientes)
        const tipoPacoteStr = ((megas && megas.tipo) || '').toLowerCase()
        const isDirectSaldo = tipoPacoteStr.includes('saldo')
        const isOfertaSaldo = tipoPacoteStr.includes('semanal') ||
                              tipoPacoteStr.includes('mensal') ||
                              tipoPacoteStr.includes('diamante') ||
                              tipoPacoteStr.includes('ilimitado') ||
                              tipoPacoteStr.includes('tudo top')
        const isSaldoOrder = isDirectSaldo
        const ussdMethod = (isDirectSaldo || isOfertaSaldo) ? '*111#' : '*162#'
        const isSaldoPacote = isDirectSaldo
        const rotuloItem = isSaldoPacote ? '💰 *Saldo:*' : '📊 *Dados:*'
        const pacoteNome = isSaldoPacote ? 'Saldo' : ((megas && megas.tipo) || 'Convencional')

        const termoEspera = isSaldoPacote ? 'Os administradores realizarão a transferência manual em instantes!' : 'Os administradores realizarão o envio manual em instantes!'

        const respostaSistema = `✅ *Comprovativo Aprovado!*
📦 *Pacote:* ${pacoteNome}
━━━━━━━━━━━━━━━━━━
📢 *Referência:* *${codigo}*
💵 *Valor:* ${valor} MT
${rotuloItem} ${dadosDisplay}
━━━━━━━━━━━━━━━━━━
⏳ _Aguarde... ${termoEspera}_`

        const safeMentionJid = sender ? (String(sender).split('@')[0].split(':')[0] + '@s.whatsapp.net') : null
        try {
          await sock.sendMessage(from, { text: respostaSistema, mentions: safeMentionJid ? [safeMentionJid] : [] }, { quoted: msg })
        } catch {
          try { await sock.sendMessage(from, { text: respostaSistema }) } catch {}
        }
        await reactMsg('⏳')

        limparSessao(sender, from)
        return
      }

      const { finalizarProcessamentoRecibo: finProc } = require('../vendas/recibos')
      finProc(codigo)
      salvarSessao(sender, {
        codigo: codigo,
        valor: valor,
        nome: nome,
        from: from,
        remetente: sender,
        numeroDestino: numeroDestino,
        data: data,
        hora: hora,
        origem: 'ocr',
        sistema: (megas && megas.tipo) || sistema
      })

      const descPacote = megas ? (megas.gb || megas.mb + 'MB') : `${valor}MT`
      await sock.sendMessage(from, {
        text: `✅ *Comprovante Lido com Sucesso!*\n\n💰 *Valor:* ${valor} MT (${descPacote})\n📋 *Recibo:* \`${codigo}\`\n\n📱 *Por favor, envie o seu número da Vodacom para receber os Megas:*\n_Exemplo: 841234567_`
      }, { quoted: msg })
      await reactMsg('⏳')
      return
    }
  }

  const sessao = getSessao(sender, from, msg)

  if (sessao) {

    const { obterInfoRecibo } = require('../vendas/recibos')
    const infoRecibo = sessao.codigo ? obterInfoRecibo(sessao.codigo) : null
    if (infoRecibo && infoRecibo.status === 'USADO' && (infoRecibo.entregueComSucesso || infoRecibo.por === 'compra-manual-admin')) {
      console.warn(`[SESSAO] ⚠️ Bloqueado: comprovante ${sessao.codigo} já foi entregue com sucesso anteriormente.`)
      limparSessao(sender, from)
      return
    }
    let megas = sessao.pacoteEscolhido || null
    let opcaoEscolhida = null

    if (sessao.etapa === 'ESCOLHA_PACOTE' && sessao.pacotesOpcoes && sessao.pacotesOpcoes.length > 0) {
      const bodyTrim = body.trim()
      const matchOpcao = bodyTrim.match(/^\s*(?:op[çc][aã]o\s*)?([1-9])\b/i)
      if (matchOpcao) {
        const idx = parseInt(matchOpcao[1], 10) - 1
        if (idx >= 0 && idx < sessao.pacotesOpcoes.length) {
          opcaoEscolhida = sessao.pacotesOpcoes[idx]
        }
      }

      if (opcaoEscolhida) {
        megas = opcaoEscolhida
        sessao.pacoteEscolhido = opcaoEscolhida
        sessao.etapa = undefined
      } else {

        const pedidosTeste = extrairNumerosEDistribuirPacotes(body, null, sessao.pacotesOpcoes[0], sessao.valor)
        if (pedidosTeste.length === 0) {
          return
        }
      }
    }

    if (!megas) {
      megas = calcularMegas(sessao.valor, from)
    }

    let pedidosClientes = extrairNumerosEDistribuirPacotes(body, null, megas, sessao.valor)

    if (pedidosClientes.length === 0 && opcaoEscolhida && sessao.numeroPreInformado) {
      pedidosClientes = extrairNumerosEDistribuirPacotes(sessao.numeroPreInformado, null, megas, sessao.valor)
    }

    if (pedidosClientes.length === 0 && opcaoEscolhida && !sessao.numeroPreInformado) {
      sessao.etapa = 'AGUARDANDO_NUMERO'
      salvarSessao(sender, sessao)
      await sock.sendMessage(from, {
        text: `✅ *Opção (${opcaoEscolhida.gb}) selecionada!*\n\n📱 *Por favor, envie o seu número da Vodacom para receber os Megas:*\n_Exemplo: 841234567_`
      }, { quoted: msg })
      return
    }

    if (pedidosClientes.length === 0) {

      const bodyLimpo = body.replace(/(?<=\d)[ \t-]+(?=\d)/g, '')
      const regexNumeroMZ = /\b(258)?(8[2367]\d{7})\b/g
      if (regexNumeroMZ.test(bodyLimpo)) {
        await sock.sendMessage(from, {
          text: '❌ *OPERADORA INVÁLIDA*\n\nO bot envia megas apenas para números da **Vodacom** (84 ou 85).\n\nPor favor, envie um número da Vodacom válido.'
        }, { quoted: msg })
        return
      }

      return
    }

    if (pedidosClientes.length > 0) {

      if (!megas) {
        marcarReciboUsado(sessao.codigo)
        limparSessao(sender, from)
        const senderNum = sender.split('@')[0].split(':')[0]
        const mentionJid = sender.includes('@lid') ? sender : (senderNum + '@s.whatsapp.net')
        const msgTabelaInvalida = [
          '⚠️ *VALOR NÃO ENCONTRADO NA TABELA*',
          '────────────────────────',
          `👤 *Cliente:* @${senderNum}`,
          `💵 *Valor:* ${sessao.valor} MT`,
          `📋 *Recibo:* \`${sessao.codigo}\``,
          '────────────────────────',
          'O valor informado não corresponde a nenhum pacote ativo neste grupo.',
          'Um administrador atenderá o seu pedido manualmente.'
        ].join('\n')

        await sock.sendMessage(from, { text: msgTabelaInvalida, mentions: [mentionJid] }, { quoted: msg })
        await reactMsg('⚠️')
        return
      }

      const { salvarEntregaPendente } = require('./entregasPendentes')

      for (const item of pedidosClientes) {
        const dadosEntrega = {
          clienteId: sender,
          clienteNome: sessao.nome,
          numero: item.numero,
          pacote: item.displayPacote,
          valor: item.valor,
          codigo: sessao.codigo,
          grupoOrigem: from,
          timestamp: Date.now()
        }

        salvarEntregaPendente(item.numero, dadosEntrega)
        if (!item.numero.startsWith('258')) salvarEntregaPendente('258' + item.numero, dadosEntrega)
        if (item.numero.startsWith('258')) salvarEntregaPendente(item.numero.substring(3), dadosEntrega)
        if (sender) salvarEntregaPendente(sender, dadosEntrega)
        if (sessao.codigo) salvarEntregaPendente(sessao.codigo, dadosEntrega)
      }

      const dadosDisplay = formatarDadosDisplay(pedidosClientes)
      const tipoPacoteStr = ((megas && megas.tipo) || '').toLowerCase()
      const isDirectSaldo = tipoPacoteStr.includes('saldo')
      const isOfertaSaldo = tipoPacoteStr.includes('semanal') ||
                            tipoPacoteStr.includes('mensal') ||
                            tipoPacoteStr.includes('diamante') ||
                            tipoPacoteStr.includes('ilimitado') ||
                            tipoPacoteStr.includes('tudo top')
      const isSaldoOrder = isDirectSaldo
      const ussdMethod = (isDirectSaldo || isOfertaSaldo) ? '*111#' : '*162#'
      const isSaldoPacote = isDirectSaldo
      const rotuloItem = isSaldoPacote ? '💰 *Saldo:*' : '📊 *Dados:*'
      const pacoteNome = isSaldoPacote ? 'Saldo' : (megas.tipo ? megas.tipo : 'Convencional')

      const { getGrupoConfig } = require('../vendas/gruposConfig')
      const grupoConfig = getGrupoConfig(from)
      const centralCode = (grupoConfig?.apiKey || '').replace(/—|–|－/g, '-').trim().toUpperCase()
      const termoEspera = isSaldoPacote ? 'Os administradores realizarão a transferência manual em instantes!' : 'Os administradores realizarão o envio manual em instantes!'

      const respostaSistema = `✅ *Comprovativo Aprovado!*
📦 *Pacote:* ${pacoteNome}
━━━━━━━━━━━━━━━━━━
📢 *Referência:* *${sessao.codigo}*
💵 *Valor:* ${sessao.valor} MT
${rotuloItem} ${dadosDisplay}
━━━━━━━━━━━━━━━━━━
⏳ _Aguarde... ${termoEspera}_`

      const senderCleanJid = sender ? (sender.split('@')[0].split(':')[0] + '@s.whatsapp.net') : null
      try {
        await sock.sendMessage(from, {
          text: respostaSistema,
          mentions: senderCleanJid ? [senderCleanJid] : []
        }, { quoted: msg })
      } catch {
        await sock.sendMessage(from, { text: respostaSistema })
      }
      await reactMsg('⏳')

      marcarReciboUsado(sessao.codigo)
      limparSessao(sender, from)
      return

      limparSessao(sender, from)
      return
    }
  } else {

    const bodySoNumero = body.trim().replace(/[\s\-]+/g, '')
    if (/^(258)?8[45]\d{7}$/.test(bodySoNumero)) {
      bufferizarNumeroCandidato(sender, bodySoNumero.replace(/\D/g, ''), from)
    }
  }

  const regexEnvioGlobal = /Transferiste com sucesso\s+(\d+)\s*(?:MB|GB)[\s\S]*?(?:para o numero|numero)\s+(258\d{9}|\d{9})/gi

  const regexSemanal = /O numero\s+(?:258)?(\d{9})\s+recebeu uma oferta de dados .+ com\s+(\d+)\s*(?:MB|GB)\s+validos/gi

  const regexSaldoGlobal = /(?:A transferencia de credito de|transferencia de credito de|transferiste com sucesso)\s+([\d.,]+)\s*(?:MT|Mt|MZN)?[\s\S]*?(?:para o numero|numero)\s+(258\d{9}|\d{9})/gi

  const textoEnvio = msg.textoOCR || body

  const todosEnvios = []
  let mEnvio
  while ((mEnvio = regexEnvioGlobal.exec(textoEnvio)) !== null) {
    let numDest = mEnvio[2]
    if (numDest.startsWith('258')) numDest = numDest.substring(3)
    todosEnvios.push({ mb: mEnvio[1], numero: numDest })
  }

  let mSemanal
  while ((mSemanal = regexSemanal.exec(textoEnvio)) !== null) {
    todosEnvios.push({ mb: mSemanal[2], numero: mSemanal[1] })
  }

  let mSaldo
  while ((mSaldo = regexSaldoGlobal.exec(textoEnvio)) !== null) {
    let numDest = mSaldo[2]
    if (numDest.startsWith('258')) numDest = numDest.substring(3)
    todosEnvios.push({ mb: `${mSaldo[1]}MT`, isSaldo: true, valor: mSaldo[1], numero: numDest })
  }

  if (todosEnvios.length === 0) {
    const regexEnvioSimples = /Transferiste com sucesso\s+(\d+)\s*(?:MB|GB)/i
    const matchSimples = textoEnvio.match(regexEnvioSimples)
    if (matchSimples) {

      const numeros = [...textoEnvio.matchAll(/(?:258)?(8[234567]\d{7})/g)]
      if (numeros.length > 0) {
        numeros.forEach(n => {
          todosEnvios.push({ mb: matchSimples[1], numero: n[1] || n[0] })
        })
      } else {
        console.log('[ENTREGA] Envio detectado mas sem número de destino.')
        await sock.sendMessage(from, { text: '⚠️ *Li o envio, mas não vi o número!*\nPor favor, digite o número para quem enviou.' }, { quoted: msg })
        return
      }
    }
  }

  if (todosEnvios.length > 0) {
    console.log(`[ENTREGA] ${todosEnvios.length} envio(s) detectado(s):`, todosEnvios.map(e => `${e.mb}MB->${e.numero}`).join(', '))

    const { buscarEntregaPendente, removerEntregaPendente } = require('./entregasPendentes')
    let algumProcessado = false

    for (const envio of todosEnvios) {
      const numeroDest = envio.numero
      const mbEnv = envio.mb

      const pendente = buscarEntregaPendente(numeroDest)

      if (pendente) {
        algumProcessado = true
        console.log(`[ENTREGA] Confirmada para ${numeroDest}. Cliente: ${pendente.clienteId}`)

        const clienteNome = pendente.clienteNome || 'Cliente'
        const clienteNumero = pendente.numero || numeroDest
        const pacote = pendente.pacote || `${mbEnv}MB`
        const valor = pendente.valor || 'N/A'
        const codigo = pendente.codigo || 'MANUAL'

        let stats = null
        try {
          const { registrarVenda } = require('../vendas/tracker')
          stats = registrarVenda(from, pendente.clienteId, clienteNome, pacote)
        } catch (errStats) {
          console.error(`[ENTREGA] Erro ao registrar venda:`, errStats.message)
        }

        try {
          const agoraStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' CAT'
          let msgNotificacaoSms = ''

          const isSaldoEnvio = (pacote && (pacote.toLowerCase().includes('saldo') || pacote.toLowerCase().includes('mt') || pacote.toLowerCase().includes('recarga')))

          if (isSaldoEnvio) {
            msgNotificacaoSms = `ℹ️ *Notificação automática de SMS*

🆔 *ID da Transação:* ${codigo}

📩 *SMS recebida:*
OK
A transferencia de credito de ${valor || '500.0'}Mt para o numero ${clienteNumero} foi efectuada com sucesso. Lembramos que o limite de transferencias e 20.000,00MT por dia.
⏰ *Horário:* ${agoraStr}
────────────────────────

_Mensagem encaminhada automaticamente para o grupo de origem._`
          } else {
            const qtdMb = (typeof mbEnv === 'number' && mbEnv > 0) ? `${mbEnv}MB` : (pacote.includes('MB') || pacote.includes('GB') ? pacote : `${pacote}MB`)
            msgNotificacaoSms = `ℹ️ *Notificação automática de SMS*

🆔 *ID da Transação:* ${codigo}
📞 *Número:* ${clienteNumero}
💾 *Quantidade:* ${qtdMb}
⏰ *Horário:* ${agoraStr}
────────────────────────

_Mensagem encaminhada automaticamente para o grupo de origem._`
          }

          await sock.sendMessage(from, { text: msgNotificacaoSms })
        } catch (errNotif) {
          console.error(`[ENTREGA] Erro ao enviar notificacao SMS automatica:`, errNotif.message)
        }

        try {
          const { isRankingAtivo } = require('../vendas/gruposConfig')
          let blocoRankingPendente = ''
          if (isRankingAtivo(from) && stats) {
            const topNomeMB = stats.topClienteMBNome ? ` (${stats.topClienteMBNome})` : ''
            blocoRankingPendente = `\n\n🏆 *Ranking do Cliente:*\n• Posição (megas): #${stats.posicao || 1} (${stats.totalFormatado || pacote} acumulados)\n• Líder do Grupo: ${stats.topGrupo || pacote}${topNomeMB}\n• Total de Compras: ${stats.compras || 1} (${stats.comprasHoje || 1} hoje)`
          }

          const msgFinalizado = `✅ *PEDIDO FINALIZADO COM SUCESSO*

👤 Cliente: ${clienteNome}
📱 Número: ${clienteNumero}
📦 Megas: ${pacote}
💰 Valor: ${valor}MT
🔐 Código: ${codigo}${blocoRankingPendente}

🙏 Obrigado pela preferência!`

          await sock.sendMessage(from, { text: msgFinalizado, mentions: [pendente.clienteId] })
        } catch (errMsg1) {
          console.error(`[ENTREGA] Erro msg finalizado:`, errMsg1.message)
        }

        try {
          removerEntregaPendente(numeroDest)
          removerEntregaPendente('258' + numeroDest)
        } catch { }
      } else {
        console.log(`[ENTREGA] Sem pedido pendente para ${numeroDest}. Envio registrado sem venda.`)
      }
    }

    if (algumProcessado && msg.textoOCR) {
      try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch { }
    }

    if (algumProcessado) {
      console.log(`[ENTREGA] ${todosEnvios.length} envio(s) processado(s) com sucesso`)
      return
    }
  }

  if (text === config.prefix + 'ping') {
    const start = Date.now()

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    const latency = Date.now() - start

    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    const mzDate = new Date(utc + (offset * 60000))
    const hora = mzDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    const uptimeSeconds = Math.floor(process.uptime())
    const hours = Math.floor(uptimeSeconds / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    const seconds = uptimeSeconds % 60
    const uptime = `${hours}h ${minutes}m ${seconds}s`

    const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)

    const grupo = from.includes('@g.us') ? 'Grupo' : 'Privado'

    const resposta = `🏓 *Pong!*
━━━━━━━━━━━━━━━━━━
📡 *Latência:* ${latency}ms
⏱️ *Uptime:* ${uptime}
💾 *Memória:* ${memoryUsage}MB
━━━━━━━━━━━━━━━━━━
🤖 *Bot:* ${config.botName}
📱 *Usuário:* @${sender.split('@')[0]}
👥 *Chat:* ${grupo}
⏰ *Hora (MZ):* ${hora}
━━━━━━━━━━━━━━━━━━
⚙️ *Status:* ✅ Online
🔥 *Dono:* ${config.ownerName}`

    await sock.sendMessage(from, { text: resposta, mentions: [sender] }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '🏓', key: msg.key } })

    return
  }
}
