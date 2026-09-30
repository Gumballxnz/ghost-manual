const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')
const { copyNanoCommands, copyNanosCommands } = require('../../bot/nano')

module.exports = async (sock, msg, from, sender, text) => {
    const lower = text.toLowerCase().trim()
    const prefix = config.prefix

    const cmdNano = prefix + 'copiarnano'
    const cmdNanos = prefix + 'copiarnanos'
    const cmdProtecoes = prefix + 'copiarprotecoes'
    const cmdConfig = prefix + 'copiarconfiguracoes'

    if (!lower.startsWith(cmdNano) && !lower.startsWith(cmdNanos) && !lower.startsWith(cmdProtecoes) && !lower.startsWith(cmdConfig)) {
        return false
    }

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado dentro de grupos.' }, { quoted: msg })
        return true
    }

    const isOwner = isOwnerCheck(sender, msg)
    const isAdminUser = await checkIsAdmin(sock, from, sender)
    if (!isOwner && !isAdminUser) {
        await sock.sendMessage(from, { text: '❌ Apenas administradores podem utilizar comandos de clonagem.' }, { quoted: msg })
        return true
    }

    let sourceId = text.split(' ').slice(1).join(' ').trim()
    if (!sourceId) {
        await sock.sendMessage(from, { text: `❌ Informe o ID do grupo de origem.\nExemplo: \`${lower.split(' ')[0]} 120363xxxxxx@g.us\`\n\n💡 Obtenha o ID do grupo desejado usando o comando \`.infogp\` naquele grupo.` }, { quoted: msg })
        return true
    }

    if (!sourceId.includes('@')) {
        sourceId = sourceId.replace(/\D/g, '') + '@g.us'
    }

    if (lower.startsWith(cmdNano) && !lower.startsWith(cmdNanos)) {
        const qtd = copyNanoCommands(sourceId, from)
        if (qtd === 0) {
            await sock.sendMessage(from, { text: `⚠️ Nenhum comando NANO encontrado no grupo de origem (\`${sourceId}\`).` }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                text: `✅ *NANO COMANDOS CLONADOS COM SUCESSO!*\n\n📌 *Origem:* \`${sourceId}\`\n📥 *Total Copiado:* ${qtd} nano comandos adicionados a este grupo.`
            }, { quoted: msg })
        }
        return true
    }

    if (lower.startsWith(cmdNanos)) {
        const qtd = copyNanosCommands(sourceId, from)
        if (qtd === 0) {
            await sock.sendMessage(from, { text: `⚠️ Nenhum comando NANOS encontrado no grupo de origem (\`${sourceId}\`).` }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                text: `✅ *NANOS COMANDOS CLONADOS COM SUCESSO!*\n\n📌 *Origem:* \`${sourceId}\`\n📥 *Total Copiado:* ${qtd} nanos comandos adicionados a este grupo.`
            }, { quoted: msg })
        }
        return true
    }

    if (lower.startsWith(cmdProtecoes)) {
        const allConfigs = configManager.loadGroupConfig()
        const sourceCfg = allConfigs[sourceId]

        if (!sourceCfg) {
            await sock.sendMessage(from, { text: `⚠️ Nenhuma configuração encontrada para o grupo de origem (\`${sourceId}\`).` }, { quoted: msg })
            return true
        }

        if (!allConfigs[from]) allConfigs[from] = {}
        const targetCfg = allConfigs[from]

        const protecoesKeys = [
            'antiLink', 'antiStatus', 'antiGringo', 'antiPalavrao',
            'antiTrava', 'antiFake', 'antiFlood', 'antiBotClone',
            'botDesligado', 'anticoncorrencia'
        ]

        let copiados = 0
        for (const key of protecoesKeys) {
            if (typeof sourceCfg[key] === 'boolean') {
                targetCfg[key] = sourceCfg[key]
                copiados++
            }
        }

        configManager.saveGroupConfig(true)

        await sock.sendMessage(from, {
            text: `✅ *PROTEÇÕES CLONADAS COM SUCESSO!*\n\n📌 *Origem:* \`${sourceId}\`\n🛡️ *Status:* ${copiados} proteções ON/OFF sincronizadas com este grupo.\n\n⚠️ *Nota:* Configurações específicas como listas de concorrentes e termos customizados foram preservadas sem alterações.`
        }, { quoted: msg })
        return true
    }

    if (lower.startsWith(cmdConfig)) {
        const allConfigs = configManager.loadGroupConfig()
        const sourceCfg = allConfigs[sourceId]

        if (!sourceCfg) {
            await sock.sendMessage(from, { text: `⚠️ Nenhuma configuração encontrada para o grupo de origem (\`${sourceId}\`).` }, { quoted: msg })
            return true
        }

        if (!allConfigs[from]) allConfigs[from] = {}
        const targetCfg = allConfigs[from]

        const configKeys = [
            'bemVindoAtivo', 'somenteAdmins', 'botDesligado', 'horaAbrir', 'horaFechar'
        ]

        let copiados = 0
        for (const key of configKeys) {
            if (sourceCfg[key] !== undefined && typeof sourceCfg[key] !== 'object') {
                targetCfg[key] = sourceCfg[key]
                copiados++
            }
        }

        configManager.saveGroupConfig(true)

        await sock.sendMessage(from, {
            text: `✅ *CONFIGURAÇÕES CLONADAS COM SUCESSO!*\n\n📌 *Origem:* \`${sourceId}\`\n⚙️ *Status:* ${copiados} configurações e horários aplicados a este grupo.\n\n⚠️ *Nota:* Prazos de expiração e licenças de aluguel individuais do grupo foram preservadas.`
        }, { quoted: msg })
        return true
    }

    return false
}
