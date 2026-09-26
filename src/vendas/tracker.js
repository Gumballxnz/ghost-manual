const { vendasStore } = require('../utils/firebaseDataLayer')

const { getHojeMocambique, getDataMocambique, toDateStrMZ } = require('../utils/timezone')

function loadVendas() {
    return vendasStore.loadSync() || {}
}

function saveVendas(dataOrForce = false) {
    if (dataOrForce && typeof dataOrForce === 'object') {
        vendasStore.save(dataOrForce)
    } else {
        vendasStore.save(vendasStore.getCache(), dataOrForce === true)
    }
}

function parseToMB(str) {
    if (typeof str === 'number') return str
    if (!str) return 0
    const s = String(str).trim()

    const match = s.match(/([\d.]+)\s*(GB|MB|G|M)\b/i)
    if (match) {
        const value = parseFloat(match[1])
        const unit = match[2].toUpperCase()
        return (unit === 'GB' || unit === 'G') ? value * 1024 : value
    }

    const matchNum = s.match(/^([\d.]+)$/)
    if (matchNum) {
        return parseFloat(matchNum[1])
    }
    return 0
}

function formatMB(mb) {
    if (mb >= 1024) {

        const gbVal = parseFloat((mb / 1024).toFixed(2))

        return `${gbVal}GB (${Math.floor(mb)}MB)`
    }
    return Math.floor(mb) + 'MB'
}

function registrarVenda(groupId, clienteId, clienteNome, pacote, isSaldo = false, options = {}) {
    if (!groupId || !clienteId) return null
    if (options.isVenda === false) {
        return null
    }
    const vendas = loadVendas()

    const hoje = getHojeMocambique()
    const dataHoraMZ = getDataMocambique().toISOString()

    if (typeof clienteNome === 'number') {
        const numMegas = clienteNome
        const valPago = pacote || 0
        clienteNome = String(clienteId).split('@')[0]
        pacote = isSaldo ? `${valPago}MT Saldo` : `${numMegas}MB`
    }

    if (!vendas[groupId]) vendas[groupId] = { clientes: {}, historico: [] }
    if (!vendas[groupId].clientes[clienteId]) {
        vendas[groupId].clientes[clienteId] = {
            nome: clienteNome || String(clienteId).split('@')[0],
            totalMB: 0,
            totalSaldo: 0,
            compras: 0,
            comprasHoje: 0,
            ultimoDia: hoje
        }
    }

    const cliente = vendas[groupId].clientes[clienteId]

    if (cliente.ultimoDia !== hoje) {
        cliente.comprasHoje = 0
        cliente.ultimoDia = hoje
    }

    let mb = 0
    if (isSaldo) {
        const valor = typeof pacote === 'number' ? pacote : (parseFloat(String(pacote).replace(/[^\d.]/g, '')) || 0)
        cliente.totalSaldo = (cliente.totalSaldo || 0) + valor
    } else {
        mb = parseToMB(pacote)
        cliente.totalMB += mb
    }

    const isIntermediaria = options.isSplitPart === true && options.isLastPart === false
    if (!isIntermediaria) {
        cliente.compras += 1
        cliente.comprasHoje += 1
    }
    if (clienteNome) cliente.nome = clienteNome

    cliente.ultimoDia = hoje

    vendas[groupId].historico.push({
        clienteId,
        clienteNome: clienteNome || cliente.nome,
        pacote: String(pacote),
        mb,
        isSaldo: isSaldo ? true : undefined,
        valorSaldo: isSaldo ? (parseFloat(String(pacote).replace(/[^\d.]/g, '')) || 0) : undefined,
        data: dataHoraMZ,
        dataDia: hoje
    })

    saveVendas(vendas)

    return getClienteStats(groupId, clienteId)
}

function anularVenda(groupId, clienteId, pacote, isSaldo = false) {
    const vendas = loadVendas()
    const hoje = getHojeMocambique()
    const dataHoraMZ = getDataMocambique().toISOString()

    if (!vendas[groupId] || !vendas[groupId].clientes[clienteId]) return null

    const cliente = vendas[groupId].clientes[clienteId]

    if (cliente.ultimoDia !== hoje) {
        cliente.comprasHoje = 0
        cliente.ultimoDia = hoje
    }

    let mb = 0
    if (isSaldo) {
        const valor = parseFloat(pacote.replace(/[^\d.]/g, '')) || 0
        cliente.totalSaldo = Math.max(0, (cliente.totalSaldo || 0) - valor)
    } else {
        mb = parseToMB(pacote)
        cliente.totalMB = Math.max(0, (cliente.totalMB || 0) - mb)
    }

    cliente.compras = Math.max(0, (cliente.compras || 0) - 1)
    cliente.comprasHoje = Math.max(0, (cliente.comprasHoje || 0) - 1)
    cliente.ultimoDia = hoje

    vendas[groupId].historico.push({
        clienteId,
        clienteNome: cliente.nome,
        pacote: `ANULADO: ${pacote}`,
        mb: isSaldo ? 0 : -mb,
        isSaldo: isSaldo ? true : undefined,
        valorSaldo: isSaldo ? -(parseFloat(pacote.replace(/[^\d.]/g, '')) || 0) : undefined,
        isAnulacao: true,
        data: dataHoraMZ,
        dataDia: hoje
    })

    saveVendas(vendas)

    return getClienteStats(groupId, clienteId)
}

function getClienteStats(groupId, clienteId, participantesAtivos = null) {
    const vendas = loadVendas()
    const grupo = vendas[groupId]
    if (!grupo || !grupo.clientes[clienteId]) return null

    const cliente = grupo.clientes[clienteId]
    const hoje = getHojeMocambique()

    let comprasHojeReal = cliente.comprasHoje
    if (cliente.ultimoDia !== hoje) {
        comprasHojeReal = 0
    }

    const historicoHoje = (grupo.historico || []).filter(v => {
        if (v.dataDia) return v.dataDia === hoje
        return (v.data || '').startsWith(hoje)
    })

    const compradoresHojeMB = {}
    const compradoresHojeSaldo = {}
    let clienteHojeMB = 0
    let clienteHojeSaldo = 0

    for (const h of historicoHoje) {
        const cid = h.clienteId
        if (h.isSaldo) {
            const val = h.valorSaldo || 0
            compradoresHojeSaldo[cid] = (compradoresHojeSaldo[cid] || 0) + val
            if (cid === clienteId) clienteHojeSaldo += val
        } else {
            const mb = h.mb || 0
            compradoresHojeMB[cid] = (compradoresHojeMB[cid] || 0) + mb
            if (cid === clienteId) clienteHojeMB += mb
        }
    }

    const listHojeMB = Object.entries(compradoresHojeMB).sort((a, b) => b[1] - a[1])
    const idxDiaMB = listHojeMB.findIndex(r => r[0] === clienteId)
    const posicaoDiaMB = idxDiaMB >= 0 ? (idxDiaMB + 1) : (listHojeMB.length || 1)
    const totalCompradoresHojeMB = Math.max(1, listHojeMB.length)

    const listHojeSaldo = Object.entries(compradoresHojeSaldo).sort((a, b) => b[1] - a[1])
    const idxDiaSaldo = listHojeSaldo.findIndex(r => r[0] === clienteId)
    const posicaoDiaSaldo = idxDiaSaldo >= 0 ? (idxDiaSaldo + 1) : (listHojeSaldo.length || 1)
    const totalCompradoresHojeSaldo = Math.max(1, listHojeSaldo.length)

    let partSet = null
    if (participantesAtivos && Array.isArray(participantesAtivos) && participantesAtivos.length > 0) {
        partSet = new Set(participantesAtivos.map(p => typeof p === 'string' ? p : p.id))
    }

    let rankingMB = Object.entries(grupo.clientes)
        .filter(([id, c]) => (c.totalMB || 0) > 0)
        .map(([id, c]) => ({ id, totalMB: c.totalMB || 0 }))
        .sort((a, b) => b.totalMB - a.totalMB)

    if (partSet && partSet.size > 0) {
        const rankingMBFiltrado = rankingMB.filter(r => partSet.has(r.id))
        if (rankingMBFiltrado.length > 0) {
            rankingMB = rankingMBFiltrado
        }
    }

    const idxMB = rankingMB.findIndex(r => r.id === clienteId)
    const posicaoMB = idxMB >= 0 ? (idxMB + 1) : (rankingMB.length || 1)
    const totalCompradoresMB = Math.max(1, rankingMB.length)
    const topClienteMB = rankingMB[0]
    const topClienteMBNome = topClienteMB ? (grupo.clientes[topClienteMB.id]?.nome || 'Cliente') : 'Cliente'

    let rankingSaldo = Object.entries(grupo.clientes)
        .filter(([id, c]) => (c.totalSaldo || 0) > 0)
        .map(([id, c]) => ({ id, totalSaldo: c.totalSaldo || 0 }))
        .sort((a, b) => b.totalSaldo - a.totalSaldo)

    if (partSet && partSet.size > 0) {
        const rankingSaldoFiltrado = rankingSaldo.filter(r => partSet.has(r.id))
        if (rankingSaldoFiltrado.length > 0) {
            rankingSaldo = rankingSaldoFiltrado
        }
    }

    const idxSaldo = rankingSaldo.findIndex(r => r.id === clienteId)
    const posicaoSaldo = idxSaldo >= 0 ? (idxSaldo + 1) : (rankingSaldo.length || 1)
    const totalCompradoresSaldo = Math.max(1, rankingSaldo.length)
    const topClienteSaldo = rankingSaldo[0]
    const topClienteSaldoNome = topClienteSaldo ? (grupo.clientes[topClienteSaldo.id]?.nome || 'Cliente') : 'Cliente'

    return {
        nome: cliente.nome,
        totalMB: cliente.totalMB,
        totalFormatado: formatMB(cliente.totalMB),
        totalHojeMB: clienteHojeMB,
        totalHojeMBFormatado: formatMB(clienteHojeMB),
        totalSaldo: cliente.totalSaldo || 0,
        totalHojeSaldo: clienteHojeSaldo,
        totalHojeSaldoFormatado: `${clienteHojeSaldo} MT`,
        compras: cliente.compras,
        comprasHoje: comprasHojeReal,
        posicao: posicaoMB,
        posicaoMB,
        posicaoSaldo,
        posicaoDiaMB,
        posicaoDiaSaldo,
        totalCompradoresHojeMB,
        totalCompradoresHojeSaldo,
        totalCompradoresMB,
        totalCompradoresSaldo,
        topGrupo: topClienteMB ? formatMB(topClienteMB.totalMB) : '0MB',
        topGrupoMB: topClienteMB ? formatMB(topClienteMB.totalMB) : '0MB',
        topClienteMBId: topClienteMB ? topClienteMB.id : null,
        topClienteMBNome,
        topGrupoSaldo: topClienteSaldo ? (topClienteSaldo.totalSaldo || 0) + 'MT' : '0MT',
        topClienteSaldoId: topClienteSaldo ? topClienteSaldo.id : null,
        topClienteSaldoNome
    }
}

function getRanking(groupId, limite = 50) {
    const vendas = loadVendas()
    const grupo = vendas[groupId]
    if (!grupo) return []

    const ranking = Object.entries(grupo.clientes)
        .map(([id, cliente]) => ({
            id,
            nome: cliente.nome || 'Cliente',
            totalMB: cliente.totalMB || 0,
            totalSaldo: cliente.totalSaldo || 0,
            compras: cliente.compras || 0
        }))
        .sort((a, b) => {
            if (b.totalMB !== a.totalMB) {
                return b.totalMB - a.totalMB
            }
            return b.totalSaldo - a.totalSaldo
        })
        .slice(0, limite)

    return ranking
}

function getVendasHoje(groupId) {
    const vendas = loadVendas()
    const grupo = vendas[groupId]
    if (!grupo) return { total: 0, totalMB: '0MB', totalSaldo: 0, clientes: [] }

    const hoje = getHojeMocambique()

    const vendasHoje = (grupo.historico || []).filter(v => {
        if (v.isVenda === false) return false
        const dia = toDateStrMZ(v.data) || v.dataDia
        return dia === hoje
    })

    const totalMBBruto = vendasHoje.reduce((sum, v) => sum + (v.mb || 0), 0)
    const totalSaldoBruto = vendasHoje.reduce((sum, v) => sum + (v.valorSaldo || 0), 0)

    return {
        total: vendasHoje.length,
        totalMB: formatMB(totalMBBruto),
        totalSaldo: totalSaldoBruto,
        clientes: vendasHoje
    }
}

function getDiaDoRegistro(v) {
    return toDateStrMZ(v.data) || v.dataDia || (v.data || '').slice(0, 10)
}

function getVendasPorPeriodo(groupId, clienteId) {
    const vendas = loadVendas()
    const grupo = vendas[groupId]
    if (!grupo || !grupo.clientes[clienteId]) return null

    const historicoCliente = (grupo.historico || []).filter(v => {
        if (v.isVenda === false) return false
        return v.clienteId === clienteId
    })

    const hojeDate = getDataMocambique()
    const hojeStr = getHojeMocambique()

    const diaSemana = hojeDate.getDay()
    const diffParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1
    const segundaDate = new Date(hojeDate)
    segundaDate.setDate(segundaDate.getDate() - diffParaSegunda)
    const segundaStr = segundaDate.toISOString().split('T')[0]

    const mesPrefixo = hojeStr.slice(0, 7)

    function agregar(filtroFn) {
        const entradas = historicoCliente.filter(filtroFn)
        let mb = 0
        let saldo = 0
        let compras = 0
        for (const v of entradas) {
            if (v.isSaldo) {
                saldo += (v.valorSaldo || 0)
            } else {
                mb += (v.mb || 0)
            }
            if (!v.isAnulacao) compras++
        }
        return { compras, mb: Math.max(0, mb), totalFormatado: formatMB(Math.max(0, mb)), saldo: Math.max(0, saldo) }
    }

    return {
        hoje: agregar(v => getDiaDoRegistro(v) === hojeStr),
        semana: agregar(v => {
            const dia = getDiaDoRegistro(v)
            return dia >= segundaStr && dia <= hojeStr
        }),
        mes: agregar(v => getDiaDoRegistro(v).startsWith(mesPrefixo)),
        total: agregar(() => true)
    }
}

function getGroupStats(groupId) {
    const vendas = loadVendas()
    const grupo = vendas[groupId]
    if (!grupo) return null

    const totalClientes = Object.keys(grupo.clientes).length
    const totalVendas = grupo.historico.length

    const totalMB = Object.values(grupo.clientes).reduce((sum, c) => sum + (c.totalMB || 0), 0)

    return {
        totalClientes,
        totalVendas,
        totalMB: formatMB(totalMB)
    }
}

function trimHistorico() {
    const vendas = loadVendas()
    let alterado = false
    const MAX_HISTORICO = 500

    for (const [groupId, grupo] of Object.entries(vendas)) {
        if (grupo.historico && grupo.historico.length > MAX_HISTORICO) {
            grupo.historico = grupo.historico.slice(-MAX_HISTORICO)
            alterado = true
        }
    }

    if (alterado) saveVendas(vendas)
}

setInterval(trimHistorico, 600000)

module.exports = {
    registrarVenda,
    anularVenda,
    getClienteStats,
    getRanking,
    getVendasHoje,
    getVendasPorPeriodo,
    getGroupStats,
    parseToMB,
    formatMB,
    trimHistorico,
    getHojeMocambique,
    getDataMocambique
}
