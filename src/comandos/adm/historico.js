const { isOwnerCheck, isAdmin } = require('../../utils/baileys.js')
const { vendasStore, recibosStore } = require('../../utils/firebaseDataLayer')
const { getHojeMocambique, formatMB } = require('../../vendas/tracker.js')
const config = require('../../../data/config.json')

module.exports = async (sock, msg, from, sender, text) => {
    const rawArgs = text.trim().split(/\s+/)
    const rawCmd = (rawArgs[0] || '').toLowerCase()
    if (rawCmd !== config.prefix + 'historico' && rawCmd !== config.prefix + 'hist' && rawCmd !== config.prefix + 'faturamento') {
        return false
    }

    const isOwner = isOwnerCheck(sender, msg)
    const isGroup = from.endsWith('@g.us')

    if (!isOwner) {
        if (!isGroup) {
            await sock.sendMessage(from, { text: '❌ Este comando só pode ser usado em grupos ou pelo dono do bot.' }, { quoted: msg })
            return true
        }
        let adminStatus = false
        try {
            adminStatus = await isAdmin(sock, from, sender)
        } catch { }

        if (!adminStatus) {
            await sock.sendMessage(from, { text: '❌ Este comando é exclusivo para administradores.' }, { quoted: msg })
            return true
        }
    }

    const hoje = getHojeMocambique()

    await recibosStore.load()
    await vendasStore.load()

    const dbRecibos = recibosStore.getCache() || {}
    const dbVendas = vendasStore.getCache() || {}

    const gruposAlvo = new Set()
    if (isGroup) {
        gruposAlvo.add(from)
        gruposAlvo.add(from.replace(/\./g, '___dot___'))
    }

    let totalDinheiroHoje = 0
    let totalDepositosQtd = 0

    for (const [codigo, rData] of Object.entries(dbRecibos?.usados || {})) {
        if (!rData) continue
        const rFrom = rData.from || rData.grupoId || ''
        const pertence = !isGroup || !rFrom || gruposAlvo.has(rFrom) || gruposAlvo.has(rFrom.replace(/___dot___/g, '.')) || gruposAlvo.has(rFrom.replace(/\./g, '___dot___'))
        if (pertence && (rData.data || rData.usadoEm || '').startsWith(hoje)) {
            totalDinheiroHoje += (Number(rData.valor) || 0)
            totalDepositosQtd++
        }
    }

    let totalVendasHojeQtd = 0
    let totalMegasTrackerHoje = 0
    for (const [gId, gData] of Object.entries(dbVendas)) {
        if (isGroup && !gruposAlvo.has(gId) && !gruposAlvo.has(gId.replace(/___dot___/g, '.')) && !gruposAlvo.has(gId.replace(/\./g, '___dot___'))) {
            continue
        }
        if (gData && Array.isArray(gData.historico)) {
            for (const v of gData.historico) {
                if (v.isAnulacao || v.isVenda === false) continue
                const dataV = v.dataDia || (v.data || '').slice(0, 10)
                if (dataV === hoje) {
                    totalVendasHojeQtd++
                    totalMegasTrackerHoje += (Number(v.mb) || 0)
                }
            }
        }
    }

    const dataFormatada = hoje.split('-').reverse().join('/')
    const linhas = [
        '📊 *RELATÓRIO DIÁRIO & FATURAMENTO*',
        '────────────────────────',
        `📅 *Data:* ${dataFormatada}`,
        `💰 *Dinheiro Entrado:* *${totalDinheiroHoje.toFixed(2)} MTs*`,
        `🧾 *Depósitos Confirmados:* ${totalDepositosQtd}`,
        `📦 *Vendas Concluídas:* ${totalVendasHojeQtd} (${formatMB(totalMegasTrackerHoje)})`,
        '────────────────────────'
    ]

    await sock.sendMessage(from, { text: linhas.join('\n') }, { quoted: msg })
    return true
}
