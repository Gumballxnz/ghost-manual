const fs = require('fs')
const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isOwnerCheck } = require('../../utils/baileys')

const configManager = require('../../utils/configManager')
const { addNanosCommand, listNanosCommands, getNanosCommand } = require('../../bot/nano')

function loadGroupConfig() {
    return configManager.loadGroupConfig()
}

function saveGroupConfig() {

    configManager.saveGroupConfig(true)
}

const NANOS_PADRAO = {
    'peço megas': 'Pode mandar, megas nunca acabam ✅',
    'peco megas': 'Pode mandar, megas nunca acabam ✅',
    'quero megas': '✅ Pode mandar! Megas disponíveis 24h 🚀',
    'preciso de megas': 'Disponível! Pode mandar o valor ✅',
    'como comprar': '📞 *ATENDIMENTO AUTOMÁTICO*\n\nPara comprar megas, digite *Tabela* para ver nossos preços!\n\nEm seguida, envie o valor via *M-Pesa* e mande o comprovativo aqui mesmo no grupo.\nO Bot entregará automaticamente! 🚀',
    'como compro': '📞 *ATENDIMENTO AUTOMÁTICO*\n\nPara comprar megas, digite *Tabela* para ver nossos preços!\n\nEm seguida, envie o valor via *M-Pesa* e mande o comprovativo aqui mesmo no grupo.\nO Bot entregará automaticamente! 🚀',
    'pra que serve esse grupo': '👋 *Olá! Bem-vindo(a) ao Megas Vodacom!*\n\nEsse é um grupo de venda automática de dados móveis (Megas). 🌐\n\n📌 *Como usar:*\n👉 Digite *Tabela* para ver os preços.\n👉 Digite *Pagamento* para ver como comprar.\n\nÉ só mandar o valor exato pelo M-Pesa que o bot entrega na hora! ⚡',
    'para que serve esse grupo': '👋 *Olá! Bem-vindo(a) ao Megas Vodacom!*\n\nEsse é um grupo de venda automática de dados móveis (Megas). 🌐\n\n📌 *Como usar:*\n👉 Digite *Tabela* para ver os preços.\n👉 Digite *Pagamento* para ver como comprar.\n\nÉ só mandar o valor exato pelo M-Pesa que o bot entrega na hora! ⚡'
}

function copiarNanosPadrao(groupId) {
    const existentes = listNanosCommands(groupId)
    if (existentes.length > 0) return 0

    let count = 0
    for (const [chave, resposta] of Object.entries(NANOS_PADRAO)) {
        addNanosCommand(groupId, chave, resposta)
        count++
    }
    console.log(`[ALUGUEL] ${count} nanos padrão copiados para ${groupId}`)
    return count
}

function getDataMocambique() {
    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (offset * 60000))
}

function parseTempo(str) {

    const match = str.match(/^(\d+)\s*(s|seg|segundo|segundos|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)?$/i)
    if (!match) return null

    const valor = parseInt(match[1])
    const unidade = (match[2] || 'd').toLowerCase()

    const MS_POR_SEGUNDO = 1000
    const MS_POR_MINUTO = 60 * MS_POR_SEGUNDO
    const MS_POR_HORA = 60 * MS_POR_MINUTO
    const MS_POR_DIA = 24 * MS_POR_HORA

    switch (unidade) {
        case 's':
        case 'seg':
        case 'segundo':
        case 'segundos':
            return valor * MS_POR_SEGUNDO
        case 'min':
        case 'minuto':
        case 'minutos':
            return valor * MS_POR_MINUTO
        case 'h':
        case 'hora':
        case 'horas':
            return valor * MS_POR_HORA
        case 'd':
        case 'dia':
        case 'dias':
            return valor * MS_POR_DIA
        case 'mes':
        case 'meses':
            return valor * 30 * MS_POR_DIA
        case 'a':
        case 'ano':
        case 'anos':
            return valor * 365 * MS_POR_DIA
        default:
            return valor * MS_POR_DIA
    }
}

function formatarTempoRestante(ms) {
    if (ms <= 0) return 'Expirado'

    const dias = Math.floor(ms / (24 * 60 * 60 * 1000))
    const horas = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutos = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    const segundos = Math.floor((ms % (60 * 1000)) / 1000)

    if (dias > 0) {
        return `${dias} dia(s) e ${horas}h`
    }
    if (horas > 0) {
        return `${horas}h e ${minutos}min`
    }
    if (minutos > 0) {
        return `${minutos}min e ${segundos}s`
    }
    return `${segundos} segundo(s)`
}

function verificarGrupoAtivo(groupConfig) {
    if (!groupConfig?.authorized) return false
    if (!groupConfig?.expiraEm) return true

    const agora = getDataMocambique().getTime()
    return agora < groupConfig.expiraEm
}

function obterMapaGrupos() {
    if (global.mapaGrupos && global.mapaGrupos.length > 0) {
        return global.mapaGrupos
    }
    const groups = loadGroupConfig()
    const jids = Object.entries(groups)
        .filter(([id, cfg]) => {
            if (!cfg || !cfg.authorized) return false
            if (global.primaryGroups && global.primaryGroups.size > 0) {
                return global.primaryGroups.has(id)
            }
            return true
        })
        .map(([id]) => id)
        .sort((a, b) => a[0].localeCompare(b[0]))
    global.mapaGrupos = jids
    return jids
}

const handler = async (sock, msg, from, sender, text) => {
    const isOwner = isOwnerCheck(sender, msg)

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''

    if (text.startsWith(config.prefix + 'aluguel ') || text === config.prefix + 'aluguel') {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono do bot pode usar este comando.' }, { quoted: msg })
            return true
        }

        const args = text.split(' ').slice(1)
        const groups = loadGroupConfig()

        let targetJid = from
        let tempoStr = ''
        let indexGrupo = null

        if (args.length >= 2) {
            if (args[0].toLowerCase() === 'grupo' || args[0].toLowerCase() === 'g' || args[0].startsWith('#')) {
                indexGrupo = parseInt(args[0].replace(/\D/g, '') || args[1])
                tempoStr = args.slice(args[0].startsWith('#') ? 1 : 2).join(' ')
            } else if (/^\d+$/.test(args[0])) {
                const resto = args.slice(1).join(' ').trim()
                const ehApenasUnidade = /^(s|seg|segundo|segundos|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)$/i.test(resto)

                if (ehApenasUnidade && from.endsWith('@g.us')) {

                    tempoStr = `${args[0]} ${resto}`
                    targetJid = from
                } else {

                    indexGrupo = parseInt(args[0])
                    tempoStr = resto
                }
            } else {
                tempoStr = args.join(' ')
            }
        } else {
            tempoStr = args.join(' ')
        }

        if (indexGrupo !== null) {
            const jids = obterMapaGrupos()
            if (indexGrupo < 1 || indexGrupo > jids.length) {
                await sock.sendMessage(from, { text: `❌ Índice inválido! Use um número de 1 a ${jids.length} da lista do comando *.grupos*.` }, { quoted: msg })
                return true
            }
            targetJid = jids[indexGrupo - 1]
        } else if (!targetJid.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '❌ No chat privado, informe o número do grupo:\n\nExemplo: `.aluguel 1 30d`\n(Consulte a lista com `.grupos`)' }, { quoted: msg })
            return true
        }

        let isForcar = text.includes('forcar') || text.startsWith(config.prefix + 'setaluguel')
        tempoStr = tempoStr.replace(/forcar/gi, '').trim()

        let targetGroupName = 'Grupo'
        try {
            const { getGroupMetadataCached } = require('../../utils/baileys')
            const meta = await getGroupMetadataCached(sock, targetJid)
            if (meta?.subject) targetGroupName = meta.subject
        } catch {}
        if (targetGroupName === 'Grupo' && groups[targetJid]?.name) targetGroupName = groups[targetJid].name

        if (!isForcar && verificarGrupoAtivo(groups[targetJid])) {
            const grupoInfo = groups[targetJid]
            let statusMsg = `⚠️ *O grupo "${targetGroupName}" já tem aluguel ativo!*\n\n`
            if (grupoInfo.expiraEm) {
                const agora = getDataMocambique().getTime()
                const restante = grupoInfo.expiraEm - agora
                if (restante > 0) {
                    statusMsg += `⏱️ Duração original: *${grupoInfo.duracao || 'N/A'}*\n`
                    statusMsg += `⏳ Tempo restante: *${formatarTempoRestante(restante)}*\n`
                    const expiraData = new Date(grupoInfo.expiraEm)
                    statusMsg += `📅 Expira em: ${expiraData.toLocaleDateString('pt-BR')} às ${expiraData.toLocaleTimeString('pt-BR')}\n`
                } else {
                    statusMsg += `❌ Status: *Expirado*\n`
                }
            } else {
                statusMsg += `♾️ Duração: *Permanente*\n`
            }
            statusMsg += `\n━━━━━━━━━━━━━━━━━━\n`
            statusMsg += `🔄 Para *adicionar tempo acumulativo* (aumentar), use:\n\`.renovar ${indexGrupo ? indexGrupo + ' ' : ''}${tempoStr}\`\n\n`
            statusMsg += `⚙️ Para *redefinir/diminuir o tempo* do zero, use:\n\`.aluguel ${indexGrupo ? indexGrupo + ' ' : ''}forcar ${tempoStr}\``

            await sock.sendMessage(from, { text: statusMsg }, { quoted: msg })
            return true
        }

        if (!groups[targetJid]) groups[targetJid] = {}
        groups[targetJid].authorized = true
        groups[targetJid].date = getDataMocambique().toISOString()
        delete groups[targetJid].avisouExpiracao
        delete groups[targetJid].avisouPreExpiracao5d
        delete groups[targetJid].avisouPreExpiracao24h

        if (tempoStr === 'permanente' || tempoStr === 'perm') {
            delete groups[targetJid].expiraEm
            delete groups[targetJid].duracao
            saveGroupConfig(groups)
            copiarNanosPadrao(targetJid)
            await sock.sendMessage(from, { text: `✅ *Aluguel ativado com sucesso!*\n\n👥 *Grupo:* ${targetGroupName}\n♾️ Duração: *Permanente*\n\nO bot agora está ativo neste grupo.` }, { quoted: msg })
            if (targetJid !== from) {
                try {
                    await sock.sendMessage(targetJid, { text: `🟢 *BOT ATIVADO PELO ADMINISTRADOR!*\n\n♾️ Duração: *Permanente*\nO bot já está pronto para uso neste grupo!` })
                } catch {}
            }
            return true
        }

        const tempoMs = parseTempo(tempoStr)
        if (tempoMs) {
            groups[targetJid].expiraEm = getDataMocambique().getTime() + tempoMs
            groups[targetJid].duracao = tempoStr
            saveGroupConfig(groups)
            copiarNanosPadrao(targetJid)

            const expiraData = new Date(groups[targetJid].expiraEm)
            await sock.sendMessage(from, {
                text: `✅ *Aluguel ativado com sucesso!*\n\n👥 *Grupo:* ${targetGroupName}\n⏱️ Duração: *${tempoStr}*\n📅 Expira em: ${expiraData.toLocaleDateString('pt-BR')} às ${expiraData.toLocaleTimeString('pt-BR')}\n\nO bot está ativo neste grupo.`
            }, { quoted: msg })

            if (targetJid !== from) {
                try {
                    await sock.sendMessage(targetJid, {
                        text: `🟢 *BOT ATIVADO PELO ADMINISTRADOR!*\n\n⏱️ Duração: *${tempoStr}*\n📅 Expira em: ${expiraData.toLocaleDateString('pt-BR')} às ${expiraData.toLocaleTimeString('pt-BR')}\n\nO bot já está pronto para uso neste grupo!`
                    })
                } catch {}
            }
        } else {
            await sock.sendMessage(from, { text: '❌ Formato de tempo inválido!\n\nExemplos:\n• .aluguel 1 30d (no Grupo 1)\n• .aluguel 30d (no grupo atual)\n• .aluguel 1 7d\n• .aluguel 1 24h\n• .aluguel 1 permanente' }, { quoted: msg })
        }
        return true
    }

    if (text === config.prefix + 'delgrupo') {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono do bot pode usar este comando.' }, { quoted: msg })
            return true
        }

        const groups = loadGroupConfig()

        if (!groups[from]?.authorized && !groups[from]?.expiraEm && !groups[from]?.duracao) {
            await sock.sendMessage(from, { text: '⚠️ Este grupo não está registrado.' }, { quoted: msg })
        } else {
            groups[from].authorized = false
            delete groups[from].expiraEm
            delete groups[from].duracao
            delete groups[from].date
            delete groups[from].avisouExpiracao

            saveGroupConfig(groups)
            await sock.sendMessage(from, { text: '🚫 *Aluguel removido!*\n\nO bot deixou de atuar aqui, mas as configurações de tabela e nanos foram mantidas.' }, { quoted: msg })
        }
        return true
    }

    if (text.startsWith(config.prefix + 'sair')) {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono do bot pode usar este comando.' }, { quoted: msg })
            return true
        }

        const args = text.split(' ').slice(1)
        let targetJid = from

        if (args[0] && /^\d+$/.test(args[0])) {
            const index = parseInt(args[0])
            const jids = obterMapaGrupos()
            if (index < 1 || index > jids.length) {
                await sock.sendMessage(from, { text: `❌ Índice inválido! Use um número de 1 a ${jids.length}.` }, { quoted: msg })
                return true
            }
            targetJid = jids[index - 1]
        } else {
            if (!from.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ Uso correto:\n• `.sair <index>` (remoto)\n• `.sair` (no grupo atual)' }, { quoted: msg })
                return true
            }
        }

        try {
            await sock.sendMessage(targetJid, { text: '👋 *Até mais!*\n\nO bot está saindo do grupo por decisão do dono.' })
        } catch (e) {}

        const groups = loadGroupConfig()
        if (groups[targetJid]) {
            groups[targetJid].authorized = false
            saveGroupConfig(groups)
        }

        setTimeout(async () => {
            try {
                await sock.groupLeave(targetJid)
                if (targetJid !== from) {
                    await sock.sendMessage(from, { text: `✅ O bot saiu do grupo ${targetJid.split('@')[0]} com sucesso.` })
                }
            } catch (err) {
                console.error('[SAIR] Erro ao sair:', err.message)
                if (targetJid === from) {
                    await sock.sendMessage(from, { text: '❌ Erro ao sair do grupo.' })
                }
            }
        }, 1500)

        return true
    }

    if (text.startsWith(config.prefix + 'remover aluguel')) {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono do bot pode usar este comando.' }, { quoted: msg })
            return true
        }

        const args = text.split(' ').slice(2)
        let targetJid = from

        if (args[0] && /^\d+$/.test(args[0])) {
            const index = parseInt(args[0])
            const jids = obterMapaGrupos()
            if (index < 1 || index > jids.length) {
                await sock.sendMessage(from, { text: `❌ Índice inválido! Use um número de 1 a ${jids.length}.` }, { quoted: msg })
                return true
            }
            targetJid = jids[index - 1]
        } else {
            if (!from.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ Uso correto:\n• `.remover aluguel <index>` (remoto)\n• `.remover aluguel` (no grupo atual)' }, { quoted: msg })
                return true
            }
        }

        const { getSuporteNumber } = require('../../utils/configManager')
        const suporteNum = getSuporteNumber()
        const linkDono = `wa.me/${suporteNum}`
        const msgAviso = `🚫 *O aluguel deste grupo foi removido pelo dono!* \n\nO bot deixará o grupo. Para mais informações ou renovação, contacte o suporte:\n${linkDono}`
        try {
            await sock.sendMessage(targetJid, { text: msgAviso })
        } catch (e) {}

        const groups = loadGroupConfig()
        if (groups[targetJid]) {
            groups[targetJid].authorized = false
            delete groups[targetJid].expiraEm
            delete groups[targetJid].duracao
            delete groups[targetJid].date
            delete groups[targetJid].avisouExpiracao
            delete groups[targetJid].avisouPreExpiracao5d
            delete groups[targetJid].avisouPreExpiracao24h
            saveGroupConfig(groups)
        }

        setTimeout(async () => {
            try {
                await sock.groupLeave(targetJid)
                if (targetJid !== from) {
                    await sock.sendMessage(from, { text: `✅ Aluguel removido e bot saiu do grupo ${targetJid.split('@')[0]}.` })
                }
            } catch (err) {
                console.error('[REMOVER-ALUGUEL] Erro ao sair:', err.message)
            }
        }, 1500)

        return true
    }

    const lowerText = text.toLowerCase().trim()
    const isAbrirOrFechar = lowerText.startsWith(config.prefix + 'grupo a') ||
                            lowerText.startsWith(config.prefix + 'grupo f') ||
                            lowerText.startsWith(config.prefix + 'grupo abrir') ||
                            lowerText.startsWith(config.prefix + 'grupo fechar') ||
                            lowerText.startsWith(config.prefix + 'abrir') ||
                            lowerText.startsWith(config.prefix + 'fechar')

    if (text === config.prefix + 'grupo' || text.startsWith(config.prefix + 'grupo ')) {

        if (isAbrirOrFechar) {
            return false
        }

        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono e sub-donos do bot podem usar este comando.' }, { quoted: msg })
            return true
        }

        const corpo = text.slice(config.prefix.length).trim()
        const querLink = corpo.toLowerCase().includes('link')

        const numerosStr = corpo.replace(/[^\d,\s]/g, ' ').trim()
        const indices = numerosStr.split(/[\s,]+/).filter(Boolean).map(n => parseInt(n, 10)).filter(n => !isNaN(n))

        if (querLink && indices.length > 0) {
            const jids = obterMapaGrupos()
            if (jids.length === 0) {
                await sock.sendMessage(from, { text: '❌ Nenhum grupo registrado no sistema.' }, { quoted: msg })
                return true
            }

            const { getGroupMetadataCached } = require('../../utils/baileys')
            const groupsCfg = loadGroupConfig()

            let linksTexto = `🔗 *LINKS DOS GRUPOS SOLICITADOS*\n\n`
            let count = 0

            for (const idx of indices) {
                if (idx < 1 || idx > jids.length) {
                    linksTexto += `❌ *Grupo #${idx}:* Índice inválido (use de 1 a ${jids.length})\n\n`
                    continue
                }

                const targetJid = jids[idx - 1]
                let nomeGrupo = groupsCfg[targetJid]?.name || `Grupo #${idx}`

                try {
                    const meta = await getGroupMetadataCached(sock, targetJid)
                    if (meta?.subject) nomeGrupo = meta.subject
                } catch {}

                try {
                    const code = await sock.groupInviteCode(targetJid)
                    const link = `https://chat.whatsapp.com/${code}`
                    linksTexto += `*${idx}. ${nomeGrupo}*\n👉 ${link}\n\n`
                    count++
                } catch (err) {
                    linksTexto += `*${idx}. ${nomeGrupo}*\n⚠️ _(O bot precisa ser Administrador no WhatsApp para gerar o link)_\n\n`
                }
            }

            await sock.sendMessage(from, { text: linksTexto.trim() }, { quoted: msg })
            return true
        }

        if (indices.length === 1 && !querLink) {
            const index = indices[0]
            const jids = obterMapaGrupos()
            if (index < 1 || index > jids.length) {
                await sock.sendMessage(from, { text: `❌ Índice inválido! Use um número de 1 a ${jids.length} (consulte a lista com \`.grupos\`).` }, { quoted: msg })
                return true
            }

            const targetJid = jids[index - 1]
            const { getGroupMetadataCached } = require('../../utils/baileys')
            const { getGrupoConfig } = require('../../vendas/gruposConfig')
            const groupsCfg = loadGroupConfig()
            const cfg = groupsCfg[targetJid] || {}
            const vConfig = getGrupoConfig(targetJid) || {}

            let nomeGrupo = cfg.name || `Grupo #${index}`
            let totalMembros = 'N/D'
            let totalAdmins = 'N/D'

            try {
                let meta = null
                try {
                    meta = await sock.groupMetadata(targetJid)
                } catch {
                    meta = await getGroupMetadataCached(sock, targetJid)
                }
                if (meta?.subject) {
                    nomeGrupo = meta.subject
                    if (cfg.name !== nomeGrupo) {
                        groupsCfg[targetJid].name = nomeGrupo
                        saveGroupConfig(groupsCfg)
                    }
                }
                if (meta?.participants && Array.isArray(meta.participants)) {
                    totalMembros = meta.participants.length
                    totalAdmins = meta.participants.filter(p => p.admin).length
                }
            } catch {}

            const agora = getDataMocambique().getTime()
            const statusValidade = cfg.expiraEm ? (agora >= cfg.expiraEm ? '⚠️ EXPIRADO' : `🟢 Ativo (Restam ${formatarTempoRestante(cfg.expiraEm - agora)})`) : '♾️ Permanente'
            let detalhes = `╔════════════════════════════╗\n`
            detalhes += `║ 👥 *DETALHES DO GRUPO #${index}* ║\n`
            detalhes += `╚════════════════════════════╝\n\n`
            detalhes += `📛 *Nome:* ${nomeGrupo}\n`
            detalhes += `⏱️ *Status:* ${statusValidade}\n`
            detalhes += `⚙️ *Modo de Vendas:* ⚪ 100% Manual\n`
            detalhes += `👥 *Membros:* ${totalMembros} participantes (${totalAdmins} administradores)\n`
            detalhes += `🆔 *JID:* \`${targetJid}\`\n\n`
            detalhes += `━━━━━━━━━━━━━━━━━━━━━\n`
            detalhes += `💡 *Ações Rápidas:*\n`
            detalhes += `• \`.grupo ${index} link\` ➔ Obter link do grupo\n`
            detalhes += `• \`.renovar ${index} 30d\` ➔ Adicionar tempo (+30d)\n`
            detalhes += `• \`.aluguel ${index} forcar 30d\` ➔ Redefinir tempo\n`
            detalhes += `• \`.sair ${index}\` ➔ Fazer o bot sair deste grupo`

            await sock.sendMessage(from, { text: detalhes }, { quoted: msg })
            return true
        }

        if (indices.length > 1) {
            const jids = obterMapaGrupos()
            if (jids.length === 0) {
                await sock.sendMessage(from, { text: '❌ Nenhum grupo registrado no sistema.' }, { quoted: msg })
                return true
            }

            const { getGroupMetadataCached } = require('../../utils/baileys')
            const groupsCfg = loadGroupConfig()

            let linksTexto = `🔗 *LINKS DOS GRUPOS SOLICITADOS*\n\n`
            for (const idx of indices) {
                if (idx < 1 || idx > jids.length) {
                    linksTexto += `❌ *Grupo #${idx}:* Índice inválido (use de 1 a ${jids.length})\n\n`
                    continue
                }

                const targetJid = jids[idx - 1]
                let nomeGrupo = groupsCfg[targetJid]?.name || `Grupo #${idx}`

                try {
                    const meta = await getGroupMetadataCached(sock, targetJid)
                    if (meta?.subject) nomeGrupo = meta.subject
                } catch {}

                try {
                    const code = await sock.groupInviteCode(targetJid)
                    const link = `https://chat.whatsapp.com/${code}`
                    linksTexto += `*${idx}. ${nomeGrupo}*\n👉 ${link}\n\n`
                } catch (err) {
                    linksTexto += `*${idx}. ${nomeGrupo}*\n⚠️ _(O bot precisa ser Administrador no WhatsApp para gerar o link)_\n\n`
                }
            }

            await sock.sendMessage(from, { text: linksTexto.trim() }, { quoted: msg })
            return true
        }

        await sock.sendMessage(from, { text: '❌ Uso correto:\n• `.grupo 1` (detalhes do grupo 1)\n• `.grupo 1 link` (link do grupo 1)\n• `.grupo 1,3,4 link` (links de múltiplos grupos)\n• `.grupos` (lista de todos os grupos)' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'grupos' || text === config.prefix + 'listagrupos') {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono e sub-donos do bot podem usar este comando.' }, { quoted: msg })
            return true
        }

        const groups = loadGroupConfig()

        let allParticipating = {}
        if (sock && typeof sock.groupFetchAllParticipating === 'function') {
            try {
                allParticipating = await sock.groupFetchAllParticipating() || {}
            } catch (e) {}
        }

        const autorizados = Object.entries(groups)
            .filter(([id, cfg]) => {
                if (!cfg || !cfg.authorized) return false
                return !!allParticipating[id] || (global.primaryGroups && global.primaryGroups.has(id))
            })
            .sort((a, b) => a[0].localeCompare(b[0]))

        if (autorizados.length === 0) {
            await sock.sendMessage(from, { text: '📋 *Grupos Autorizados:*\n\n_Nenhum grupo com bot presente registrado._' }, { quoted: msg })
            return true
        }

        const jids = autorizados.map(([id]) => id)
        global.mapaGrupos = jids

        let lista = `📋 *Grupos Autorizados:* (${autorizados.length})\n\n`
        const agora = getDataMocambique().getTime()
        let nomesAtualizados = false

        const promises = autorizados.map(async ([id, cfg], i) => {
            let nomeGrupo = allParticipating[id]?.subject || cfg.name || ''

            if (!nomeGrupo || /^\d+$/.test(nomeGrupo)) {
                try {
                    const { getGroupMetadataCached } = require('../../utils/baileys')
                    const metadata = await getGroupMetadataCached(sock, id)
                    if (metadata?.subject) {
                        nomeGrupo = metadata.subject
                    }
                } catch (e) {}
            }

            if (!nomeGrupo || /^\d+$/.test(nomeGrupo)) {
                nomeGrupo = cfg.name || `Grupo ${i + 1}`
            } else if (cfg.name !== nomeGrupo) {
                groups[id].name = nomeGrupo
                nomesAtualizados = true
            }

            const tempoRestante = cfg.expiraEm ? formatarTempoRestante(cfg.expiraEm - agora) : '♾️ Permanente'
            const expirado = cfg.expiraEm && agora >= cfg.expiraEm ? ' ⚠️ EXPIRADO' : ''
            const statusOff = cfg.botDesligado ? ' 🔒 DESLIGADO' : ''
            return `${i + 1}. *${nomeGrupo}*\n   ⏱️ ${tempoRestante}${expirado}${statusOff}\n`
        })

        const itens = await Promise.all(promises)
        lista += itens.join('\n')

        if (nomesAtualizados) {
            saveGroupConfig(groups)
        }

        await sock.sendMessage(from, { text: lista }, { quoted: msg })
        return true
    }

    if (text.startsWith(config.prefix + 'entrar')) {
        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono do bot pode usar este comando.' }, { quoted: msg })
            return true
        }

        const link = body.slice((config.prefix + 'entrar').length).trim()

        if (!link) {
            await sock.sendMessage(from, { text: '❌ Informe o link do grupo!\n\nExemplo: .entrar https://chat.whatsapp.com/XXXXXX' }, { quoted: msg })
            return true
        }

        const match = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)
        if (!match) {
            await sock.sendMessage(from, { text: '❌ Link inválido! Use um link de convite do WhatsApp.' }, { quoted: msg })
            return true
        }

        const inviteCode = match[1]

        try {
            await sock.sendMessage(from, { text: '⏳ Entrando no grupo...' }, { quoted: msg })

            const groupId = await sock.groupAcceptInvite(inviteCode)
            const targetJid = groupId.includes('@') ? groupId : `${groupId}@g.us`

            const groups = loadGroupConfig()
            const cfg = groups[targetJid]
            const agora = getDataMocambique().getTime()
            const estaAtivo = cfg && cfg.authorized && (!cfg.expiraEm || cfg.expiraEm > agora)

            let nomeGrupo = 'Grupo'
            try {
                const { getGroupMetadataCached } = require('../../utils/baileys')
                const meta = await getGroupMetadataCached(sock, targetJid)
                if (meta?.subject) nomeGrupo = meta.subject
            } catch {}

            if (estaAtivo) {
                const tempoRestante = cfg.expiraEm ? formatarTempoRestante(cfg.expiraEm - agora) : '♾️ Permanente'
                await sock.sendMessage(from, {
                    text: [
                        '✅ *ENTREI NO GRUPO COM SUCESSO!*',
                        '────────────────────────',
                        `👥 *Grupo:* ${nomeGrupo}`,
                        `🆔 *ID:* \`${targetJid}\``,
                        `🟢 *Status:* *ATIVO & AUTORIZADO*`,
                        `⏱️ *Licença Restante:* ${tempoRestante}`,
                        `⚙️ *Modo de Vendas:* ⚪ *100% Manual*`,
                        '────────────────────────',
                        '🚀 O bot já possui licença válida e está pronto para operar normalmente neste grupo!'
                    ].join('\n')
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, {
                    text: [
                        '✅ *ENTREI NO GRUPO COM SUCESSO!*',
                        '────────────────────────',
                        `👥 *Grupo:* ${nomeGrupo}`,
                        `🆔 *ID:* \`${targetJid}\``,
                        '⚠️ *Status:* *INATIVO* (sem licença ativa)',
                        '────────────────────────',
                        '💡 *Para ativar o bot neste grupo, use:*',
                        '👉 `.aluguel <tempo>`',
                        '',
                        '📌 *Exemplos:*',
                        '• `.aluguel 30d` _(30 dias)_',
                        '• `.aluguel 1mes`',
                        '• `.aluguel permanente`'
                    ].join('\n')
                }, { quoted: msg })
            }
        } catch (err) {
            console.error('[ENTRAR] Erro:', err.message)
            await sock.sendMessage(from, { text: '❌ Erro ao entrar no grupo. O link pode estar inválido ou expirado.' }, { quoted: msg })
        }
        return true
    }

    return false
}

handler.verificarGrupoAtivo = verificarGrupoAtivo
handler.formatarTempoRestante = formatarTempoRestante
handler.obterMapaGrupos = obterMapaGrupos
module.exports = handler
