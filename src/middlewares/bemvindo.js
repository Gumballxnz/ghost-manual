const configManager = require('../utils/configManager')
const { bemvindoStore } = require('../utils/firebaseDataLayer')

function getDataMocambique() {
  const now = new Date()
  const offset = 2 * 60
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  return new Date(utc + (offset * 60000))
}

function grupoAutorizado(groupId) {
  const groups = configManager.loadGroupConfig()
  const grupoInfo = groups[groupId] || groups[groupId.replace(/\./g, '___dot___')] || groups[groupId.replace(/___dot___/g, '.')] || {}

  if (!grupoInfo?.authorized) return false

  if (grupoInfo.expiraEm) {
    const agora = getDataMocambique().getTime()
    if (agora >= grupoInfo.expiraEm) return false
  }

  return true
}

module.exports = async (sock, update) => {
  if (update?.participants && update.action === 'add') {
    const groupId = update.id
    if (!groupId) return

    if (!grupoAutorizado(groupId)) return

    const groups = configManager.loadGroupConfig()
    const grupoCfg = groups[groupId] || groups[groupId.replace(/\./g, '___dot___')] || groups[groupId.replace(/___dot___/g, '.')] || {}

    const bemvindoConfig = bemvindoStore.loadSync() || {}
    const dotJid = groupId.replace(/\./g, '___dot___')
    const bvStatus = bemvindoConfig[groupId] !== undefined ? bemvindoConfig[groupId] : bemvindoConfig[dotJid]

    if (grupoCfg.bemvindo === false || bvStatus === false) {
      return
    }

    const isOn = bvStatus === true || grupoCfg.boasVindas === true || grupoCfg.bemvindo === true

    if (isOn) {
      try {
        const mencoesTexto = update.participants.map(p => `@${p.split('@')[0].split(':')[0]}`).join(', ')

        const texto = `${mencoesTexto}\n╭━━━┛ 🎉 *SEJA BEM-VINDO AO MELHOR GRUPO DE INTERNET* 🚀\n┃\n┃ 📖 Para ver a tabela ➝ tabela\n┃ 💳 Para ver as formas de pagamento ➝ pagamento\n┃\n┃ 📌 Fica à vontade para perguntar 📌\n╰━━━━━━━━━━━━━━━━━━━━━`

        let profilePic = null
        try {
          if (update.participants.length === 1) {
            try {
              profilePic = await sock.profilePictureUrl(update.participants[0], 'image')
            } catch {
              profilePic = null
            }
          }

          if (!profilePic) {
            try {
              profilePic = await sock.profilePictureUrl(groupId, 'image')
            } catch {
              profilePic = null
            }
          }
        } catch { }

        if (profilePic) {
          await sock.sendMessage(groupId, {
            image: { url: profilePic },
            caption: texto,
            mentions: update.participants
          })
        } else {
          await sock.sendMessage(groupId, {
            text: texto,
            mentions: update.participants
          })
        }
        console.log(`[BEMVINDO] Mensagem enviada com sucesso no grupo ${groupId}`)
      } catch (err) {
        console.error("[BEMVINDO] Erro ao enviar boas-vindas:", err.message)
      }
    }
  }
}
