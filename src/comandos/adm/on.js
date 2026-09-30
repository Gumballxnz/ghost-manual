const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isLeaderCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')
const { botStatusStore } = require('../../utils/firebaseDataLayer')

module.exports = async (sock, msg, from, sender, text) => {
    const prefix = config.prefix || '.'
    const cleanText = (text || '').trim()
    const lower = cleanText.toLowerCase()

    const isOnAll = lower === (prefix + 'onall') || lower.startsWith(prefix + 'onall ') || lower.startsWith(prefix + 'onall\t')
    const isOn = lower === (prefix + 'on') || lower.startsWith(prefix + 'on ') || lower.startsWith(prefix + 'on\t')

    if (isOnAll || isOn) {

        if (!isLeaderCheck(sender, msg)) {
            await sock.sendMessage(from, {
                text: [
                    '╭┈⊰ 👻 『 *ACESSO NEGADO* 』',
                    '┊❌ Permissão Insuficiente',
                    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
                    '',
                    'Apenas o líder supremo / dono principal do bot tem permissão para ativar o bot.'
                ].join('\n')
            }, { quoted: msg })
            return true
        }

        const isGroup = from.endsWith('@g.us')
        const args = cleanText.split(/\s+/).slice(1)
        const subComando = (args[0] || '').toLowerCase()

        if (isOnAll || subComando === 'todos' || subComando === 'all' || subComando === 'global') {
            try {
                botStatusStore.save({ ativo: true }, true)
                await sock.sendMessage(from, {
                    text: [
                        '╭┈⊰ 👻 『 *STATUS DO SISTEMA* 』',
                        '┊🤖 GHOST BOT',
                        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
                        '',
                        '╭┈❁ *🟢 BOT REATIVADO GLOBALMENTE*',
                        '┊•.̇𖥨֗👻⭟ O bot voltou a operar normalmente em todos os grupos.',
                        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
                    ].join('\n')
                }, { quoted: msg })
            } catch (err) {
                console.error('[ONALL] Erro ao reativar bot:', err.message)
            }
            return true
        }

        let targetJid = from

        if (subComando && /^\d+$/.test(subComando)) {
            const index = parseInt(subComando)
            const aluguel = require('./aluguel')
            const obterMapaGrupos = aluguel.obterMapaGrupos || (() => {
                const groups = configManager.loadGroupConfig()
                return Object.entries(groups)
                    .filter(([id, cfg]) => cfg.authorized)
                    .map(([id]) => id)
                    .sort((a, b) => a[0].localeCompare(b[0]))
            })
            const jids = obterMapaGrupos()
            if (index < 1 || index > jids.length) {
                await sock.sendMessage(from, { text: `❌ Índice inválido! Use um número de 1 a ${jids.length}.` }, { quoted: msg })
                return true
            }
            targetJid = jids[index - 1]
        } else {
            if (!isGroup) {
                await sock.sendMessage(from, {
                    text: [
                        '╭┈⊰ 👻 『 *AJUDA DE COMANDO* 』',
                        '┊⚙️ Ativação do Bot',
                        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
                        '',
                        `• \`${prefix}onall\` • Reativar bot globalmente`,
                        `• \`${prefix}on <número>\` • Reativar grupo por índice`,
                        `• \`${prefix}on\` • Reativar grupo atual`
                    ].join('\n')
                }, { quoted: msg })
                return true
            }
        }

        const groups = configManager.loadGroupConfig()
        const cfg = groups[targetJid]

        if (!cfg || !cfg.botDesligado) {
            await sock.sendMessage(from, {
                text: [
                    '╭┈⊰ 👻 『 *AVISO* 』',
                    '┊🤖 GHOST BOT',
                    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
                    '',
                    'Este grupo já está ativo.',
                    `_Para reativar o bot globalmente, use:_ \`${prefix}onall\``
                ].join('\n')
            }, { quoted: msg })
            return true
        }

        delete groups[targetJid].botDesligado
        delete groups[targetJid].offPor
        delete groups[targetJid].offExpiraEm

        configManager.saveGroupConfig(true)

        try {
            await sock.sendMessage(targetJid, {
                text: [
                    '╭┈⊰ 👻 『 *STATUS DO GRUPO* 』',
                    '┊🤖 GHOST BOT',
                    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯',
                    '',
                    '╭┈❁ *🟢 BOT REATIVADO*',
                    '┊•.̇𖥨֗👻⭟ O bot voltou a operar normalmente neste grupo.',
                    '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
                ].join('\n')
            })
        } catch (e) {
            console.error('Erro ao enviar aviso de on no grupo:', e.message)
        }

        if (targetJid !== from) {
            await sock.sendMessage(from, {
                text: `✅ Grupo ${targetJid.split('@')[0]} reativado com sucesso.`
            }, { quoted: msg })
        }

        return true
    }
    return false
}
