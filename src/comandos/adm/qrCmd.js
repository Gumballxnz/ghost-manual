const config = require('../../../data/config.json')
const subbotManager = require('../../bot/subbotManager')

async function handleQrCommand(sock, msg, from, sender, text) {
  const prefix = config.prefix || '.'
  const rawText = (text || '').trim()
  const parts = rawText.split(/\s+/)
  const rawCmd = (parts[0] || '').toLowerCase()

  if (!rawCmd.startsWith(prefix) && !rawCmd.startsWith('!')) {
    return false
  }

  const cmdLower = rawCmd.startsWith(prefix) ? rawCmd.slice(prefix.length) : rawCmd.slice(1)
  if (cmdLower !== 'qr' && cmdLower !== 'qrcode') {
    return false
  }

  // Verificação de Segurança Total
  const isAutorizado = subbotManager.isAutorizado(sender, msg)
  if (!isAutorizado) {
    await sock.sendMessage(from, {
      text: [
        '╭┈⊰ 👻 『 *ACESSO RESTRITO* 』',
        '┊',
        '┊•.̇𖥨֗⛔⭟ *Você não tem permissão para conectar sub-bots.*',
        '┊',
        '┊•.̇𖥨֗🔒⭟ *Quem pode executar:*',
        '┊   1. Dono do Bot',
        '┊   2. Subdonos',
        '┊   3. Revendedores / Usuários autorizados',
        '┊',
        '┊•.̇𖥨֗💡⭟ Solicite autorização ao Dono ou Subdono.',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
      ].join('\n')
    }, { quoted: msg })
    return true
  }

  const rawIdentificador = parts[1] ? parts[1].trim() : ''
  const isGroup = from.endsWith('@g.us')

  let placeholderMsg = null
  try {
    placeholderMsg = await sock.sendMessage(from, {
      text: [
        '╭┈⊰ 👻 『 *INICIANDO CONEXÃO* 』',
        '┊',
        '┊•.̇𖥨֗📸⭟ *Modo:* QR Code (Imagem)',
        '┊•.̇𖥨֗⏳⭟ Gerando imagem do QR Code, aguarde...',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
      ].join('\n')
    }, { quoted: msg })
  } catch {}

  let lastQrKey = null

  try {
    await subbotManager.conectarSubbot({
      numero: rawIdentificador,
      method: 'qr',
      grupoId: isGroup ? from : null,
      autorJid: sender,
      onQrCode: async (qrBuffer, rawQr, attempt, maxAttempts) => {
        // Apaga mensagem de placeholder na primeira tentativa
        if (placeholderMsg?.key) {
          try { await sock.sendMessage(from, { delete: placeholderMsg.key }) } catch {}
          placeholderMsg = null
        }

        // Apaga o QR Code anterior para não lotar a conversa
        if (lastQrKey) {
          try { await sock.sendMessage(from, { delete: lastQrKey }) } catch {}
          lastQrKey = null
        }

        try {
          const sent = await sock.sendMessage(from, {
            image: qrBuffer,
            caption: [
              '╭┈⊰ 👻 『 *SUB-BOT: QR CODE* 』',
              '┊',
              `┊•.̇𖥨֗🔄⭟ *Tentativa:* ${attempt}/${maxAttempts}`,
              '┊•.̇𖥨֗⏱️⭟ O código expira a cada 20-30 segundos.',
              '┊',
              '┊•.̇𖥨֗📸⭟ *Como conectar no WhatsApp:*',
              '┊  1. Abra o WhatsApp no chip secundário.',
              '┊  2. Toque nos 3 pontinhos > *Aparelhos Conectados*.',
              '┊  3. Toque em *Conectar um aparelho*.',
              '┊  4. Aponte a câmera para este QR Code.',
              '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
          })
          if (sent?.key) lastQrKey = sent.key
        } catch (sendErr) {
          console.error('[QR-CMD] Erro ao enviar buffer de imagem do QR:', sendErr.message)
        }
      },
      onConnected: async (num) => {
        if (lastQrKey) {
          try { await sock.sendMessage(from, { delete: lastQrKey }) } catch {}
          lastQrKey = null
        }
        try {
          await sock.sendMessage(from, {
            text: [
              '╭┈⊰ 👻 『 *SUB-BOT CONECTADO COM SUCESSO* 』',
              '┊',
              `┊•.̇𖥨֗📱⭟ *Número Conectado:* +${num}`,
              '┊•.̇𖥨֗🟢⭟ *Status:* ONLINE',
              '┊•.̇𖥨֗🤖⭟ Este grupo agora é atendido por este sub-bot.',
              '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
          })
        } catch {}
      },
      onError: async (err) => {
        if (lastQrKey) {
          try { await sock.sendMessage(from, { delete: lastQrKey }) } catch {}
          lastQrKey = null
        }
        try {
          await sock.sendMessage(from, {
            text: [
              '╭┈⊰ 👻 『 *CONEXÃO QR EXPIRADA* 』',
              '┊',
              `┊•.̇𖥨֗⚠️⭟ ${err.message || 'Tempo limite excedido.'}`,
              `┊•.̇𖥨֗🔄⭟ Digite *${prefix}qr* para tentar novamente.`,
              '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
          }, { quoted: msg })
        } catch {}
      }
    })
  } catch (err) {
    if (placeholderMsg?.key) {
      try { await sock.sendMessage(from, { delete: placeholderMsg.key }) } catch {}
    }
    await sock.sendMessage(from, {
      text: `❌ *Erro ao iniciar conexão via QR:* ${err.message}`
    }, { quoted: msg })
  }

  return true
}

handleQrCommand.nome = 'qr'
handleQrCommand.aliases = ['qrcode']
handleQrCommand.categoria = 'adm'
handleQrCommand.subcategoria = 'CONEXAO'
handleQrCommand.descricao = 'Conectar sub-bot via QR Code'
handleQrCommand.uso = '.qr'
handleQrCommand.execute = handleQrCommand

module.exports = handleQrCommand
