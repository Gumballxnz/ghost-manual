const config = require('../../../data/config.json')
const { isAdmin, isOwnerCheck } = require('../../utils/baileys')
const { contasStore } = require('../../utils/firebaseDataLayer')
const {
    salvarTabelaMegasGrupo,
    salvarTabelaDiariosGrupo,
    salvarTabelaSemanalGrupo,
    salvarTabelaMensalGrupo,
    salvarTabelaDiamanteGrupo,
    salvarTabelaSaldoGrupo,
    obterTabelaMegasGrupo,
    obterTabelaDiariosGrupo,
    obterTabelaSemanalGrupo,
    obterTabelaMensalGrupo,
    obterTabelaDiamanteGrupo,
    obterTabelaSaldoGrupo,
    calcularMegasPorTexto
} = require('../../vendas/tabela')

function loadContas() {
    return contasStore.loadSync() || {}
}

function saveContas(data) {
    contasStore.save(data)
}

module.exports = async (sock, msg, from, sender, text) => {
    const rawBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || text || ''
    const { getPrefixForChat } = require('../../utils/configManager')
    const prefix = getPrefixForChat ? getPrefixForChat(from) : config.prefix
    const userName = msg.pushName || 'Administrador'

    const lowerBody = (rawBody || '').trim().toLowerCase()



    if (!lowerBody.startsWith(prefix + 'configurar') && !text.startsWith(prefix + 'configurar')) return false

    const isGroup = from.endsWith('@g.us')
    const isOwner = isOwnerCheck(sender, msg)
    let adminStatus = false
    if (isGroup) {
        try {
            adminStatus = await isAdmin(sock, from, sender)
        } catch (e) {
            console.error('[CONFIGURAR] Erro ao verificar admin:', e.message)
        }
    }

    if (!isOwner && !adminStatus) {
        await sock.sendMessage(from, {
            text: '❌ *Sem permissão!*\n\nApenas administradores e donos podem configurar o bot neste grupo.'
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        return true
    }

    const cleanBody = rawBody.substring((prefix + 'configurar').length).trim()

    if (!cleanBody || cleanBody.toLowerCase() === 'ajuda' || cleanBody.toLowerCase() === 'help') {
        const header = [
            '╭┈⊰ 👻 『 *PAINEL DE CONFIGURAÇÃO* 』',
            `┊Olá, ${userName}!`,
            '┊_Configurações e tabelas exclusivas deste grupo_',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco1 = [
            '╭┈❁ *📊 1. TABELAS DE MEGAS*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}configurar tabela/[texto da tabela]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar diarios/[texto]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar semanal/[texto]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar mensal/[texto]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar diamante/[texto]`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco2 = [
            '╭┈❁ *💰 2. TABELA DE SALDO (CRÉDITO)*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}configurar saldo/[texto da tabela]`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco3 = [
            '╭┈❁ *👀 3. VISUALIZAR TABELAS ATUAIS*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}configurar ver tabela`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar ver diarios`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar ver semanal`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar ver mensal`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar ver diamante`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar ver saldo`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco4 = [
            '╭┈❁ *🗑️ 4. REMOVER TABELAS*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover tabela`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover diarios`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover semanal`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover mensal`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover diamante`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover saldo`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const bloco5 = [
            '╭┈❁ *💳 5. CONTAS DE PAGAMENTO*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}configurar E-mola [número] [nome]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar M-Pesa [número] [nome]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar listar`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover E-mola [número]`,
            `┊•.̇𖥨֗👻⭟${prefix}configurar remover M-Pesa [número]`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const footer = [
            '╭┈⊰ 🔒 *ISOLAMENTO TOTAL*',
            '┊As configurações aqui aplicam-se apenas a este grupo.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        const ajuda = [header, '', bloco1, '', bloco2, '', bloco3, '', bloco4, '', bloco5, '', footer].join('\n')

        await sock.sendMessage(from, { text: ajuda }, { quoted: msg })
        return true
    }

    if (/^tabela(?:\/|\s+)/i.test(cleanBody)) {
        let textoTabela = ''
        if (cleanBody.startsWith('tabela/')) {
            textoTabela = cleanBody.substring('tabela/'.length).trim()
        } else if (cleanBody.toLowerCase().startsWith('tabela')) {
            textoTabela = cleanBody.substring('tabela'.length).trim()
        }

        if (!textoTabela) {
            await sock.sendMessage(from, {
                text: [
                    'ℹ️ *COMO CONFIGURAR A TABELA GERAL / UNIFICADA:*',
                    '────────────────────────',
                    `👉 Envie: \`${prefix}configurar tabela/[texto da tabela]\``,
                    '',
                    '*Exemplo:*',
                    `${prefix}configurar tabela/`,
                    '💠 512MB ➜ 11MT',
                    '💠 1GB ➜ 21MT',
                    '💠 2GB ➜ 42MT',
                    '💠 5GB ➜ 105MT'
                ].join('\n')
            }, { quoted: msg })
            return true
        }

        salvarTabelaMegasGrupo(from, textoTabela)

        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Tabela Geral configurada com sucesso!*',
                '┊•.̇𖥨֗📊⭟ O bot lerá dinamicamente os valores e seções.',
                `┊•.̇𖥨֗👀⭟ Digite *${prefix}tabela* para visualizar.`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    if (/^di[aá]rios?(?:\/|\s+)/i.test(cleanBody)) {
        let textoDiario = cleanBody.replace(/^di[aá]rios?(?:\/|\s+)/i, '').trim()

        if (!textoDiario) {
            await sock.sendMessage(from, {
                text: `ℹ️ Envie: \`${prefix}configurar diarios/[texto da tabela diaria]\`\n\n*Exemplo:*\n${prefix}configurar diarios/\n1024MB = 20MT\n2048MB = 40MT\n3072MB = 60MT`
            }, { quoted: msg })
            return true
        }

        salvarTabelaDiariosGrupo(from, textoDiario)
        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Tabela Diária (24h) configurada com sucesso!*',
                `┊•.̇𖥨֗👀⭟ Digite *${prefix}diarios* para visualizar.`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    if (/^semanal(?:\/|\s+)/i.test(cleanBody)) {
        let textoSemanal = ''
        if (cleanBody.startsWith('semanal/')) {
            textoSemanal = cleanBody.substring('semanal/'.length).trim()
        } else if (cleanBody.toLowerCase().startsWith('semanal')) {
            textoSemanal = cleanBody.substring('semanal'.length).trim()
        }

        if (!textoSemanal) {
            await sock.sendMessage(from, {
                text: `ℹ️ Envie: \`${prefix}configurar semanal/[texto da tabela semanal]\`\n\n*Exemplo:*\n${prefix}configurar semanal/\n857MB ➜ 30MT\n1.7GB ➜ 45MT\n3.4GB ➜ 95MT\n7.2GB ➜ 190MT`
            }, { quoted: msg })
            return true
        }

        salvarTabelaSemanalGrupo(from, textoSemanal)
        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Tabela Semanal (7d) configurada com sucesso!*',
                `┊•.̇𖥨֗👀⭟ Digite *${prefix}semanal* para visualizar.`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    if (/^mensal(?:\/|\s+)/i.test(cleanBody)) {
        let textoMensal = ''
        if (cleanBody.startsWith('mensal/')) {
            textoMensal = cleanBody.substring('mensal/'.length).trim()
        } else if (cleanBody.toLowerCase().startsWith('mensal')) {
            textoMensal = cleanBody.substring('mensal'.length).trim()
        }

        if (!textoMensal) {
            await sock.sendMessage(from, {
                text: `ℹ️ Envie: \`${prefix}configurar mensal/[texto da tabela mensal]\`\n\n*Exemplo:*\n${prefix}configurar mensal/\n2.8GB ➜ 95MT\n7GB ➜ 190MT\n10GB ➜ 290MT\n18GB ➜ 470MT`
            }, { quoted: msg })
            return true
        }

        salvarTabelaMensalGrupo(from, textoMensal)
        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Tabela Mensal (30d) configurada com sucesso!*',
                `┊•.̇𖥨֗👀⭟ Digite *${prefix}mensal* para visualizar.`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    if (/^(diamante|tudotop|tudo top)(?:\/|\s+)/i.test(cleanBody)) {
        let textoDiamante = cleanBody.replace(/^(diamante|tudotop|tudo top)(?:\/|\s+)/i, '').trim()

        if (!textoDiamante) {
            await sock.sendMessage(from, {
                text: `ℹ️ Envie: \`${prefix}configurar diamante/[texto da tabela diamante]\`\n\n*Exemplo:*\n${prefix}configurar diamante/\n450 MT ➜ 11GB + Chamadas ilimitadas + SMS ilimitadas\n900 MT ➜ 22GB + Chamadas ilimitadas + SMS ilimitadas`
            }, { quoted: msg })
            return true
        }

        salvarTabelaDiamanteGrupo(from, textoDiamante)
        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Tabela Diamante / Tudo Top configurada!*',
                `┊•.̇𖥨֗👀⭟ Digite *${prefix}diamante* para visualizar.`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    if (/^saldo(?:\/|\s+)/i.test(cleanBody)) {
        let textoSaldo = ''
        if (cleanBody.startsWith('saldo/')) {
            textoSaldo = cleanBody.substring('saldo/'.length).trim()
        } else if (cleanBody.toLowerCase().startsWith('saldo')) {
            textoSaldo = cleanBody.substring('saldo'.length).trim()
        }

        if (!textoSaldo) {
            await sock.sendMessage(from, {
                text: [
                    'ℹ️ *COMO CONFIGURAR A TABELA DE SALDO:*',
                    '────────────────────────',
                    `👉 Envie: \`${prefix}configurar saldo/[texto da tabela de saldo]\``,
                    '',
                    '*Exemplo:*',
                    `${prefix}configurar saldo/`,
                    '💠 50 MT ➜ 50 MT Saldo',
                    '💠 100 MT ➜ 110 MT Saldo',
                    '💠 500 MT ➜ 550 MT Saldo'
                ].join('\n')
            }, { quoted: msg })
            return true
        }

        salvarTabelaSaldoGrupo(from, textoSaldo)

        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 👻 『 *CONFIGURAÇÃO ATUALIZADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *Tabela de Saldo (Crédito) configurada!*',
                '┊•.̇𖥨֗💰⭟ A tabela de saldo e crédito deste grupo foi atualizada.',
                `┊•.̇𖥨֗👀⭟ Digite *${prefix}tabelasaldo* para visualizar.`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    if (cleanBody.toLowerCase() === 'ver tabela' || cleanBody.toLowerCase() === 'vertabela') {
        const tab = obterTabelaMegasGrupo(from)
        if (!tab) {
            await sock.sendMessage(from, {
                text: `ℹ️ Nenhuma tabela de megas customizada para este grupo. O bot está usando a tabela padrão.\n\nUse \`${prefix}configurar tabela/[texto]\` para personalizar.`
            }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, {
            text: `📊 *TABELA DE MEGAS DESTE GRUPO:*\n────────────────────────\n${tab}`
        }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'ver diarios' || cleanBody.toLowerCase() === 'verdiarios' || cleanBody.toLowerCase() === 'ver diario') {
        const tab = obterTabelaDiariosGrupo(from)
        if (!tab) {
            await sock.sendMessage(from, { text: `ℹ️ Nenhuma tabela diária customizada. Use \`${prefix}configurar diarios/[texto]\` para cadastrar.` }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, { text: `📱 *TABELA DIÁRIA (24h):*\n────────────────────────\n${tab}` }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'ver semanal' || cleanBody.toLowerCase() === 'versemanal') {
        const tab = obterTabelaSemanalGrupo(from)
        if (!tab) {
            await sock.sendMessage(from, { text: `ℹ️ Nenhuma tabela semanal customizada. Use \`${prefix}configurar semanal/[texto]\` para cadastrar.` }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, { text: `📦 *TABELA SEMANAL (7d):*\n────────────────────────\n${tab}` }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'ver mensal' || cleanBody.toLowerCase() === 'vermensal') {
        const tab = obterTabelaMensalGrupo(from)
        if (!tab) {
            await sock.sendMessage(from, { text: `ℹ️ Nenhuma tabela mensal customizada. Use \`${prefix}configurar mensal/[texto]\` para cadastrar.` }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, { text: `📦 *TABELA MENSAL (30d):*\n────────────────────────\n${tab}` }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'ver diamante' || cleanBody.toLowerCase() === 'verdiamante' || cleanBody.toLowerCase() === 'ver tudotop') {
        const tab = obterTabelaDiamanteGrupo(from)
        if (!tab) {
            await sock.sendMessage(from, { text: `ℹ️ Nenhuma tabela diamante customizada. Use \`${prefix}configurar diamante/[texto]\` para cadastrar.` }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, { text: `👑 *TABELA DIAMANTE / TUDO TOP (30d):*\n────────────────────────\n${tab}` }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'ver saldo' || cleanBody.toLowerCase() === 'versaldo') {
        const tab = obterTabelaSaldoGrupo(from)
        if (!tab) {
            await sock.sendMessage(from, {
                text: `ℹ️ Nenhuma tabela de saldo customizada para este grupo.\n\nUse \`${prefix}configurar saldo/[texto]\` para definir a tabela de saldo.`
            }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, {
            text: `💰 *TABELA DE SALDO DESTE GRUPO:*\n────────────────────────\n${tab}`
        }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'remover tabela' || cleanBody.toLowerCase() === 'removertabela') {
        salvarTabelaMegasGrupo(from, '')
        await sock.sendMessage(from, {
            text: '🗑️ *Tabela de megas customizada removida!* O grupo voltou a usar a tabela padrão.'
        }, { quoted: msg })
        return true
    }
    if (cleanBody.toLowerCase() === 'remover diarios' || cleanBody.toLowerCase() === 'removerdiarios' || cleanBody.toLowerCase() === 'remover diario') {
        salvarTabelaDiariosGrupo(from, '')
        await sock.sendMessage(from, { text: '🗑️ *Tabela diária removida!*' }, { quoted: msg })
        return true
    }
    if (cleanBody.toLowerCase() === 'remover semanal' || cleanBody.toLowerCase() === 'recoversemanal') {
        salvarTabelaSemanalGrupo(from, '')
        await sock.sendMessage(from, { text: '🗑️ *Tabela semanal removida!*' }, { quoted: msg })
        return true
    }
    if (cleanBody.toLowerCase() === 'remover mensal' || cleanBody.toLowerCase() === 'removermensal') {
        salvarTabelaMensalGrupo(from, '')
        await sock.sendMessage(from, { text: '🗑️ *Tabela mensal removida!*' }, { quoted: msg })
        return true
    }
    if (cleanBody.toLowerCase() === 'remover diamante' || cleanBody.toLowerCase() === 'removerdiamante') {
        salvarTabelaDiamanteGrupo(from, '')
        await sock.sendMessage(from, { text: '🗑️ *Tabela diamante removida!*' }, { quoted: msg })
        return true
    }

    if (cleanBody.toLowerCase() === 'listar') {
        const contas = loadContas()
        const grupoContas = contas[from] || { emola: [], mpesa: [] }

        let lista = `📋 *CONTAS CONFIGURADAS NESTE GRUPO*\n────────────────────────\n\n`
        lista += `💠 *E-MOLA:*\n`
        if (grupoContas.emola && grupoContas.emola.length > 0) {
            grupoContas.emola.forEach((c, i) => {
                lista += `  ${i + 1}. ${c.numero} - ${c.nome}\n`
            })
        } else {
            lista += `  _Nenhuma conta configurada_\n`
        }

        lista += `\n📲 *M-PESA:*\n`
        if (grupoContas.mpesa && grupoContas.mpesa.length > 0) {
            grupoContas.mpesa.forEach((c, i) => {
                lista += `  ${i + 1}. ${c.numero} - ${c.nome}\n`
            })
        } else {
            lista += `  _Nenhuma conta configurada_\n`
        }

        await sock.sendMessage(from, { text: lista.trim() }, { quoted: msg })
        return true
    }

    const emolaMatch = cleanBody.match(/^e-?mola\s+(\d+)\s+(.+)/i)
    if (emolaMatch) {
        const numero = emolaMatch[1]
        const nome = emolaMatch[2].trim()

        const contas = loadContas()
        if (!contas[from]) contas[from] = { emola: [], mpesa: [] }
        if (!contas[from].emola) contas[from].emola = []

        const existe = contas[from].emola.find(c => c.numero === numero)
        if (existe) {
            await sock.sendMessage(from, { text: '⚠️ Esta conta E-mola já está configurada neste grupo!' }, { quoted: msg })
            return true
        }

        contas[from].emola.push({ numero, nome, addedAt: new Date().toISOString() })
        saveContas(contas)

        try {
            const configMgr = require('../../utils/configManager')
            const groupConfig = configMgr.loadGroupConfig()
            if (!groupConfig[from]) groupConfig[from] = {}
            if (groupConfig[from].authorized === undefined) {
                groupConfig[from].authorized = true
                configMgr.saveGroupConfig(groupConfig)
            }
        } catch {}

        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 💳 『 *CONTA CONFIGURADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *E-Mola salvo com sucesso!*',
                `┊•.̇𖥨֗📱⭟ *Número:* ${numero}`,
                `┊•.̇𖥨֗👤⭟ *Titular:* ${nome}`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    const mpesaMatch = cleanBody.match(/^m-?pesa\s+(\d+)\s+(.+)/i)
    if (mpesaMatch) {
        const numero = mpesaMatch[1]
        const nome = mpesaMatch[2].trim()

        const contas = loadContas()
        if (!contas[from]) contas[from] = { emola: [], mpesa: [] }
        if (!contas[from].mpesa) contas[from].mpesa = []

        const existe = contas[from].mpesa.find(c => c.numero === numero)
        if (existe) {
            await sock.sendMessage(from, { text: '⚠️ Esta conta M-Pesa já está configurada neste grupo!' }, { quoted: msg })
            return true
        }

        contas[from].mpesa.push({ numero, nome, addedAt: new Date().toISOString() })
        saveContas(contas)

        try {
            const configMgr = require('../../utils/configManager')
            const groupConfig = configMgr.loadGroupConfig()
            if (!groupConfig[from]) groupConfig[from] = {}
            if (groupConfig[from].authorized === undefined) {
                groupConfig[from].authorized = true
                configMgr.saveGroupConfig(groupConfig)
            }
        } catch {}

        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 💳 『 *CONTA CONFIGURADA* 』',
                '┊',
                '┊•.̇𖥨֗✅⭟ *M-Pesa salvo com sucesso!*',
                `┊•.̇𖥨֗📱⭟ *Número:* ${numero}`,
                `┊•.̇𖥨֗👤⭟ *Titular:* ${nome}`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    const removerEmolaMatch = cleanBody.match(/^remover\s+e-?mola\s+(\d+)/i)
    if (removerEmolaMatch) {
        const numero = removerEmolaMatch[1]
        const contas = loadContas()
        if (!contas[from] || !contas[from].emola) {
            await sock.sendMessage(from, { text: '❌ Nenhuma conta E-mola configurada.' }, { quoted: msg })
            return true
        }

        const index = contas[from].emola.findIndex(c => c.numero === numero)
        if (index === -1) {
            await sock.sendMessage(from, { text: `❌ Conta E-mola *${numero}* não encontrada.` }, { quoted: msg })
            return true
        }

        const removida = contas[from].emola.splice(index, 1)[0]
        saveContas(contas)

        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 🗑️ 『 *CONTA REMOVIDA* 』',
                '┊',
                '┊•.̇𖥨֗🗑️⭟ *E-Mola desvinculado com sucesso!*',
                `┊•.̇𖥨֗📱⭟ *Número:* ${removida.numero}`,
                `┊•.̇𖥨֗👤⭟ *Titular:* ${removida.nome}`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    const removerMpesaMatch = cleanBody.match(/^remover\s+m-?pesa\s+(\d+)/i)
    if (removerMpesaMatch) {
        const numero = removerMpesaMatch[1]
        const contas = loadContas()
        if (!contas[from] || !contas[from].mpesa) {
            await sock.sendMessage(from, { text: '❌ Nenhuma conta M-Pesa configurada.' }, { quoted: msg })
            return true
        }

        const index = contas[from].mpesa.findIndex(c => c.numero === numero)
        if (index === -1) {
            await sock.sendMessage(from, { text: `❌ Conta M-Pesa *${numero}* não encontrada.` }, { quoted: msg })
            return true
        }

        const removida = contas[from].mpesa.splice(index, 1)[0]
        saveContas(contas)

        await sock.sendMessage(from, {
            text: [
                '╭┈⊰ 🗑️ 『 *CONTA REMOVIDA* 』',
                '┊',
                '┊•.̇𖥨֗🗑️⭟ *M-Pesa desvinculado com sucesso!*',
                `┊•.̇𖥨֗📱⭟ *Número:* ${removida.numero}`,
                `┊•.̇𖥨֗👤⭟ *Titular:* ${removida.nome}`,
                '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
            ].join('\n')
        }, { quoted: msg })
        try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
        return true
    }

    await sock.sendMessage(from, {
        text: `❌ Opção não reconhecida.\n\nUse \`${prefix}configurar\` para ver todas as opções disponíveis.`
    }, { quoted: msg })
    return true
}
