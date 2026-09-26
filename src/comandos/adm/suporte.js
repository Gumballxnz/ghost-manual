const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isLeaderCheck, isOwnerCheck, isAdmin } = require('../../utils/baileys')
const { getSuporteNumber, setSuporteCache } = require('../../utils/configManager')
const { putFirebase } = require('../../utils/firebaseConfig')
const fs = require('fs')

module.exports = async function(sock, msg, from, sender, text) {
  const prefix = config.prefix || '.'
  const rawTokens = (text || '').trim().split(/\s+/)
  const cmd = (rawTokens[0] || '').toLowerCase()

  if (cmd === prefix + 'setsuporte') {
    if (!isLeaderCheck(sender, msg)) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *ACESSO NEGADO* 』',
          '┊❌ Permissão Insuficiente',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
          '',
          'Apenas o líder supremo / dono principal do bot pode definir o número de suporte.'
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    const novoNum = (rawTokens[1] || '').replace(/\D/g, '')
    if (!novoNum || novoNum.length < 8) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *AJUDA DE COMANDO* 』',
          '┊⚙️ Definição de Suporte',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
          '',
          'Informe o número válido para o suporte:',
          `👉 *Exemplo:* \`${prefix}setsuporte 25884xxxxxxx\``
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    setSuporteCache(novoNum)

    try {
      const cfgPath = path.join(__dirname, '../../../data/config.json')
      let cfgData = {}
      if (fs.existsSync(cfgPath)) {
        cfgData = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      }
      cfgData.suporteNumber = novoNum
      fs.writeFileSync(cfgPath, JSON.stringify(cfgData, null, 2), 'utf8')
    } catch (e) {
      console.error('[SETSUPORTE] Erro ao salvar config.json:', e.message)
    }

    try {
      await putFirebase('bot_data/suporteNumber', novoNum)
    } catch (e) {
      console.error('[SETSUPORTE] Erro ao salvar Firebase:', e.message)
    }

    await sock.sendMessage(from, {
      text: [
        '╭┈⊰ 👻 『 *SUPORTE ATUALIZADO* 』',
        '┊🤖 GHOST BOT',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
        '',
        '╭┈❁ *📞 CONTATO OFICIAL*',
        `┊•.̇𖥨֗👻⭟ *Número:* ${novoNum}`,
        `┊•.̇𖥨֗👻⭟ *Link:* wa.me/${novoNum}`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
      ].join('\n')
    }, { quoted: msg })
    return true
  }

  if (cmd === prefix + 'suporte') {
    const isGroup = from.endsWith('@g.us')
    const isOwner = isOwnerCheck(sender, msg)
    let adminStatus = false
    if (isGroup) {
      try {
        adminStatus = await isAdmin(sock, from, sender)
      } catch (e) {}
    }

    if (isGroup && !isOwner && !adminStatus) {
      return true
    }

    let suporteNum = null
    try {
      const { fetchFirebase } = require('../../utils/firebaseConfig')
      const fbSup = await fetchFirebase('bot_data/suporteNumber')
      if (fbSup && typeof fbSup === 'string' && fbSup.trim().length >= 8) {
        suporteNum = fbSup.trim().replace(/\D/g, '')
        setSuporteCache(suporteNum)
      }
    } catch {}
    if (!suporteNum) {
      suporteNum = getSuporteNumber()
    }

    if (!suporteNum) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *SUPORTE TÉCNICO* 』',
          '┊🤖 GHOST BOT',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
          '',
          '⚠️ *Nenhum número de suporte configurado no momento.*',
          'O dono pode configurar com: `.setsuporte 25884xxxxxxx`'
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    await sock.sendMessage(from, {
      text: [
        '╭┈⊰ 👻 『 *SUPORTE TÉCNICO* 』',
        '┊🤖 GHOST BOT',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
        '',
        '╭┈❁ *💬 ATENDIMENTO*',
        '┊•.̇𖥨֗👻⭟ Precisa de suporte ou dúvidas?',
        `┊•.̇𖥨֗👻⭟ *WhatsApp:* wa.me/${suporteNum}`,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
      ].join('\n')
    }, { quoted: msg })
    return true
  }

  return false
}
