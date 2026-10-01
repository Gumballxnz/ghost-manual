const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { bemvindoStore, groupConfigStore } = require('../../utils/firebaseDataLayer')
const { isAdmin, isOwnerCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')

function loadConfig() {
  return bemvindoStore.loadSync() || {}
}

function saveConfig(data) {
  bemvindoStore.save(data)
}

module.exports = async (sock, msg, from, sender, text) => {
  const lower = (text || '').trim().toLowerCase()
  const isBvCmd = lower.startsWith(config.prefix + 'bemvindo') ||
                  lower.startsWith(config.prefix + 'boas-vindas') ||
                  lower.startsWith(config.prefix + 'boasvindas')

  if (!isBvCmd) return false

  const isGroup = from.endsWith('@g.us')
  if (!isGroup) {
    await sock.sendMessage(from, { text: '❌ Este comando só pode ser usado dentro de grupos.' }, { quoted: msg })
    return true
  }

  const isOwner = isOwnerCheck(sender, msg)
  const isAdm = isGroup ? await isAdmin(sock, from, sender) : false
  if (!isOwner && !isAdm) {
    await sock.sendMessage(from, { text: '❌ Apenas administradores do grupo podem ativar ou desativar as boas-vindas.' }, { quoted: msg })
    return true
  }

  const args = lower.split(/\s+/)
  const option = args[1]

  if (!option || !['on', 'off', 'ligar', 'desligar', '1', '0'].includes(option)) {
    await sock.sendMessage(from, { text: '⚙️ *Uso correto:*\n• `.boas-vindas on` (ativa as boas-vindas)\n• `.boas-vindas off` (desativa as boas-vindas)' }, { quoted: msg })
    return true
  }

  const isLigado = ['on', 'ligar', '1'].includes(option)

  const cfg = loadConfig()
  cfg[from] = isLigado
  saveConfig(cfg)

  try {
    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}
    groupConfig[from].bemvindo = isLigado
    groupConfig[from].boasVindas = isLigado
    configManager.saveGroupConfig(groupConfig)
  } catch (err) {}

  const status = isLigado ? '🟢 *ATIVADO*' : '🔴 *DESATIVADO*'
  await sock.sendMessage(from, { text: `📢 O sistema de boas‑vindas foi ${status} com sucesso neste grupo.` }, { quoted: msg })

  return true
}
