const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const subbotManager = require('../../bot/subbotManager')

async function handleMenuConect(sock, msg, from, sender, text) {
  const prefix = config.prefix || '.'
  const rawText = (text || '').trim()
  const rawCmd = rawText.toLowerCase().split(/\s+/)[0]

  const isMenuCmd = rawCmd === (prefix + 'menuconect') ||
                    rawCmd === (prefix + 'painelconect') ||
                    rawCmd === (prefix + 'conexoes') ||
                    rawCmd === '.menuconect' ||
                    rawCmd === '.painelconect' ||
                    rawCmd === '.conexoes'

  if (!isMenuCmd) {
    return false
  }

  const isAutorizado = subbotManager.isAutorizado(sender, msg)
  if (!isAutorizado) {
    await sock.sendMessage(from, {
      text: '❌ *Apenas o Dono, Subdonos ou Revendedores autorizados podem acessar este menu.*'
    }, { quoted: msg })
    return true
  }

  const userName = msg.pushName || 'Revendedor'

  const header = [
    '╭┈⊰ 👻 『 *PAINEL DE CONEXÕES & SUB-BOTS* 』',
    `┊Olá, ${userName}!`,
    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
  ].join('\n')

  const blocoConexao = [
    '╭┈❁ *🔌 MÉTODOS DE CONEXÃO (A-Z)*',
    '┊',
    `┊•.̇𖥨֗👻⭟${prefix}conect <numero> (Código de 8 dígitos)`,
    `┊•.̇𖥨֗👻⭟${prefix}qr (Escanear QR Code)`,
    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
  ].join('\n')

  const blocoGestao = [
    '╭┈❁ *📊 GESTÃO DE SESSÕES & GRUPOS*',
    '┊',
    `┊•.̇𖥨֗👻⭟${prefix}subbots (Ver sub-bots ativos)`,
    `┊•.̇𖥨֗👻⭟${prefix}subbot grupos (Grupos vinculados)`,
    `┊•.̇𖥨֗👻⭟${prefix}meusgrupos (Seus grupos autorizados)`,
    `┊•.̇𖥨֗👻⭟${prefix}subbot vincular [numero]`,
    `┊•.̇𖥨֗👻⭟${prefix}subbot desvincular`,
    `┊•.̇𖥨֗👻⭟${prefix}desconectar <numero>`,
    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
  ].join('\n')

  const blocoDono = [
    '╭┈❁ *👑 CONTROLE DE ACESSO (DONO/SUBDONO)*',
    '┊',
    `┊•.̇𖥨֗👻⭟${prefix}subbot autorizar <numero | @user>`,
    `┊•.̇𖥨֗👻⭟${prefix}subbot desautorizar <numero>`,
    `┊•.̇𖥨֗👻⭟${prefix}subbot autorizados`,
    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
  ].join('\n')

  await sock.sendMessage(from, {
    text: [header, blocoConexao, blocoGestao, blocoDono].join('\n\n')
  }, { quoted: msg })

  return true
}

handleMenuConect.nome = 'menuconect'
handleMenuConect.aliases = ['painelconect', 'conexoes']
handleMenuConect.categoria = 'adm'
handleMenuConect.descricao = 'Exibe o menu de conexões e pareamento'
handleMenuConect.uso = '.menuconect'
handleMenuConect.execute = handleMenuConect

module.exports = handleMenuConect
