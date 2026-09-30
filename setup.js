#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { execSync } = require('child_process')
const pino = require('pino')
const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m'
}

function prompt(rl, questionText, defaultValue = '') {
  return new Promise((resolve) => {
    const q = defaultValue
      ? `${C.cyan}?${C.reset} ${C.bold}${questionText}${C.reset} ${C.dim}(Padrão: ${defaultValue})${C.reset} › `
      : `${C.cyan}?${C.reset} ${C.bold}${questionText}${C.reset} › `

    rl.question(q, (answer) => {
      const trimmed = answer.trim()
      resolve(trimmed ? trimmed : defaultValue)
    })
  })
}

async function runSetup() {
  console.clear()
  console.log(`
${C.magenta}╭────────────────────────────────────────────────────────╮
│          👻  G H O S T   B O T   M A N U A L           │
│             Assistente Interativo de Setup             │
╰────────────────────────────────────────────────────────╯${C.reset}
`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  try {
    // ==========================================
    // ETAPA 1: CONFIGURAÇÕES DO BOT E DONO
    // ==========================================
    console.log(`${C.yellow}📋 ETAPA 1: Configuração Básica do Bot${C.reset}\n`)

    let ownerPhone = ''
    while (!ownerPhone) {
      const input = await prompt(rl, 'Número do Dono (com DDI, ex: 25884xxxxxxx)')
      const digits = input.replace(/\D/g, '')
      if (digits.length >= 8) {
        ownerPhone = digits
      } else {
        console.log(`${C.red}❌ Número inválido! Informe o número completo com DDI (ex: 258841234567).${C.reset}`)
      }
    }

    const ownerName = await prompt(rl, 'Nome do Dono', 'Dono')
    const botName = await prompt(rl, 'Nome do Bot', 'GHOST BOT')
    const prefix = await prompt(rl, 'Prefixo de comandos', '.')

    const dataDir = path.join(__dirname, 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    const configData = {
      prefix,
      dono: [ownerPhone],
      ownerDisplayNumber: ownerPhone,
      ownerName,
      ownerLids: [],
      botNumber: '',
      botName,
      canalLink: '',
      botaoExtra: 'Sobre o bot'
    }

    const configPath = path.join(dataDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8')
    console.log(`\n${C.green}✅ Arquivo data/config.json configurado com sucesso!${C.reset}`)

    const envPath = path.join(__dirname, '.env')
    const envExamplePath = path.join(__dirname, '.env.example')
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath)
      console.log(`${C.green}✅ Arquivo .env gerado a partir de .env.example!${C.reset}`)
    }

    // ==========================================
    // ETAPA 2: CONEXÃO COM O WHATSAPP
    // ==========================================
    console.log(`\n${C.yellow}🔌 ETAPA 2: Conexão com o WhatsApp${C.reset}\n`)
    console.log(`Escolha como deseja conectar:`)
    console.log(`  ${C.bold}1)${C.reset} Código de Pareamento de 8 dígitos ${C.dim}(Recomendado para VPS/Terminal)${C.reset}`)
    console.log(`  ${C.bold}2)${C.reset} QR Code no Terminal\n`)

    let method = ''
    while (method !== '1' && method !== '2') {
      method = await prompt(rl, 'Escolha a opção (1 ou 2)', '1')
    }

    let botPhone = ''
    if (method === '1') {
      while (!botPhone) {
        const input = await prompt(rl, 'Número do chip que será o Bot (com DDI, ex: 25884xxxxxxx)', ownerPhone)
        const digits = input.replace(/\D/g, '')
        if (digits.length >= 8) {
          botPhone = digits
        } else {
          console.log(`${C.red}❌ Número inválido! Informe o número completo com DDI.${C.reset}`)
        }
      }
      configData.botNumber = botPhone
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8')
    }

    rl.close()

    console.log(`\n${C.cyan}⏳ Inicializando motor do WhatsApp (Baileys)...${C.reset}`)
    await conectarWhatsApp(method === '2', botPhone)

    // ==========================================
    // ETAPA 3: INICIALIZAÇÃO NO PM2 (24/7)
    // ==========================================
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log(`\n${C.yellow}🚀 ETAPA 3: Execução 24 Horas (PM2)${C.reset}\n`)
    const iniciarPm2 = await prompt(rl2, 'Deseja iniciar o bot em segundo plano no PM2 agora? (s/n)', 's')
    rl2.close()

    if (iniciarPm2.toLowerCase() === 's' || iniciarPm2.toLowerCase() === 'sim') {
      iniciarComPm2()
    } else {
      console.log(`\n${C.green}🎉 Configuração concluída!${C.reset}`)
      console.log(`Para iniciar o bot manualmente no futuro:`)
      console.log(`  ${C.bold}node index.js${C.reset}   (ou: ${C.bold}pm2 start index.js --name "ghost-manual"${C.reset})\n`)
      process.exit(0)
    }

  } catch (err) {
    console.error(`\n${C.red}❌ Ocorreu um erro durante o assistente:${C.reset}`, err.message)
    try { rl.close() } catch {}
    process.exit(1)
  }
}

function conectarWhatsApp(isQrMode, phoneNum) {
  return new Promise(async (resolve, reject) => {
    let isDone = false
    const sessionDir = path.join(__dirname, 'session')
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: isQrMode,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      auth: state,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update
      const statusCode = lastDisconnect?.error?.output?.statusCode

      if (connection === 'open') {
        if (isDone) return
        isDone = true
        console.log(`\n${C.green}====================================================`)
        console.log(`  ✅ CONECTADO AO WHATSAPP COM SUCESSO!`)
        console.log(`  📁 Credenciais salvas com segurança na pasta session/`)
        console.log(`====================================================${C.reset}\n`)
        await saveCreds()

        // Mapear participantes dos grupos imediatamente
        try {
          const { mapearGrupo } = require('./src/bot/core')
          const groups = await sock.groupFetchAllParticipating()
          for (const gid of Object.keys(groups || {})) {
            await mapearGrupo(sock, gid)
          }
        } catch {}

        try { sock.end(undefined) } catch {}
        try { sock.ws?.close() } catch {}
        setTimeout(() => resolve(true), 1000)
        return
      }

      if (connection === 'close' && !isDone) {
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        if (shouldReconnect) {
          console.log(`${C.dim}🔄 Conexão reiniciando para sincronizar pareamento (Código: ${statusCode || 'reconnect'})...${C.reset}`)
          conectarWhatsApp(isQrMode, phoneNum).then(resolve).catch(reject)
        } else {
          console.log(`${C.red}❌ Sessão encerrada no celular (Logged out).${C.reset}`)
          reject(new Error('Sessão cancelada no celular.'))
        }
      }
    })

    if (!isQrMode && !sock.authState.creds.registered) {
      setTimeout(async () => {
        if (isDone) return
        try {
          console.log(`\n${C.cyan}📲 Solicitando código de pareamento para o número +${phoneNum}...${C.reset}`)
          const code = await sock.requestPairingCode(phoneNum)
          const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code

          console.log(`\n${C.green}┌──────────────────────────────────────────────────┐`)
          console.log(`│   CÓDIGO DE PAREAMENTO:   ${C.bold}${C.white}${formattedCode}${C.reset}${C.green}        │`)
          console.log(`└──────────────────────────────────────────────────┘${C.reset}`)
          console.log(`${C.yellow}👉 Abra o WhatsApp no celular:`)
          console.log(`   1. Menu (três pontos) > Aparelhos Conectados`)
          console.log(`   2. Conectar aparelho > "Conectar com número de telefone"`)
          console.log(`   3. Digite o código acima!${C.reset}\n`)
          console.log(`${C.dim}⏳ Aguardando confirmação no WhatsApp...${C.reset}`)
        } catch (err) {
          if (!isDone) {
            console.error(`${C.red}❌ Erro ao solicitar código de pareamento:${C.reset}`, err.message)
            reject(err)
          }
        }
      }, 3000)
    }
  })
}

function iniciarComPm2() {
  console.log(`\n${C.cyan}⚙️  Configurando inicialização em segundo plano com PM2...${C.reset}`)

  let temPm2 = false
  try {
    execSync('pm2 -v', { stdio: 'ignore' })
    temPm2 = true
  } catch {}

  if (!temPm2) {
    console.log(`${C.yellow}⚠️  PM2 não encontrado globalmente. Instalando via npm...${C.reset}`)
    try {
      execSync('npm install -g pm2', { stdio: 'inherit' })
      temPm2 = true
    } catch (e) {
      console.log(`${C.red}❌ Não foi possível instalar o PM2 automaticamente.${C.reset}`)
      console.log(`Instale manualmente com: ${C.bold}npm install -g pm2${C.reset}`)
      return
    }
  }

  try {
    try { execSync('pm2 delete ghost-manual', { stdio: 'ignore' }) } catch {}

    execSync('pm2 start index.js --name "ghost-manual" --time', { stdio: 'inherit' })
    try { execSync('pm2 save', { stdio: 'ignore' }) } catch {}

    console.log(`\n${C.green}====================================================`)
    console.log(`  🎉 PARABÉNS! SEU BOT JÁ ESTÁ ONLINE 24 HORAS!`)
    console.log(`====================================================${C.reset}\n`)
    console.log(`Comandos úteis para o seu dia a dia:`)
    console.log(`  • ${C.cyan}pm2 logs ghost-manual${C.reset}    (Ver logs de mensagens em tempo real)`)
    console.log(`  • ${C.cyan}pm2 restart ghost-manual${C.reset} (Reiniciar o bot)`)
    console.log(`  • ${C.cyan}pm2 stop ghost-manual${C.reset}    (Pausar o bot)`)
    console.log(`  • ${C.cyan}pm2 status${C.reset}               (Ver consumo de RAM e CPU)\n`)
    process.exit(0)
  } catch (err) {
    console.error(`${C.red}❌ Erro ao iniciar via PM2:${C.reset}`, err.message)
    console.log(`Inicie manualmente com: ${C.bold}pm2 start index.js --name "ghost-manual"${C.reset}\n`)
    process.exit(1)
  }
}

if (require.main === module) {
  runSetup()
}

module.exports = runSetup
