const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isAdmin, isOwnerCheck, isLeaderCheck } = require('../../utils/baileys')
const subbotManager = require('../../bot/subbotManager')

module.exports = async (sock, msg, from, sender, text) => {
  const prefix = config.prefix || '.'
  const trimmed = (text || '').trim()
  if (!trimmed.startsWith(prefix)) return false

  const args = trimmed.slice(prefix.length).trim().split(/\s+/)
  const command = (args[0] || '').toLowerCase()

  const isSubbotCmd = command === 'subbot' || command === 'subbots'
  const isConectCmd = command === 'conect' || command === 'conectar'
  const isDelSubbotCmd = command === 'delsubbot' || command === 'deletesubbot'

  if (!isSubbotCmd && !isConectCmd && !isDelSubbotCmd) {
    return false
  }

  const isGroup = from.endsWith('@g.us')
  const isOwner = isLeaderCheck(sender, msg) || isOwnerCheck(sender, msg)
  let isAdm = false

  if (isGroup) {
    try {
      isAdm = await isAdmin(sock, from, sender)
    } catch {
      isAdm = false
    }
  }

  // Apenas donos e administradores do grupo podem gerenciar sub-bots
  if (!isOwner && !isAdm) {
    await sock.sendMessage(from, {
      text: '❌ *Apenas administradores do grupo ou o dono do bot podem gerenciar sub-bots.*'
    }, { quoted: msg })
    return true
  }

  // ==========================================
  // COMANDO DIRETO: .conect / .conectar <numero>
  // ==========================================
  if (isConectCmd) {
    const rawNumber = args[1]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *CONECTAR SUB-BOT* 』',
          '┊',
          '┊•.̇𖥨֗📱⭟ *Uso correto:*',
          `┊      ${prefix}conect <número_com_ddi>`,
          '┊',
          '┊•.̇𖥨֗💡⭟ *Exemplo (Moçambique):*',
          `┊      ${prefix}conect 258841234567`,
          '┊',
          '┊•.̇𖥨֗ℹ️⭟ O bot irá gerar um código de 8 dígitos',
          '┊      para você conectar pelo WhatsApp do chip.',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    return await executarConexaoSubbot(sock, msg, from, sender, rawNumber, prefix)
  }

  // ==========================================
  // COMANDO DIRETO: .delsubbot <numero>
  // ==========================================
  if (isDelSubbotCmd) {
    const rawNumber = args[1]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número do sub-bot a ser removido.*\nExemplo: \`${prefix}delsubbot 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }
    return await executarRemoverSubbot(sock, msg, from, rawNumber)
  }

  // ==========================================
  // SUBCOMANDOS: .subbot [opção]
  // ==========================================
  const subOpcao = (args[1] || '').toLowerCase()

  // 1. .subbot lista / .subbots / .subbot status
  if (!subOpcao || subOpcao === 'lista' || subOpcao === 'list' || subOpcao === 'status' || command === 'subbots') {
    const lista = subbotManager.listarSubbots()
    if (!lista || lista.length === 0) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *SISTEMA DE SUB-BOTS* 』',
          '┊',
          '┊•.̇𖥨֗ℹ️⭟ *Nenhum sub-bot registrado no momento.*',
          '┊',
          `┊•.̇𖥨֗➕⭟ Digite *${prefix}conect <numero>* para conectar`,
          '┊      um chip secundário agora mesmo!',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    const linhas = [
      '╭┈⊰ 👻 『 *SUB-BOTS ATIVOS & REGISTRADOS* 』',
      '┊'
    ]

    for (let i = 0; i < lista.length; i++) {
      const sb = lista[i]
      const statusIcon = sb.online ? '🟢 Online' : (sb.status === 'pareando' ? '🟡 Pareando' : '🔴 Offline')
      const qtdGrupos = sb.grupos ? sb.grupos.length : 0
      linhas.push(`┊•.̇𖥨֗📱⭟ *Sub-Bot #${i + 1}:* +${sb.numero}`)
      linhas.push(`┊      Status: *${statusIcon}*`)
      linhas.push(`┊      Grupos atendidos: *${qtdGrupos}*`)
      linhas.push('┊')
    }

    linhas.push(`┊•.̇𖥨֗💡⭟ *Comandos:*`)
    linhas.push(`┊   • \`${prefix}conect <numero>\` › Conectar novo`)
    linhas.push(`┊   • \`${prefix}subbot del <numero>\` › Remover`)
    linhas.push(`┊   • \`${prefix}subbot vincular <numero>\` › Atrelar a este grupo`)
    linhas.push(`┊   • \`${prefix}subbot desvincular\` › Voltar para bot principal`)
    linhas.push('╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯')

    await sock.sendMessage(from, { text: linhas.join('\n') }, { quoted: msg })
    return true
  }

  // 2. .subbot conectar / .subbot conect <numero>
  if (subOpcao === 'conect' || subOpcao === 'conectar' || subOpcao === 'add') {
    const rawNumber = args[2]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número com DDI.*\nExemplo: \`${prefix}subbot conect 258841234567\``
      }, { quoted: msg })
      return true
    }
    return await executarConexaoSubbot(sock, msg, from, sender, rawNumber, prefix)
  }

  // 3. .subbot del / remover <numero>
  if (subOpcao === 'del' || subOpcao === 'remover' || subOpcao === 'delete') {
    const rawNumber = args[2]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número a remover.*\nExemplo: \`${prefix}subbot del 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }
    return await executarRemoverSubbot(sock, msg, from, rawNumber)
  }

  // 4. .subbot vincular [numero] (vincula o grupo atual ao sub-bot)
  if (subOpcao === 'vincular' || subOpcao === 'associar') {
    if (!isGroup) {
      await sock.sendMessage(from, { text: '❌ Este comando só pode ser usado dentro de um grupo.' }, { quoted: msg })
      return true
    }
    const rawNumber = args[2]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número do sub-bot.*\nExemplo: \`${prefix}subbot vincular 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }
    const numLimpo = rawNumber.replace(/\D/g, '')
    subbotManager.vincularGrupo(numLimpo, from)
    await sock.sendMessage(from, {
      text: `✅ *Grupo Vinculado!*\n\n📱 Sub-Bot: *+${numLimpo}*\nEste grupo agora é atendido por este sub-bot.`
    }, { quoted: msg })
    return true
  }

  // 5. .subbot desvincular (desvincula o grupo atual do sub-bot)
  if (subOpcao === 'desvincular' || subOpcao === 'soltar') {
    if (!isGroup) {
      await sock.sendMessage(from, { text: '❌ Este comando só pode ser usado dentro de um grupo.' }, { quoted: msg })
      return true
    }
    subbotManager.desvincularGrupo(from)
    await sock.sendMessage(from, {
      text: `🔄 *Grupo Desvinculado!*\n\nO bot principal reassumiu o atendimento deste grupo.`
    }, { quoted: msg })
    return true
  }

  // Ajuda padrão
  await sock.sendMessage(from, {
    text: [
      '╭┈⊰ 👻 『 *SISTEMA DE SUB-BOTS* 』',
      '┊',
      '┊•.̇𖥨֗🤖⭟ *Comandos disponíveis:*',
      `┊  • \`${prefix}conect <numero>\` › Conectar novo sub-bot`,
      `┊  • \`${prefix}subbots\` › Ver sub-bots online`,
      `┊  • \`${prefix}subbot vincular <numero>\` › Atrelar a este grupo`,
      `┊  • \`${prefix}subbot desvincular\` › Bot principal reassume`,
      `┊  • \`${prefix}subbot del <numero>\` › Remover sub-bot`,
      '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
    ].join('\n')
  }, { quoted: msg })
  return true
}

async function executarConexaoSubbot(sock, msg, from, sender, rawNumber, prefix) {
  const cleanNumber = String(rawNumber).replace(/\D/g, '')
  if (cleanNumber.length < 8) {
    await sock.sendMessage(from, {
      text: '❌ *Número inválido!* Digite o número completo com DDI (ex: 258841234567).'
    }, { quoted: msg })
    return true
  }

  const existing = subbotManager.getSubbotPorNumero(cleanNumber)
  if (existing && existing.status === 'online') {
    await sock.sendMessage(from, {
      text: `⚠️ *O sub-bot +${cleanNumber} já está conectado e online!*`
    }, { quoted: msg })
    return true
  }

  await sock.sendMessage(from, {
    text: `⏳ *Iniciando conexão para o número +${cleanNumber}...*\n\nGerando código de pareamento, por favor aguarde alguns segundos...`
  }, { quoted: msg })

  try {
    let codigoEnviado = false

    await subbotManager.conectarSubbot({
      numero: cleanNumber,
      grupoId: from.endsWith('@g.us') ? from : null,
      autorJid: sender,
      onPairingCode: async (formattedCode, rawCode) => {
        if (codigoEnviado) return
        codigoEnviado = true

        const cardMsg = [
          '╭┈⊰ 👻 『 *SUB-BOT: CÓDIGO DE CONEXÃO* 』',
          '┊',
          `┊•.̇𖥨֗📱⭟ *Número Alvo:* +${cleanNumber}`,
          '┊•.̇𖥨֗🔑⭟ *Código de Pareamento:*',
          '┊',
          `┊     👉 *${formattedCode}* 👈`,
          '┊',
          '┊•.̇𖥨֗📋⭟ *Como conectar no WhatsApp:*',
          '┊  1. Abra o WhatsApp no aparelho desse chip.',
          '┊  2. Toque nos *3 pontinhos* (ou Configurações).',
          '┊  3. Selecione *Aparelhos Conectados*.',
          '┊  4. Toque em *Conectar um aparelho*.',
          '┊  5. Escolha *Conectar com número de telefone*.',
          '┊  6. Digite o código de 8 dígitos acima.',
          '┊',
          '┊•.̇𖥨֗⏱️⭟ *Atenção:* O código expira em ~60 segundos.',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        try {
          await sock.sendMessage(from, { text: cardMsg }, { quoted: msg })
          // Envia o código limpo na sequência para facilitar copiar no celular
          await sock.sendMessage(from, { text: `${rawCode || formattedCode.replace(/-/g, '')}` })
        } catch (sendErr) {
          console.error('[SUBBOT] Erro ao enviar mensagem do código:', sendErr.message)
        }
      },
      onConnected: async (num) => {
        try {
          await sock.sendMessage(from, {
            text: `🎉 *SUB-BOT CONECTADO COM SUCESSO!*\n\n📱 Chip: *+${num}*\n✅ Pronto para responder comandos e atender o grupo!`
          })
        } catch {}
      },
      onError: async (err) => {
        try {
          await sock.sendMessage(from, {
            text: `❌ *Erro ao gerar código para +${cleanNumber}:*\n${err.message || err}\n\n💡 Tente novamente usando: \`${prefix}conect ${cleanNumber}\``
          }, { quoted: msg })
        } catch {}
      }
    })
  } catch (err) {
    await sock.sendMessage(from, {
      text: `❌ *Erro ao iniciar conexão do sub-bot:* ${err.message}`
    }, { quoted: msg })
  }

  return true
}

async function executarRemoverSubbot(sock, msg, from, rawNumber) {
  const cleanNumber = String(rawNumber).replace(/\D/g, '')
  await subbotManager.desconectarSubbot(cleanNumber, true)
  await sock.sendMessage(from, {
    text: `🗑️ *Sub-Bot +${cleanNumber} desconectado e removido com sucesso!*\n\nO bot principal reassumiu o atendimento de qualquer grupo que estava atrelado a ele.`
  }, { quoted: msg })
  return true
}
