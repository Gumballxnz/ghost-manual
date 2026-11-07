const fs = require('fs')
const path = require('path')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { getGroupMetadataCached, isLeaderCheck, isSubdonoCheck, getSenderCandidateKeys } = require('../utils/baileys')
const { limparArquivosSessao } = require('../utils/sessionPruner')
const MessageQueue = require('../utils/queue')

const SESSIONS_DIR = path.resolve(__dirname, '../../session_subbots')
const DATA_FILE = path.resolve(__dirname, '../../data/subbots.json')

class SubbotManager {
  constructor() {
    this.activeSubbots = new Map() // numero -> { sock, numero, grupos, status, reconnectAttempts, queue, ... }
    this.groupToSubbot = new Map() // groupId -> numero
    this.processarMensagemFn = null
    this.pairingTimeouts = new Map()

    this.carregarDados()
  }

  setProcessarMensagemFn(fn) {
    this.processarMensagemFn = fn
  }

  carregarDados() {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        this.dados = { subbots: {}, autorizados: [] }
        this.salvarDados()
      } else {
        const raw = fs.readFileSync(DATA_FILE, 'utf8')
        this.dados = JSON.parse(raw)
        if (!this.dados.subbots) this.dados.subbots = {}
        if (!Array.isArray(this.dados.autorizados)) this.dados.autorizados = []
      }
    } catch (e) {
      console.error('[SUBBOTS] Erro ao carregar subbots.json:', e.message)
      this.dados = { subbots: {}, autorizados: [] }
    }
  }

  salvarDados() {
    try {
      const dir = path.dirname(DATA_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.dados, null, 2))
    } catch (e) {
      console.error('[SUBBOTS] Erro ao salvar subbots.json:', e.message)
    }
  }

  isAutorizado(sender, msg = null) {
    if (!sender) return false
    // 1. Mensagens do próprio bot ou Dono principal
    if (isLeaderCheck(sender, msg)) return true

    // 2. Subdonos registrados no bot
    if (isSubdonoCheck(sender)) return true

    // 3. Usuários autorizados explicitamente pelo dono/subdono
    const autorizados = this.dados.autorizados || []
    if (autorizados.length > 0) {
      const candidateKeys = typeof getSenderCandidateKeys === 'function'
        ? getSenderCandidateKeys(sender)
        : new Set([String(sender).split('@')[0].split(':')[0].replace(/\D/g, '')])

      for (const aut of autorizados) {
        const autLimpo = String(aut).replace(/\D/g, '')
        if (candidateKeys.has(aut) || candidateKeys.has(autLimpo) || candidateKeys.has(aut + '@s.whatsapp.net')) {
          return true
        }
      }
    }

    return false
  }

  autorizarUsuario(numero, porQuem = '') {
    const limpo = this.normalizarNumero(numero)
    if (!limpo || limpo.length < 8) {
      throw new Error('Número inválido para autorização. Informe com DDI (ex: 25884xxxxxxx).')
    }
    if (!Array.isArray(this.dados.autorizados)) this.dados.autorizados = []
    if (this.dados.autorizados.includes(limpo)) {
      return { status: 'ja_autorizado', numero: limpo }
    }
    this.dados.autorizados.push(limpo)
    this.salvarDados()
    return { status: 'sucesso', numero: limpo }
  }

  desautorizarUsuario(numero) {
    const limpo = this.normalizarNumero(numero)
    if (!Array.isArray(this.dados.autorizados) || !this.dados.autorizados.includes(limpo)) {
      return { status: 'nunca_autorizado', numero: limpo }
    }
    this.dados.autorizados = this.dados.autorizados.filter(a => String(a).replace(/\D/g, '') !== limpo)
    this.salvarDados()
    return { status: 'sucesso', numero: limpo }
  }

  listarAutorizados() {
    return this.dados.autorizados || []
  }

  normalizarNumero(numero) {
    if (!numero) return ''
    return String(numero).replace(/\D/g, '')
  }

  temSubbotAtivoNoGrupo(groupId) {
    if (!groupId) return false
    const numero = this.groupToSubbot.get(groupId)
    if (!numero) return false
    const subbot = this.activeSubbots.get(numero)
    return Boolean(subbot && subbot.status === 'online' && subbot.sock)
  }

  getSubbotPorNumero(numero) {
    const limpo = this.normalizarNumero(numero)
    return this.activeSubbots.get(limpo) || null
  }

  getSubbotsDoUsuario(sender) {
    if (!sender) return []
    const candidateKeys = typeof getSenderCandidateKeys === 'function'
      ? getSenderCandidateKeys(sender)
      : new Set([String(sender).split('@')[0].split(':')[0].replace(/\D/g, '')])

    try {
      const { buscarNumero } = require('./core')
      const id = String(sender).split('@')[0].split(':')[0]
      const numReal = buscarNumero(id)
      if (numReal) {
        candidateKeys.add(numReal)
        candidateKeys.add(numReal + '@s.whatsapp.net')
      }
    } catch {}

    const resultado = []
    for (const [num, sb] of Object.entries(this.dados.subbots || {})) {
      const numLimpo = String(num).replace(/\D/g, '')
      const criadorLimpo = sb.criadoPor ? String(sb.criadoPor).split('@')[0].split(':')[0].replace(/\D/g, '') : ''

      if (candidateKeys.has(numLimpo) || candidateKeys.has(sb.criadoPor) || (criadorLimpo && candidateKeys.has(criadorLimpo))) {
        const active = this.activeSubbots.get(numLimpo)
        resultado.push({
          ...sb,
          online: Boolean(active && active.status === 'online'),
          status: active?.status || sb.status || 'offline'
        })
      }
    }
    return resultado
  }

  getSubbotDoGrupo(groupId) {
    const num = this.groupToSubbot.get(groupId)
    if (!num) return null
    return this.activeSubbots.get(num) || null
  }

  vincularGrupo(numero, groupId) {
    const num = this.normalizarNumero(numero)
    if (!this.dados.subbots[num]) {
      this.dados.subbots[num] = {
        numero: num,
        grupos: [],
        criadoEm: Date.now(),
        ativo: true,
        status: 'offline'
      }
    }
    const sb = this.dados.subbots[num]
    if (!sb.grupos) sb.grupos = []
    if (!sb.grupos.includes(groupId)) {
      sb.grupos.push(groupId)
      this.salvarDados()
    }
    this.groupToSubbot.set(groupId, num)
    const active = this.activeSubbots.get(num)
    if (active && !active.grupos.includes(groupId)) {
      active.grupos.push(groupId)
    }
    return true
  }

  desvincularGrupo(groupId) {
    let alterado = false
    for (const [num, sb] of Object.entries(this.dados.subbots)) {
      if (sb.grupos && sb.grupos.includes(groupId)) {
        sb.grupos = sb.grupos.filter(g => g !== groupId)
        alterado = true
      }
    }
    if (alterado) this.salvarDados()
    this.groupToSubbot.delete(groupId)
    for (const active of this.activeSubbots.values()) {
      if (active.grupos) {
        active.grupos = active.grupos.filter(g => g !== groupId)
      }
    }
    return true
  }

  listarSubbots() {
    const lista = []
    for (const [num, item] of Object.entries(this.dados.subbots)) {
      const active = this.activeSubbots.get(num)
      lista.push({
        numero: num,
        grupos: item.grupos || [],
        criadoEm: item.criadoEm,
        criadoPor: item.criadoPor,
        ativo: item.ativo !== false,
        status: active?.status || item.status || 'offline',
        online: Boolean(active && active.status === 'online')
      })
    }
    return lista
  }

  async conectarSubbot({
    numero,
    grupoId = null,
    autorJid = '',
    onPairingCode = null,
    onConnected = null,
    onError = null
  }) {
    const num = this.normalizarNumero(numero)
    if (!num || num.length < 8) {
      throw new Error('Número de telefone inválido. Informe o número com DDI (ex: 25884xxxxxxx).')
    }

    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    }

    const sessionPath = path.join(SESSIONS_DIR, `subbot_${num}`)
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true })
    }

    // Registra / atualiza registro no subbots.json
    if (!this.dados.subbots[num]) {
      this.dados.subbots[num] = {
        numero: num,
        grupos: grupoId ? [grupoId] : [],
        criadoEm: Date.now(),
        criadoPor: autorJid,
        ativo: true,
        status: 'pareando'
      }
    } else {
      this.dados.subbots[num].ativo = true
      this.dados.subbots[num].status = 'pareando'
      if (grupoId && !this.dados.subbots[num].grupos.includes(grupoId)) {
        this.dados.subbots[num].grupos.push(grupoId)
      }
    }
    this.salvarDados()

    if (grupoId) {
      this.groupToSubbot.set(grupoId, num)
    }

    // Se já havia um socket antigo aberto, fecha de forma limpa
    const anterior = this.activeSubbots.get(num)
    if (anterior?.sock) {
      try { anterior.sock.ws?.close() } catch {}
      try { anterior.sock.ev?.removeAllListeners() } catch {}
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const queue = new MessageQueue(2, 600) // Rate-limiting leve anti-ban

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['GhostBot Sub', 'Chrome', '20.0.04'],
      auth: state,
      emitOwnEvents: false,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      cachedGroupMetadata: async (jid) => getGroupMetadataCached(sock, jid)
    })

    const subbotEntry = {
      sock,
      numero: num,
      grupos: this.dados.subbots[num].grupos || [],
      status: state.creds.registered ? 'conectando' : 'pareando',
      reconnectAttempts: 0,
      queue,
      grupoSolicitante: grupoId
    }
    this.activeSubbots.set(num, subbotEntry)

    // Camada Anti-Ban Proativa: Envelope de envio de mensagens
    const originalSendMessage = sock.sendMessage.bind(sock)
    sock.sendMessage = async (jid, content, options = {}, isHighPriority = null) => {
      // Reações são instantâneas sem presença
      if (content && content.react) {
        try {
          return await originalSendMessage(jid, content, options)
        } catch {
          return null
        }
      }

      const high = (typeof isHighPriority === 'boolean')
        ? isHighPriority
        : (options && options.isHighPriority !== undefined ? !!options.isHighPriority : true)
      const timeoutMs = (options && options.timeoutMs) ? options.timeoutMs : (high ? 7000 : 5000)

      return await queue.add(async () => {
        // Anti-ban: Simula digitação humana antes de enviar texto
        if (content && content.text && !content.react) {
          try {
            await sock.sendPresenceUpdate('composing', jid)
            await new Promise(r => setTimeout(r, 600))
          } catch {}
        }
        return await originalSendMessage(jid, content, options)
      }, high, timeoutMs)
    }

    // Solicitar código de pareamento caso não esteja registrado
    if (!sock.authState.creds.registered) {
      const timeoutKey = `pairing_${num}`
      if (this.pairingTimeouts.has(timeoutKey)) {
        clearTimeout(this.pairingTimeouts.get(timeoutKey))
      }

      const requestPairing = async (retry = 0) => {
        if (sock.authState.creds.registered) return
        try {
          console.log(`[SUBBOT ${num}] 🔑 Solicitando código de pareamento...`)
          const rawCode = await sock.requestPairingCode(num)
          const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode
          console.log(`[SUBBOT ${num}] ✅ Código gerado com sucesso: ${formattedCode}`)

          if (typeof onPairingCode === 'function') {
            onPairingCode(formattedCode, rawCode)
          }
        } catch (err) {
          console.error(`[SUBBOT ${num}] ❌ Erro ao solicitar código:`, err.message)
          if (retry < 3) {
            const t = setTimeout(() => requestPairing(retry + 1), 3500)
            this.pairingTimeouts.set(timeoutKey, t)
          } else if (typeof onError === 'function') {
            onError(err)
          }
        }
      }

      const tInit = setTimeout(() => requestPairing(0), 3000)
      this.pairingTimeouts.set(timeoutKey, tInit)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update

      if (connection === 'open') {
        subbotEntry.status = 'online'
        subbotEntry.reconnectAttempts = 0
        this.dados.subbots[num].status = 'online'
        this.salvarDados()

        console.log(`\n==================================================`)
        console.log(`🎉 [SUBBOT CONECTADO] Sub-Bot +${num} está ONLINE!`)
        console.log(`==================================================\n`)

        // Sincronizar grupos participantes
        try {
          const groups = await sock.groupFetchAllParticipating()
          const gids = Object.keys(groups || {})
          for (const gid of gids) {
            if (!subbotEntry.grupos.includes(gid)) {
              subbotEntry.grupos.push(gid)
            }
            this.groupToSubbot.set(gid, num)
          }
          this.dados.subbots[num].grupos = subbotEntry.grupos
          this.salvarDados()
        } catch (e) {
          console.warn(`[SUBBOT ${num}] Aviso ao carregar grupos:`, e.message)
        }

        // Upload de pre-keys
        if (typeof sock.uploadPreKeys === 'function') {
          sock.uploadPreKeys(50).catch(() => {})
        }

        // Limpeza periódica de pre-keys antigas
        limparArquivosSessao(sessionPath).catch(() => {})

        if (typeof onConnected === 'function') {
          onConnected(num)
        }

        // Avisa no grupo solicitante se configurado
        if (subbotEntry.grupoSolicitante) {
          try {
            await sock.sendMessage(subbotEntry.grupoSolicitante, {
              text: `🎉 *SUB-BOT CONECTADO COM SUCESSO!*\n\n📱 *Número:* +${num}\n🤖 A partir de agora, as respostas deste grupo serão enviadas por este número.`
            })
          } catch {}
        }
      } else if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        const reasonName = Object.entries(DisconnectReason).find(([key, value]) => value === reason)?.[0] || 'UNKNOWN'
        console.log(`[SUBBOT ${num}] 🔌 Desconectado - Código: ${reason} (${reasonName})`)

        subbotEntry.status = 'offline'
        this.dados.subbots[num].status = 'offline'
        this.salvarDados()

        const isLoggedOut = reason === DisconnectReason.loggedOut || reason === DisconnectReason.forbidden

        if (isLoggedOut) {
          console.log(`[SUBBOT ${num}] ⚠️ Sessão encerrada/deslogada pelo WhatsApp. Apagando arquivos da sessão...`)
          try { sock.ws?.close() } catch {}
          try {
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true })
            }
          } catch (e) {
            console.error(`[SUBBOT ${num}] Erro ao apagar sessão:`, e.message)
          }

          // Notifica grupos associados sobre o failover para o bot principal
          const gruposAvisar = [...subbotEntry.grupos]
          for (const gid of gruposAvisar) {
            this.groupToSubbot.delete(gid)
            const mainSock = global.primarySocket || global.sock
            if (mainSock) {
              try {
                mainSock.sendMessage(gid, {
                  text: `⚠️ *AVISO DE SUB-BOT:*\n\nO Sub-Bot *+${num}* foi deslogado do WhatsApp.\n🔄 *Failover Ativado:* O Bot Principal assumiu o atendimento deste grupo imediatamente.`
                }).catch(() => {})
              } catch {}
            }
          }

          this.dados.subbots[num].ativo = false
          this.dados.subbots[num].status = 'desconectado_deslogado'
          this.salvarDados()
          this.activeSubbots.delete(num)
        } else {
          // Queda de rede transitória: reconectar se ativo
          if (this.dados.subbots[num]?.ativo) {
            subbotEntry.reconnectAttempts++
            const delay = Math.min(3000 * Math.pow(2, subbotEntry.reconnectAttempts - 1), 30000)
            console.log(`[SUBBOT ${num}] 🔄 Reconectando em ${Math.round(delay / 1000)}s... (Tentativa ${subbotEntry.reconnectAttempts})`)
            setTimeout(() => {
              this.conectarSubbot({
                numero: num,
                grupoId: subbotEntry.grupoSolicitante,
                autorJid
              }).catch(err => console.error(`[SUBBOT ${num}] Erro reconexão:`, err.message))
            }, delay)
          }
        }
      }
    })

    // Escuta mensagens diretamente no socket do sub-bot
    sock.ev.on('messages.upsert', async (chatUpdate) => {
      try {
        if (!chatUpdate.messages || !chatUpdate.messages.length) return
        if (typeof this.processarMensagemFn !== 'function') return

        for (const msg of chatUpdate.messages) {
          try {
            await this.processarMensagemFn(sock, msg)
          } catch (mErr) {
            console.error(`[SUBBOT ${num}] Erro ao processar mensagem:`, mErr.message)
          }
        }
      } catch (e) {
        console.error(`[SUBBOT ${num}] Erro no lote de mensagens:`, e.message)
      }
    })

    return { numero: num, sock }
  }

  async desconectarSubbot(numero, apagarSessao = true) {
    const num = this.normalizarNumero(numero)
    const active = this.activeSubbots.get(num)

    if (active?.sock) {
      try { active.sock.ws?.close() } catch {}
      try { active.sock.ev?.removeAllListeners() } catch {}
    }

    if (this.dados.subbots[num]) {
      this.dados.subbots[num].ativo = false
      this.dados.subbots[num].status = 'desconectado'
      if (apagarSessao) {
        delete this.dados.subbots[num]
      }
      this.salvarDados()
    }

    // Limpar mapeamento de grupos
    for (const [gid, subNum] of this.groupToSubbot.entries()) {
      if (subNum === num) {
        this.groupToSubbot.delete(gid)
      }
    }

    this.activeSubbots.delete(num)

    if (apagarSessao) {
      const sessionPath = path.join(SESSIONS_DIR, `subbot_${num}`)
      if (fs.existsSync(sessionPath)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true })
        } catch (e) {
          console.error(`[SUBBOT ${num}] Erro ao apagar pasta de sessão:`, e.message)
        }
      }
    }

    return true
  }

  async iniciarSubbotsExistentes(processarMensagemFn) {
    if (processarMensagemFn) {
      this.setProcessarMensagemFn(processarMensagemFn)
    }

    console.log('[SUBBOTS] 🔍 Verificando sub-bots salvos para inicialização...')
    const salvos = Object.values(this.dados.subbots || {})
    let iniciados = 0

    for (const sb of salvos) {
      if (!sb.numero || sb.ativo === false) continue
      const sessionPath = path.join(SESSIONS_DIR, `subbot_${sb.numero}`)
      const credsPath = path.join(sessionPath, 'creds.json')

      if (fs.existsSync(credsPath)) {
        console.log(`[SUBBOTS] 🚀 Restaurando sessão do sub-bot +${sb.numero}...`)
        this.conectarSubbot({
          numero: sb.numero,
          autorJid: sb.criadoPor
        }).catch(err => {
          console.error(`[SUBBOTS] Falha ao restaurar sub-bot +${sb.numero}:`, err.message)
        })
        iniciados++
      }
    }

    console.log(`[SUBBOTS] Total de sub-bot(s) restaurados: ${iniciados}`)
  }
}

const subbotManager = new SubbotManager()
module.exports = subbotManager
