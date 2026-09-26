require('dotenv').config()

process.env.OMP_NUM_THREADS = '1'
process.env.OMP_THREAD_LIMIT = '1'

const cases1 = require('./src/bot/cases1')
const cases = require('./src/bot/cases')
const pino = require("pino")
const readline = require("readline")
const { Boom } = require("@hapi/boom")
const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const core = require("./src/bot/core.js")

const bemvindo = require("./src/middlewares/bemvindo")
const antiPvChato = require('./src/middlewares/antiPvChato')
const antistatus = require('./src/middlewares/antistatus')
const antilink = require('./src/middlewares/antilink')
const { verificarAutoUpdate } = require('./src/bot/autoUpdate')
const { publicarPresenca } = require('./src/utils/clusterPresenca')

const MessageQueue = require('./src/utils/queue')
const messageQueue = new MessageQueue(5, 30)
const queues = {
  primary: messageQueue
}

const fs = require('fs')
if (!fs.existsSync('./data/config.json')) {
  console.error('\n❌ ERRO: config.json não encontrado!\n👉 Renomeie config.example.json para config.json e configure seus dados.\n')
  process.exit(1)
}
const config = require('./data/config.json')

const { GREEN, RESET, CYAN, YELLOW } = {
  GREEN: "\x1b[32m",
  RESET: "\x1b[0m",
  CYAN: "\x1b[36m",
  YELLOW: "\x1b[33m"
}

const cliArgs = process.argv.slice(2)
const isCliPairMode = cliArgs.some(a => a === '--pair' || a === '-p' || a === 'pair')
const isCliQrMode = cliArgs.some(a => a === '--qr' || a === '-q' || a === 'qr' || a === '--qrcode')

if (isCliPairMode || isCliQrMode) {
  executarConexaoCli(isCliQrMode).catch(err => {
    console.error('[ERRO FATAL CONEXAO CLI]', err.message)
    process.exit(1)
  })
  return
}

async function executarConexaoCli(isQrMode = false) {
  const args = process.argv.slice(2)
  const remaining = args.filter(a => !['--pair', '-p', 'pair', '--qr', '-q', 'qr', '--qrcode'].includes(a))
  let phoneArg = ''

  for (const arg of remaining) {
    if (/\d{8,}/.test(arg)) {
      phoneArg = arg.replace(/\D/g, '')
    }
  }

  const sessionDir = './session'

  if (!isQrMode && !phoneArg) {
    console.error(`\n❌ ERRO: Você deve fornecer o número de telefone com DDI para o código de pareamento.`)
    console.error(`👉 Uso Código: node index.js --pair <numero_com_ddi>`)
    console.error(`👉 Uso QR Code: node index.js --qr`)
    console.error(`Exemplo: node index.js --pair 25887xxxxxxx\n`)
    process.exit(1)
  }

  const maskedPhone = phoneArg && phoneArg.length > 6 
    ? `${phoneArg.slice(0, 5)}xxxx${phoneArg.slice(-2)}` 
    : phoneArg

  console.log(`\n==================================================`)
  console.log(`🔌 INICIANDO CONEXÃO: PRINCIPAL (${isQrMode ? 'QR CODE' : 'CÓDIGO DE PAREAMENTO'})`)
  if (!isQrMode) console.log(`📱 Número Alvo: ${maskedPhone}`)
  console.log(`📁 Pasta da Sessão: ${sessionDir}`)
  console.log(`==================================================\n`)

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: isQrMode,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    auth: state,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u
    const statusCode = lastDisconnect?.error?.output?.statusCode
    console.log(`[STATUS] Conexão: ${connection || 'alterada'} ${statusCode ? `(Code: ${statusCode})` : ''}`)

    if (connection === 'open') {
      console.log('\n==================================================')
      console.log(`✅ CONECTADO COM SUCESSO!`)
      console.log('Credenciais salvas com segurança na sessão.')
      console.log('==================================================\n')
      await saveCreds()
      setTimeout(() => process.exit(0), 2000)
    }

    if (connection === 'close') {
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        console.log('[RECONECTANDO] Tentando manter conexão ativa...')
      } else {
        console.log('❌ Sessão encerrada (Logged out). Limpando pasta para recomeçar...')
        try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
        process.exit(1)
      }
    }
  })

  if (!isQrMode && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        console.log(`[PAIRING] Solicitando código de 8 dígitos para ${maskedPhone}...`)
        const code = await sock.requestPairingCode(phoneArg)
        console.log('\n==================================================')
        console.log(`🔑 CÓDIGO DE PAREAMENTO:`)
        console.log(`👉 ${code}`)
        console.log('==================================================\n')
        console.log('Abra o WhatsApp > Aparelhos Conectados > Conectar com número de telefone e digite o código acima.\n')
      } catch (err) {
        console.error('[ERRO PAREAMENTO]', err.message)
      }
    }, 4000)
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (texto, timeoutMs = 15000, defaultVal = '') => {
  return new Promise((resolve) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(defaultVal)
      }
    }, timeoutMs)

    rl.question(texto, (resposta) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(resposta)
      }
    })
  })
}

console.log(`
╭───────────────────────────╮
│       ＧＨＯＳＴ ＢＯＴ       │
╰───────────────────────────╯
`)

const _origLog = console.log
const _origDir = console.dir
const _origInfo = console.info
const _origError = console.error
const _origWarn = console.warn

function shouldSuppress(args) {
  const str = args.map(a => typeof a === 'string' ? a : (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  return str.includes('Closing session') || str.includes('SessionEntry') || str.includes('privKey') ||
    str.includes('registrationId:') || str.includes('rootKey') || str.includes('baseKey') ||
    str.includes('remoteIdentityKey') || str.includes('pendingPreKey') || str.includes('signedKeyId') ||
    str.includes('DEBUG') || str.includes('Bad MAC') || str.includes('Session error') ||
    str.includes('SessionError') || str.includes('Failed to decrypt') || str.includes('messages into the future') ||
    str.includes('Closing open session') || str.includes('printQRInTerminal') ||
    str.includes('No matching sessions') || str.includes('libsignal')
}

console.log = function(...args) { if (shouldSuppress(args)) return; _origLog.apply(console, args) }
console.dir = function(...args) { if (shouldSuppress(args)) return; _origDir.apply(console, args) }
console.info = function(...args) { if (shouldSuppress(args)) return; _origInfo.apply(console, args) }
console.error = function(...args) { if (shouldSuppress(args)) return; _origError.apply(console, args) }
console.warn = function(...args) { if (shouldSuppress(args)) return; _origWarn.apply(console, args) }

global.sock = null
global.sockConnected = false
global.primarySocket = null
global.primaryConnected = false
global.primaryGroups = new Set()
const botOutgoingMessageIds = new Set()
const globalProcessedMessages = new Set()
const MESSAGE_CACHE_TIMEOUT = 5 * 60 * 1000

const bootTime = Math.floor(Date.now() / 1000)

global.messageQueue = messageQueue
global.messageQueues = queues
global.resetAllQueues = () => {
  try {
    messageQueue.queue = []
    console.log('[RESET] Fila interna de mensagens limpa com sucesso!')
  } catch (e) {
    console.error('[RESET] Erro ao resetar fila interna:', e.message)
  }
}

const { iniciarLimpezaSessao } = require('./src/utils/sessionPruner')
iniciarLimpezaSessao(12)



let reconnectAttempts = 0
let primeiraConexaoDoProcesso = true
const MAX_RECONNECT_DELAY = 30000
let chosenMethod = null
let pairingTimeout = null

async function connectSocket() {
  const sessionFolder = 'session'

  if (pairingTimeout) {
    clearTimeout(pairingTimeout)
    pairingTimeout = null
  }

  const oldSock = global.primarySocket
  if (oldSock) {
    try { oldSock.ws.close() } catch(e) {}
    try { oldSock.ev.removeAllListeners() } catch(e) {}
    global.primarySocket = null
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)

  let method = '1'
  let phoneNumber = config.botNumber || ''

  if (!state.creds.registered) {
    if (!process.stdin.isTTY) {
      console.log(`[START] Conexão PRINCIPAL offline (sem credenciais). Para parear, execute no terminal: node index.js --pair <numero> ou node index.js --qr`)
      return
    }
    console.log(`\n${CYAN}Nenhuma sessão ativa encontrada para o bot PRINCIPAL. Escolha o método de conexão:${RESET}`)
    console.log(`1. Conectar via QR Code`)
    console.log(`2. Conectar via Código de Pareamento (Pairing Code)`)

    const opcao = await question(`\nDigite a opção desejada (1 ou 2) [Padrão 1, expira em 30s]: `, 30000, '1')
    method = (opcao.trim() === '2') ? '2' : '1'

    if (method === '2') {
      const num = await question(`\nDigite o número do bot com DDI (ex: 25887xxxxxxx) [Padrão: ${phoneNumber || "nenhum"}]: `, 20000, phoneNumber)
      const numeroLimpo = num.replace(/[^0-9]/g, "")
      if (numeroLimpo) {
        phoneNumber = numeroLimpo
        try {
          config.botNumber = phoneNumber
          fs.writeFileSync('./data/config.json', JSON.stringify(config, null, 2))
          console.log(`\n${GREEN}✅ Número do bot atualizado no config.json: ${phoneNumber}${RESET}\n`)
        } catch (e) {
          console.error(`Erro ao salvar número no config.json:`, e.message)
        }
      } else if (!phoneNumber) {
        console.log(`\n❌ Nenhum número fornecido. Usando o método QR Code como fallback...\n`)
        method = '1'
      }
    }
  }

  const { version } = await fetchLatestBaileysVersion()
  const { getGroupMetadataCached } = require('./src/utils/baileys')

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: method === '1',
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    auth: state,
    emitOwnEvents: true,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    cachedGroupMetadata: async (jid) => getGroupMetadataCached(sock, jid)
  })

  global.sock = sock
  global.primarySocket = sock

  if (method === '2' && !sock.authState.creds.registered) {
    let targetPhone = phoneNumber

    if (targetPhone) {
      let attempts = 0
      const maxAttempts = 5
      const requestPairing = async () => {
        if (sock.authState.creds.registered) return
        try {
          const cleanPhone = targetPhone.replace(/[^0-9]/g, "")
          console.log(`[PAIRING] Solicitando código para ${cleanPhone} (Tentativa ${attempts + 1}/${maxAttempts})...`)
          const code = await sock.requestPairingCode(cleanPhone)
          console.log(`\n${GREEN}=====================================${RESET}`)
          console.log(`${YELLOW}CÓDIGO DE CONEXÃO: ${GREEN}${code}${RESET}`)
          console.log(`${GREEN}=====================================${RESET}\n`)
        } catch (err) {
          console.error(`[PAIRING] Erro ao solicitar código de pareamento (Tentativa ${attempts + 1}):`, err.message)
          attempts++
          if (attempts < maxAttempts) {
            console.log(`[PAIRING] Aguardando 3s antes de tentar novamente...`)
            pairingTimeout = setTimeout(requestPairing, 3000)
          } else {
            console.error(`[PAIRING] Falha total ao solicitar código após ${maxAttempts} tentativas.`)
          }
        }
      }
      pairingTimeout = setTimeout(requestPairing, 4000)
    } else {
      console.log(`${YELLOW}⚠️ Defina o número de telefone no config.json para gerar o código de conexão!${RESET}`)
    }
  }

  const originalSendMessage = sock.sendMessage.bind(sock)
  sock.sendMessage = async (jid, content, options = {}, isHighPriority = null) => {
    if (content && content.react) {
      try {
        const reactTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('React timeout')), 2500))
        return await Promise.race([originalSendMessage(jid, content, options), reactTimeout])
      } catch (e) {
        return null
      }
    }
    const high = (typeof isHighPriority === 'boolean')
      ? isHighPriority
      : (options && options.isHighPriority !== undefined ? !!options.isHighPriority : true)
    const timeoutMs = (options && options.timeoutMs) ? options.timeoutMs : (high ? 7000 : 5000)
    const res = await messageQueue.add(() => originalSendMessage(jid, content, options), high, timeoutMs)
    if (res?.key?.id) {
      botOutgoingMessageIds.add(res.key.id)
      if (botOutgoingMessageIds.size > 3000) {
        const it = botOutgoingMessageIds.values()
        for (let i = 0; i < 1000; i++) botOutgoingMessageIds.delete(it.next().value)
      }
    }
    return res
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        const qrcode = require('qrcode')
        const qrFileName = './qrcode.png'
        qrcode.toFile(qrFileName, qr, {
          color: { dark: '#000000', light: '#ffffff' }
        }, (err) => {
          if (err) console.error('Erro ao salvar QR Code em imagem:', err)
          else console.log('QR Code salvo em imagem com sucesso.')
        })
        qrcode.toString(qr, { type: 'terminal', small: true }, (err, codeStr) => {
          if (!err) {
            console.log(`\nScanear QR Code abaixo para conectar o Bot:`)
            console.log(codeStr)
          }
        })
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err)
      }
    }

    if (connection === "open") {
      global.sockConnected = true
      global.primaryConnected = true
      global.sock = sock
      global.primarySocket = sock
      reconnectAttempts = 0
      messageQueue.resume()
      chosenMethod = null
      if (pairingTimeout) {
        clearTimeout(pairingTimeout)
        pairingTimeout = null
      }
      // Limpar cache de deduplicação ao reconectar para que mensagens
      // re-entregues pelo WhatsApp não sejam silenciosamente descartadas
      globalProcessedMessages.clear()
      console.log('[RECONNECT] Cache de mensagens processadas limpo. Bot pronto para receber mensagens.')

      publicarPresenca('principal', 'ONLINE', sock).catch(() => {})

      try {
        await sock.sendPresenceUpdate('available')
      } catch (e) {}

      if (typeof sock.uploadPreKeys === 'function') {
        sock.uploadPreKeys(50).then(() => {
          console.log('[PREKEYS] ✅ 50 novas pre-keys sincronizadas com o WhatsApp com sucesso.')
        }).catch(err => {
          console.warn('[PREKEYS] Aviso ao sincronizar pre-keys:', err?.message || err)
        })
      }

      // Renovar presença a cada 4 minutos — mantém o bot como "online"
      // e garante que os tiques de leitura (azuis) continuem funcionando
      if (global._presenceInterval) clearInterval(global._presenceInterval)
      global._presenceInterval = setInterval(async () => {
        if (!global.sockConnected) return
        try { await sock.sendPresenceUpdate('available') } catch {}
      }, 4 * 60 * 1000)

      const isFirst = primeiraConexaoDoProcesso
      if (primeiraConexaoDoProcesso) primeiraConexaoDoProcesso = false

      setTimeout(() => verificarAutoUpdate(sock, config, isFirst), 5000)
    } else if (connection === "close") {
      global.sockConnected = false
      global.primaryConnected = false
      global.sock = null
      global.primarySocket = null
      messageQueue.flush()
      messageQueue.pause()
      if (pairingTimeout) {
        clearTimeout(pairingTimeout)
        pairingTimeout = null
      }
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      const reasonName = Object.entries(DisconnectReason).find(([key, value]) => value === reason)?.[0] || "UNKNOWN"
      console.log(`${YELLOW}[ DESCONECTADO ] - RAZÃO ${reason} (${reasonName})${RESET}`)

      const isLoggedOut = reason === DisconnectReason.loggedOut || reason === DisconnectReason.forbidden

      publicarPresenca('principal', 'OFFLINE', sock, isLoggedOut ? 'banido_ou_desconectado' : 'desconectado').catch(() => {})

      if (isLoggedOut) {
        console.log(`${YELLOW}⚠️ Sessão desconectada ou banida (Erro ${reason}). Apagando credenciais...${RESET}`)
        try { sock.ws.close() } catch(e) {}
        try {
          if (fs.existsSync(`./${sessionFolder}`)) {
            fs.rmSync(`./${sessionFolder}`, { recursive: true, force: true })
            console.log(`${YELLOW}🗑️ Pasta ./${sessionFolder} apagada com sucesso.${RESET}`)
          }
          fs.mkdirSync(`./${sessionFolder}`, { recursive: true })
        } catch(e) {
          console.error(`Erro ao apagar/recriar sessão:`, e.message)
        }

        console.log(`${YELLOW}⚠️ Parando o bot no PM2...${RESET}`)
        const { exec } = require('child_process')
        exec('pm2 stop ghost-bot', (err) => {
          if (err) console.error('Erro ao parar via PM2:', err.message)
          process.exit(0)
        })
      } else {
        reconnectAttempts++
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY)
        console.log(`${YELLOW}🔄 Tentando reconectar em ${Math.round(delay/1000)}s... (tentativa ${reconnectAttempts})${RESET}`)
        setTimeout(() => connectSocket(), delay)
      }
    }
  })

  async function processarMensagemIndividual(sock, msg) {
    if (!msg || !msg.message) return

    if (msg.key?.id && botOutgoingMessageIds.has(msg.key.id)) {
      return
    }

    if (msg.key && msg.key.remoteJid === 'status@broadcast') {
      return
    }

    const rawTimestamp = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'object' ? msg.messageTimestamp.low : msg.messageTimestamp) : 0
    const msgTimestamp = Number(rawTimestamp) || 0
    const agoraSec = Math.floor(Date.now() / 1000)

    if (msgTimestamp > 0 && (msgTimestamp < (bootTime - 120) || msgTimestamp < (agoraSec - 3600))) {
      return
    }

    const remoteJid = msg.key?.remoteJid || ''

    if (remoteJid.endsWith('@g.us')) {
      global.primaryGroups.add(remoteJid)
    }

    const msgId = msg.key?.id
    if (msgId) {
      if (globalProcessedMessages.has(msgId)) return
      globalProcessedMessages.add(msgId)
      setTimeout(() => globalProcessedMessages.delete(msgId), MESSAGE_CACHE_TIMEOUT)
    }

    const bodyCheck = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.documentMessage?.caption || ''
    if (bodyCheck && !msg.key?.fromMe) {
      console.log(`[MSG-IN] De: ${remoteJid} -> "${bodyCheck.slice(0, 50).replace(/\n/g, ' ')}"`)
    }

    const isBotResponseAlert = /Pagamento Não Confirmado|NÚMERO DE DESTINO NÃO AUTORIZADO|RECIBO JÁ UTILIZADO|COMPROVANTE ARQUIVADO|Depósito confirmado|FORMAS DE PAGAMENTO|GRUPO SEM CONTAS|SMS ainda não recebido|Não consegui ler o valor/i.test(bodyCheck)
    if (msg.key.fromMe && isBotResponseAlert) return

    const isComprovanteCheck = /^(?:Confirmado|ID da transacao|ID\s*Trans|Transaction ID|Transferiste|You transfered)/i.test(bodyCheck.trim()) ||
                               /(?:Transferiste|You transfered)\s+[\d.,]+\s*MT/i.test(bodyCheck)
    const hasMediaMsg = !!(msg.message?.imageMessage || msg.message?.documentMessage)
    if (msg.key.fromMe && !bodyCheck.startsWith(config.prefix) && !isComprovanteCheck && !hasMediaMsg) return

    async function marcarComoLida(s, key) {
      if (!s || !key || key.fromMe) return
      try {
        if (typeof s.sendReceipt === 'function') {
          await s.sendReceipt(key.remoteJid, key.participant, [key.id], 'read')
        } else if (typeof s.readMessages === 'function') {
          await s.readMessages([key])
        }
      } catch {
        try {
          if (typeof s.readMessages === 'function') {
            await s.readMessages([key])
          }
        } catch {}
      }
    }

    try {
      const isPV = remoteJid && !remoteJid.endsWith('@g.us') && !remoteJid.endsWith('@broadcast')
      if (isPV && sock && msg.key && !msg.key.fromMe) {
        marcarComoLida(sock, msg.key).catch(() => {})
      }
    } catch {}

    try {

      antiPvChato(sock, msg).catch(() => {})

      const foiBanido = await antistatus(sock, msg)
      if (foiBanido) return

      const linkBanido = await antilink(sock, msg)
      if (linkBanido) return

      const handled = await cases1(sock, msg)
      if (!handled) {
        await cases(sock, msg)
      }
    } catch (msgErr) {
      console.error(`[MSG ERROR] Erro isolado no processamento da mensagem ${msgId || 'desconhecida'}:`, msgErr.message)
    }
  }

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      if (!chatUpdate.messages || !chatUpdate.messages.length) return

      for (const m of chatUpdate.messages) {
        if (m?.key && !m.key.fromMe && m.key.remoteJid && !m.key.remoteJid.endsWith('@g.us') && !m.key.remoteJid.endsWith('@broadcast')) {
          try {
            if (typeof sock.sendReceipt === 'function') {
              sock.sendReceipt(m.key.remoteJid, m.key.participant, [m.key.id], 'read').catch(() => {})
            } else if (typeof sock.readMessages === 'function') {
              sock.readMessages([m.key]).catch(() => {})
            }
          } catch {}
        }
      }

      await Promise.allSettled(
        chatUpdate.messages.map(msg => processarMensagemIndividual(sock, msg))
      )
    } catch (e) {
      console.error('[UPSERT ERROR] Erro geral no lote de mensagens:', e.message)
    }
  })

  sock.ev.on("groups.upsert", (newGroups) => {
    try {
      if (Array.isArray(newGroups)) {
        for (const g of newGroups) {
          if (g && g.id) {
            global.primaryGroups.add(g.id)
          }
        }
      }
    } catch {}
  })

  sock.ev.on("group-participants.update", (update) => {
    try {
      if (update && update.id) {
        global.primaryGroups.add(update.id)
      }
    } catch {}
  })

  const configManager = require('./src/utils/configManager')
  if (!global.timersIniciados) {
    global.timersIniciados = true

    setInterval(async () => {
      const botConectado = global.primaryConnected
      if (!botConectado) return
      try {
        const groups = configManager.loadGroupConfig()
        const now = new Date()
        const offset = 2 * 60
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
        const agoraMocambique = utc + (offset * 60000)

        let mudou = false

        for (const [groupId, cfg] of Object.entries(groups)) {

          if (cfg.botDesligado && cfg.offExpiraEm) {
            if (agoraMocambique >= cfg.offExpiraEm) {
              groups[groupId].botDesligado = false
              delete groups[groupId].offPor
              delete groups[groupId].offExpiraEm
              mudou = true

              const activeSock = global.primarySocket
              if (activeSock) {
                try {
                  await activeSock.sendMessage(groupId, {
                    text: '🟢 *BOT REATIVADO!*\n\nO período de suspensão temporária acabou e o bot voltou a funcionar.'
                  })
                  console.log(`[TEMPO-OFF] Grupo reativado: ${groupId}`)
                } catch (err) {
                  console.error('[TEMPO-OFF] Erro ao avisar reativação:', err.message)
                }
              }
            }
          }

          if (cfg.authorized && cfg.expiraEm) {
            const tempoRestante = cfg.expiraEm - agoraMocambique

            const activeSock = global.primarySocket
            if (!activeSock) continue
            const { getSuporteNumber } = require('./src/utils/configManager')
            const suporteNum = getSuporteNumber()

            if (tempoRestante > 0 && tempoRestante <= 5 * 24 * 60 * 60 * 1000 && !cfg.avisouPreExpiracao5d) {
              try {
                await activeSock.sendMessage(groupId, {
                  text: `⚠️ *Aviso de Vencimento!*\n\n📅 O período de uso do bot neste grupo expira em *5 dias*.\n\n💡 Evite a interrupção das vendas! Renove a sua assinatura contactando o suporte:\nwa.me/${suporteNum}`
                }, {}, false)
                console.log(`[EXPIRACAO] Aviso de 5 dias enviado para: ${groupId}`)
              } catch (err) {
                console.error('[EXPIRACAO] Erro ao enviar aviso de 5 dias:', err.message)
              } finally {
                groups[groupId].avisouPreExpiracao5d = true
                mudou = true
              }
            }

            if (tempoRestante > 0 && tempoRestante <= 24 * 60 * 60 * 1000 && !cfg.avisouPreExpiracao24h) {
              try {
                await activeSock.sendMessage(groupId, {
                  text: `⏰ *Vence Amanhã!*\n\n⚠️ O período de uso do bot neste grupo expira em *menos de 24 horas*.\n\n💡 Renove agora mesmo para manter o bot ativo contactando o suporte:\nwa.me/${suporteNum}`
                }, {}, false)
                console.log(`[EXPIRACAO] Aviso de 24h enviado para: ${groupId}`)
              } catch (err) {
                console.error('[EXPIRACAO] Erro ao enviar aviso de 24h:', err.message)
              } finally {
                groups[groupId].avisouPreExpiracao24h = true
                mudou = true
              }
            }

            if (tempoRestante <= 0 && !cfg.avisouExpiracao) {
              try {
                await activeSock.sendMessage(groupId, {
                  text: `⏰ *Tempo expirado!*\n\n❌ O período de uso do bot neste grupo acabou.\n\n📞 Para continuar usando, entre em contato com o suporte:\nwa.me/${suporteNum}`
                }, {}, false)
                console.log(`[EXPIRACAO] Grupo expirou: ${groupId}`)
              } catch (err) {
                console.error('[EXPIRACAO] Erro ao avisar grupo expirado:', err.message)
              } finally {
                groups[groupId].avisouExpiracao = true
                mudou = true
              }
            }
          }
        }

        if (mudou) {
          configManager.saveGroupConfig(true)
        }
      } catch (err) {

      }
    }, 60000)

    const { inicializarRelogioMocambique } = require('./src/utils/agendadorAlarmes')
    inicializarRelogioMocambique()
  }

  sock.ev.on("group-participants.update", async (update) => {
    try {
      if (update?.id) {
        const { invalidateGroupCache } = require('./src/utils/baileys')
        invalidateGroupCache(update.id)
      }

      if (update.action === 'add') {
        const botNumber = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : ''
        for (const participant of update.participants) {
          const participantNumber = participant.split('@')[0].split(':')[0]

          if (participantNumber === botNumber) {
            const donoNumber = Array.isArray(config.dono) ? config.dono[0] : config.dono
            const groupConfig = configManager.loadGroupConfig()

            if (!groupConfig[update.id]?.authorized) {
              await sock.sendMessage(update.id, {
                text: '❌ *Grupo não autorizado!*\n\nApenas o dono do bot pode me adicionar em grupos.\n\nContato: wa.me/' + donoNumber
              })
              setTimeout(async () => {
                try { await sock.groupLeave(update.id) } catch {}
              }, 2000)
              return
            }
          }
        }
      }

      const eventosGrupo = require('./src/middlewares/eventosGrupo')
      await eventosGrupo(sock, update)

      if (update.action === 'add' && update.participants && update.participants.length > 0) {
        try {
          const { registrarParticipanteAdicionado } = require('./src/middlewares/antibot')
          for (const p of update.participants) {
            registrarParticipanteAdicionado(update.id, p, update.author)
          }
        } catch {}
      }

      const anticoncorrenciaAtivo = require('./src/middlewares/anticoncorrenciaAtivo')
      await anticoncorrenciaAtivo(sock, update)

      const antigringoAtivo = require('./src/middlewares/antigringoAtivo')
      await antigringoAtivo(sock, update)

      await bemvindo(sock, update)
    } catch (e) {
      console.error("Erro no middleware de grupo:", e)
    }
  })

  sock.ev.on("creds.update", saveCreds)
}

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Exceção não capturada:', err.message)
  setTimeout(() => iniciarBots(), 5000)
})

process.on('unhandledRejection', (reason) => {
  if (reason?.message?.includes('Conexão perdida')) return
  console.error('[WARN] Promise rejeitada:', reason?.message || reason)
  if (reason?.message?.includes('Connection Closed') || reason?.output?.statusCode === 428) {
    console.log('[AUTO-RECONNECT] Conexão Baileys perdida no background. Agendando reconexão limpa...')
    setTimeout(() => {
      if (!global.sockConnected) {
        connectSocket()
      }
    }, 3000)
  }
})

const { preloadAll } = require('./src/utils/firebaseDataLayer')

async function iniciarBots() {
  try {
    await preloadAll()
  } catch (errPreload) {
    console.error('[START] Erro ao pré-carregar dados do Firebase:', errPreload.message)
  }

  const temSessaoPrincipal = fs.existsSync('./session/creds.json')

  if (temSessaoPrincipal) {
    console.log(`[START] Sessão anterior encontrada. Iniciando bot PRINCIPAL online...`)
    connectSocket()
  } else {
    console.log(`[START] Nenhuma sessão ativa para PRINCIPAL.`)
    if (process.stdin.isTTY) {
      connectSocket()
    } else {
      console.log(`[START] Execute via terminal para parear: node index.js --pair <numero> ou node index.js --qr`)
    }
  }
}

iniciarBots().catch(err => {
  console.error('[FATAL] Erro ao iniciar bots:', err.message)
})

module.exports = { connectSocket }
