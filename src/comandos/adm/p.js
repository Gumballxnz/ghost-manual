const config = require('../../../data/config.json')
const fs = require('fs')
const path = require('path')
const { isOwnerCheck, isAdmin, getCargo, resolverParticipanteGrupo } = require('../../utils/baileys.js')
const { getVendasPorPeriodo } = require('../../vendas/tracker.js')

const ATIVIDADE_PATH = path.join(__dirname, '../../../data/atividade.json')
function getAtividade() {
    try {
        if (!fs.existsSync(ATIVIDADE_PATH)) return {}
        return JSON.parse(fs.readFileSync(ATIVIDADE_PATH, 'utf8'))
    } catch {
        return {}
    }
}

const PERIODOS_VALIDOS = ['diario', 'semanal', 'mensal', 'total']

module.exports = async (sock, msg, from, sender, text) => {
    if (!text.startsWith(config.prefix + 'p')) return false

    const resto = text.slice((config.prefix + 'p').length)
    if (resto && !resto.startsWith(' ')) return false

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos.' }, { quoted: msg })
        return true
    }

    const isOwner = isOwnerCheck(sender, msg)
    let adminStatus = isOwner
    if (!isOwner) {
        try { adminStatus = await isAdmin(sock, from, sender) } catch { }
    }
    if (!isOwner && !adminStatus) {
        await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
        return true
    }

    const partes = resto.trim().split(/\s+/).filter(Boolean)
    let periodoFiltro = null
    if (partes.length > 0 && PERIODOS_VALIDOS.includes(partes[0].toLowerCase())) {
        periodoFiltro = partes[0].toLowerCase()
    }

    const messageContent = msg.message?.extendedTextMessage
    const mentions = messageContent?.contextInfo?.mentionedJid || []
    const quotedParticipant = messageContent?.contextInfo?.participant
    let targetId = mentions[0] || quotedParticipant || sender

    if (targetId.includes('@lid')) {
        targetId = await resolverParticipanteGrupo(sock, from, targetId)
    }

    const targetNum = targetId.split('@')[0].split(':')[0]

    let cargo = 'Membro'
    try { cargo = await getCargo(sock, from, targetId) } catch { }

    const atividade = getAtividade()
    const mensagens = atividade[from]?.[targetId]?.msgs || 0

    const stats = getVendasPorPeriodo(from, targetId)
    const vazio = { compras: 0, totalFormatado: '0MB', saldo: 0 }
    const s = stats || { hoje: vazio, semana: vazio, mes: vazio, total: vazio }

    function linhaPeriodo(label, dados) {
        let linha = `│ ${label}: *${dados.compras}* compra(s) — ${dados.totalFormatado}`
        if (dados.saldo > 0) linha += ` | ${dados.saldo}MT saldo`
        return linha
    }

    const nomesPeriodo = { diario: '📅 Hoje', semanal: '🗓️ Semana', mensal: '📆 Mês', total: '🏆 Total' }
    const camposPeriodo = { diario: 'hoje', semanal: 'semana', mensal: 'mes', total: 'total' }

    let resposta = `📊 *Status de @${targetNum}*\n\n`
    resposta += `📌 Cargo: ${cargo}\n`
    resposta += `💬 Mensagens: ${mensagens}\n\n`

    const periodosAMostrar = periodoFiltro ? [periodoFiltro] : ['diario', 'semanal', 'mensal', 'total']
    for (const p of periodosAMostrar) {
        resposta += linhaPeriodo(nomesPeriodo[p], s[camposPeriodo[p]]) + '\n'
    }

    if (!stats) {
        resposta += `\n_Sem histórico de compras registrado para este usuário._`
    }

    await sock.sendMessage(from, { text: resposta, mentions: [targetId] }, { quoted: msg })
    return true
}
