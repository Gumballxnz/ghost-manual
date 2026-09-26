const configManager = require('../utils/configManager')

module.exports = async (sock, update) => {

    if (update?.participants && update.action === 'remove') {
        const groupId = update.id
        if (!groupId) return

        const cfg = configManager.loadGroupConfig()
        const dotJid = groupId.replace(/\./g, '___dot___')
        const grupoCfg = cfg[groupId] || cfg[dotJid] || {}
        const isOn = grupoCfg.msgSaida || grupoCfg.adeus

        if (isOn) {
            try {
                for (const participant of update.participants) {
                    const mention = `@${participant.split('@')[0].split(':')[0]}`
                    const texto = `👋 ${mention} saiu do grupo. Até mais!`

                    await sock.sendMessage(groupId, {
                        text: texto,
                        mentions: [participant]
                    })
                }
            } catch (err) {
                console.error("Erro ao enviar mensagem de saída:", err.message)
            }
        }
    }
}
