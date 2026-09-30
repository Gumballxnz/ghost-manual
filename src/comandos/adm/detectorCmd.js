const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys.js')
const configManager = require('../../utils/configManager')

const handler = async (sock, msg, from, sender, text) => {
    const rawCmd = (text || '').trim().toLowerCase().split(/\s+/)[0]
    if (rawCmd !== config.prefix + 'detector') return false

    const isGroup = from.endsWith('@g.us')
    const reply = (texto) => sock.sendMessage(from, { text: texto }, { quoted: msg })

    if (!isGroup) {
        await reply('❌ Este comando só pode ser utilizado dentro de grupos!')
        return true
    }

    const isOwner = isOwnerCheck(sender, msg)
    let isAdmin = false
    try {
        if (!isOwner) isAdmin = await checkIsAdmin(sock, from, sender)
    } catch { }

    if (!isAdmin && !isOwner) {
        await reply('❌ Apenas administradores do grupo podem configurar o detector de comprovativos!')
        return true
    }

    const groupConfig = configManager.loadGroupConfig()
    if (!groupConfig[from]) groupConfig[from] = {}

    const args = text.trim().split(/\s+/)
    const action = args[1]?.toLowerCase()

    if (!action) {
        const estaAtivo = groupConfig[from].detector !== false
        const statusIcon = estaAtivo ? '🟢 ATIVADO' : '🔴 DESATIVADO'
        const desc = estaAtivo
            ? 'O bot está lendo comprovativos automaticamente (Imagem, PDF e Texto).'
            : 'A leitura automática de comprovativos está PAUSADA neste grupo. O restante das funções do bot funciona normalmente.'

        const msgStatus = [
            '🔍 *DETECTOR DE COMPROVATIVOS*',
            '────────────────────────',
            `📊 *Status Atual:* ${statusIcon}`,
            '',
            `ℹ️ ${desc}`,
            '',
            '⚙️ *Como alterar:*',
            `• \`${config.prefix}detector on\` _(Ativa leitura automática)_`,
            `• \`${config.prefix}detector off\` _(Desativa leitura automática)_`
        ].join('\n')

        await reply(msgStatus)
        return true
    }

    if (action === 'on' || action === 'ativar' || action === '1' || action === 'true') {
        groupConfig[from].detector = true
        configManager.saveGroupConfig(true)

        await reply([
            '✅ *DETECTOR DE COMPROVATIVOS ATIVADO!*',
            '────────────────────────',
            '🟢 O bot voltou a ler e validar comprovativos automaticamente neste grupo (Imagens, PDFs e Mensagens de Texto).',
            '⚡ As vendas automáticas estão operando normalmente!'
        ].join('\n'))
        return true
    }

    if (action === 'off' || action === 'desativar' || action === '0' || action === 'false') {
        groupConfig[from].detector = false
        configManager.saveGroupConfig(true)

        await reply([
            '🛑 *DETECTOR DE COMPROVATIVOS DESATIVADO!*',
            '────────────────────────',
            '🔴 O bot parou de ler e reagir a comprovativos neste grupo.',
            'ℹ️ Todos os demais comandos e recursos continuam funcionando normalmente.',
            `💡 _Para reativar a qualquer momento, envie:_ \`${config.prefix}detector on\``
        ].join('\n'))
        return true
    }

    await reply(`⚠️ Parâmetro inválido! Use:\n• \`${config.prefix}detector on\`\n• \`${config.prefix}detector off\``)
    return true
}

handler.nome = 'detector'
handler.aliases = []
handler.categoria = 'adm'
handler.subcategoria = 'AUTOMAÇÃO & SISTEMA'
handler.descricao = 'Pausa ou ativa a leitura e validação automática de comprovantes no grupo'
handler.uso = `${config.prefix}detector [on/off]`

module.exports = handler
