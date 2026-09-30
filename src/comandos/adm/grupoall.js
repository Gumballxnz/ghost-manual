const fs = require('fs')
const path = require('path')
const config = require('../../../data/config.json')
const { isOwnerCheck, isSubdonoCheck, isAdmin, getGroupMetadataCached, invalidateGroupCache } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')

async function grupoEstaFechado(sock, gid) {
    try {
        const metadata = await getGroupMetadataCached(sock, gid)
        if (!metadata) return null
        return metadata.announce === true
    } catch {
        return null
    }
}

async function handler(sock, msg, from, sender, text) {
    if (!text || typeof text !== 'string') return false
    const prefix = config.prefix || '.'
    const rawTokens = text.trim().split(/\s+/)
    const rawCmd = (rawTokens[0] || '').toLowerCase()

    if (rawCmd !== prefix + 'grupoall' && rawCmd !== prefix + 'grupall' && rawCmd !== prefix + 'gall') {
        return false
    }

    const isGroup = from.endsWith('@g.us')
    const isOwner = isOwnerCheck(sender, msg) || isSubdonoCheck(sender)

    let isAdm = isOwner
    if (!isAdm && isGroup) {
        try {
            isAdm = await isAdmin(sock, from, sender)
        } catch {}
    }

    if (!isAdm) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ Apenas administradores ou o dono do bot podem usar o comando .grupoall.' }, { quoted: msg })
        return true
    }

    const acaoTexto = text.substring(rawTokens[0].length).trim()

    if (!acaoTexto || acaoTexto === 'ajuda' || acaoTexto === 'help') {
        const menuAjuda = [
            '╭┈❁ *👥 AÇÃO GLOBAL EM TODOS OS GRUPOS (.grupoall)*',
            '┊_Executa ações em todos os grupos autorizados do bot_',
            '┊',
            '┊🔒 *FECHAR TODOS OS GRUPOS:*',
            `┊👉 \`${prefix}grupoall f [motivo opcional]\``,
            `┊👉 \`${prefix}grupoall fechar [motivo]\``,
            '┊',
            '┊🔓 *ABRIR TODOS OS GRUPOS:*',
            `┊👉 \`${prefix}grupoall a [motivo opcional]\``,
            `┊👉 \`${prefix}grupoall abrir [motivo]\``,
            '┊',
            '┊📢 *MARCAR TODOS (COMUNICADO):*',
            `┊👉 \`${prefix}grupoall todos <mensagem>\``,
            '┊',
            '┊🧹 *LIMPAR CHAT:*',
            `┊👉 \`${prefix}grupoall limpar\``,
            '┊',
            '┊💬 *ENVIAR MENSAGEM:*',
            `┊👉 \`${prefix}grupoall msg <texto>\``,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        await sock.sendMessage(from, { text: menuAjuda }, { quoted: msg })
        return true
    }

    try { await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }) } catch {}

    const allGroupConfigs = configManager.loadGroupConfig() || {}
    const todosGrupos = Object.entries(allGroupConfigs)
        .filter(([jid, cfg]) => jid && jid.endsWith('@g.us') && cfg && cfg.authorized !== false)
        .map(([jid]) => jid)

    const outrosGrupos = isGroup ? todosGrupos.filter(gid => gid !== from) : todosGrupos

    if (outrosGrupos.length === 0) {
        try { await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }) } catch {}
        await sock.sendMessage(from, {
            text: isGroup
                ? '⚠️ Não há outros grupos autorizados cadastrados além deste grupo atual.'
                : '⚠️ Nenhum grupo autorizado encontrado.'
        }, { quoted: msg })
        return true
    }

    const acaoLower = acaoTexto.toLowerCase().trim()
    const tokens = acaoTexto.trim().split(/\s+/)
    const primeiroToken = (tokens[0] || '').toLowerCase()

    let tipoAcao = ''
    let motivoOuMsg = ''
    let acaoDescricao = ''

    if (
        primeiroToken === 'f' ||
        primeiroToken === 'fechar' ||
        primeiroToken === 'close' ||
        acaoLower.startsWith('grupo f') ||
        acaoLower.startsWith('grupo fechar')
    ) {
        tipoAcao = 'FECHAR'
        acaoDescricao = '🔒 Fechar Grupos (Apenas Admins)'
        if (acaoLower.startsWith('grupo fechar')) {
            motivoOuMsg = acaoTexto.slice(12).trim()
        } else if (acaoLower.startsWith('grupo f')) {
            motivoOuMsg = acaoTexto.slice(7).trim()
        } else {
            motivoOuMsg = tokens.slice(1).join(' ').trim()
        }
    } else if (
        primeiroToken === 'a' ||
        primeiroToken === 'abrir' ||
        primeiroToken === 'open' ||
        acaoLower.startsWith('grupo a') ||
        acaoLower.startsWith('grupo abrir')
    ) {
        tipoAcao = 'ABRIR'
        acaoDescricao = '🔓 Abrir Grupos (Todos Podem Enviar)'
        if (acaoLower.startsWith('grupo abrir')) {
            motivoOuMsg = acaoTexto.slice(11).trim()
        } else if (acaoLower.startsWith('grupo a')) {
            motivoOuMsg = acaoTexto.slice(7).trim()
        } else {
            motivoOuMsg = tokens.slice(1).join(' ').trim()
        }
    } else if (
        primeiroToken === 'todos' ||
        primeiroToken === 'marcar' ||
        primeiroToken === 'marcar-todos' ||
        primeiroToken === 'hidetag' ||
        primeiroToken === 'tagall'
    ) {
        tipoAcao = 'MARCAR_TODOS'
        acaoDescricao = '📢 Marcar Todos com Comunicado'
        motivoOuMsg = tokens.slice(1).join(' ').trim()
        if (!motivoOuMsg) {
            await sock.sendMessage(from, { text: '❌ Informe a mensagem a ser marcada para todos!\nExemplo: `.grupoall todos Caros clientes, estamos online!`' }, { quoted: msg })
            return true
        }
    } else if (primeiroToken === 'limpar' || primeiroToken === 'limpartudo') {
        tipoAcao = 'LIMPAR'
        acaoDescricao = '🧹 Limpar Chat'
    } else if (primeiroToken === 'msg' || primeiroToken === 'aviso' || primeiroToken === 'mensagem') {
        tipoAcao = 'MENSAGEM'
        acaoDescricao = '💬 Envio de Mensagem/Aviso'
        motivoOuMsg = tokens.slice(1).join(' ').trim()
        if (!motivoOuMsg) {
            await sock.sendMessage(from, { text: '❌ Informe o texto da mensagem!\nExemplo: `.grupoall msg Comunicado importante...`' }, { quoted: msg })
            return true
        }
    } else {
        tipoAcao = 'MENSAGEM'
        acaoDescricao = '💬 Envio de Mensagem Coletiva'
        motivoOuMsg = acaoTexto
    }

    const imagemLimparPath = path.join(__dirname, '../../../assets/limpar.png')

    let sucesso = 0
    let falhas = 0
    let semAdmin = 0

    for (let i = 0; i < outrosGrupos.length; i++) {
        const gid = outrosGrupos[i]
        let ok = false

        try {
            if (tipoAcao === 'FECHAR') {
                const jaFechado = await grupoEstaFechado(sock, gid)
                if (jaFechado !== true) {
                    try {
                        await sock.groupSettingUpdate(gid, 'announcement')
                    } catch (eUpdate) {
                        const errMsg = (eUpdate.message || '').toLowerCase()
                        if (errMsg.includes('forbidden') || eUpdate.data === 403) {
                            semAdmin++
                            throw eUpdate
                        }
                        if (errMsg.includes('rate-overlimit') || eUpdate.data === 429) {
                            await new Promise(r => setTimeout(r, 2500))
                            await sock.groupSettingUpdate(gid, 'announcement')
                        } else {
                            throw eUpdate
                        }
                    }
                    invalidateGroupCache(gid)
                }

                const textoFechado = motivoOuMsg
                    ? `🔒 *GRUPO FECHADO!*\n📌 *Motivo:* ${motivoOuMsg}\n\nAgora apenas administradores podem enviar mensagens.`
                    : '🔒 *Grupo fechado!*\n\nAgora apenas administradores podem enviar mensagens.'

                await sock.sendMessage(gid, { text: textoFechado }).catch(() => {})
                ok = true
            } else if (tipoAcao === 'ABRIR') {
                const jaAberto = await grupoEstaFechado(sock, gid)
                if (jaAberto === true) {
                    try {
                        await sock.groupSettingUpdate(gid, 'not_announcement')
                    } catch (eUpdate) {
                        const errMsg = (eUpdate.message || '').toLowerCase()
                        if (errMsg.includes('forbidden') || eUpdate.data === 403) {
                            semAdmin++
                            throw eUpdate
                        }
                        if (errMsg.includes('rate-overlimit') || eUpdate.data === 429) {
                            await new Promise(r => setTimeout(r, 2500))
                            await sock.groupSettingUpdate(gid, 'not_announcement')
                        } else {
                            throw eUpdate
                        }
                    }
                    invalidateGroupCache(gid)
                }

                const textoAberto = motivoOuMsg
                    ? `🔓 *GRUPO ABERTO!*\n📌 *Motivo:* ${motivoOuMsg}\n\nAgora todos podem enviar mensagens.`
                    : '🔓 *Grupo aberto!*\n\nAgora todos podem enviar mensagens.'

                await sock.sendMessage(gid, { text: textoAberto }).catch(() => {})
                ok = true
            } else if (tipoAcao === 'MARCAR_TODOS') {
                const metadata = await getGroupMetadataCached(sock, gid)
                const participantes = metadata?.participants?.map(p => p.id) || []
                await sock.sendMessage(gid, {
                    text: motivoOuMsg,
                    mentions: participantes
                })
                ok = true
            } else if (tipoAcao === 'LIMPAR') {
                if (fs.existsSync(imagemLimparPath)) {
                    await sock.sendMessage(gid, {
                        image: fs.readFileSync(imagemLimparPath),
                        caption: '🧹 *CHAT LIMPO PELA ADMINISTRAÇÃO*'
                    })
                } else {
                    await sock.sendMessage(gid, { text: '🧹 *CHAT LIMPO PELA ADMINISTRAÇÃO*' })
                }
                ok = true
            } else if (tipoAcao === 'MENSAGEM') {
                await sock.sendMessage(gid, { text: motivoOuMsg })
                ok = true
            }

            if (ok) sucesso++
        } catch (errAction) {
            falhas++
            console.error(`[GRUPOALL] Falha ao executar ${tipoAcao} no grupo ${gid}:`, errAction.message)
        }

        if (i < outrosGrupos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500))
        }
    }

    try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}

    const linhasResumo = [
        '👥 *RESUMO DA AÇÃO GLOBAL (.grupoall)*',
        '────────────────────────',
        `🎯 *Ação:* ${acaoDescricao}`,
        `📊 *Grupos Alvo:* ${outrosGrupos.length} _(exceto este grupo)_`,
        `✅ *Executados com Sucesso:* ${sucesso}`,
        `❌ *Falhas:* ${falhas}`
    ]

    if (semAdmin > 0) {
        linhasResumo.push(`⚠️ _${semAdmin} grupo(s) falharam porque o bot não é administrador neles._`)
    }
    linhasResumo.push('────────────────────────')
    if (falhas === 0) {
        linhasResumo.push('⚡ _Ação executada com sucesso em todos os grupos!_')
    }

    await sock.sendMessage(from, { text: linhasResumo.join('\n') }, { quoted: msg })
    return true
}

module.exports = handler
