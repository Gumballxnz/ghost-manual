const { recibosStore } = require('../utils/firebaseDataLayer')

function loadRecibos() {
    const data = recibosStore.loadSync() || {}
    if (!data.usados) data.usados = {}
    if (!data.pendentes) data.pendentes = {}

    if (!data.usados.mpesa) data.usados.mpesa = {}
    if (!data.usados.emola) data.usados.emola = {}
    if (!data.pendentes.mpesa) data.pendentes.mpesa = {}
    if (!data.pendentes.emola) data.pendentes.emola = {}

    for (const prov of ['mpesa', 'emola']) {
        if (data.usados[prov]) {
            for (const key of Object.keys(data.usados[prov])) {
                if (!key || key.trim().length < 6) delete data.usados[prov][key]
            }
        }
        if (data.pendentes[prov]) {
            for (const key of Object.keys(data.pendentes[prov])) {
                if (!key || key.trim().length < 6) delete data.pendentes[prov][key]
            }
        }
    }

    return data
}

function detectarProvedorRecibo(codigo, dados = {}) {
    if (dados?.sistema) {
        const s = String(dados.sistema).toLowerCase()
        if (s.includes('emola') || s.includes('e-mola') || s.includes('movitel')) return 'emola'
        if (s.includes('mpesa') || s.includes('m-pesa') || s.includes('vodacom')) return 'mpesa'
    }
    if (dados?.origem) {
        const o = String(dados.origem).toLowerCase()
        if (o.includes('emola') || o.includes('e-mola')) return 'emola'
        if (o.includes('mpesa') || o.includes('m-pesa')) return 'mpesa'
    }

    const clean = String(codigo || '').trim().toUpperCase()
    const alnum = clean.replace(/[^A-Z0-9]/g, '')

    const phone = String(dados?.phone || dados?.remetente || dados?.senderPhone || dados?.clientePhone || '').replace(/\D/g, '')
    if (phone.length >= 8) {
        const ddd = phone.slice(-9, -7)
        if (['84', '85'].includes(ddd)) return 'mpesa'
        if (['86', '87', '88'].includes(ddd)) return 'emola'
    }

    if (/^\d{10,14}$/.test(alnum)) {
        return 'emola'
    }

    if (/^(?:PP|CI|[A-Z]{1,3}\d)/i.test(clean) || /[A-Z]/.test(clean)) {
        return 'mpesa'
    }

    return 'mpesa'
}

function sanitizeKey(k) {
    return String(k || '').trim().toUpperCase().replace(/[.#$[\]/]/g, '_')
}

const recibosEmProcessamento = new Set()

function iniciarProcessamentoRecibo(codigo) {
    if (!codigo) return false
    const clean = String(codigo).trim().toUpperCase()
    if (clean.length < 6) return false

    if (recibosEmProcessamento.has(clean) || recibosEmProcessamento.has(codigo)) {
        return false
    }
    if (reciboJaUsado(clean)) {
        return false
    }
    recibosEmProcessamento.add(clean)
    recibosEmProcessamento.add(codigo)

    setTimeout(() => {
        recibosEmProcessamento.delete(clean)
        recibosEmProcessamento.delete(codigo)
    }, 8000)
    return true
}

function finalizarProcessamentoRecibo(codigo) {
    if (codigo) {
        const clean = String(codigo).trim().toUpperCase()
        recibosEmProcessamento.delete(clean)
        recibosEmProcessamento.delete(codigo)
    }
}

function reciboJaUsado(codigo, provedorHint = null) {
    if (!codigo) return false
    const clean = String(codigo).trim().toUpperCase()
    if (clean.length < 6) return false
    const alnum = clean.replace(/[^A-Z0-9]/g, '')
    const safeKey = sanitizeKey(clean)
    const recibos = loadRecibos()

    const prov = provedorHint || detectarProvedorRecibo(codigo)
    const outroProv = prov === 'mpesa' ? 'emola' : 'mpesa'

    for (const p of [prov, outroProv]) {
        const particao = recibos.usados?.[p]
        if (particao) {
            if (particao[clean] || particao[codigo] || (safeKey && particao[safeKey]) || (alnum && particao[alnum])) {
                return true
            }

            if (alnum && alnum.length >= 6) {
                for (const k of Object.keys(particao)) {
                    if (k.replace(/[^A-Z0-9]/g, '') === alnum) {
                        return true
                    }
                }
            }
        }
    }

    if (recibos.usados) {
        if (recibos.usados[clean] || recibos.usados[codigo] || (safeKey && recibos.usados[safeKey]) || (alnum && recibos.usados[alnum])) {
            return true
        }
        if (alnum && alnum.length >= 6) {
            for (const k of Object.keys(recibos.usados)) {
                if (k !== 'mpesa' && k !== 'emola' && k.replace(/[^A-Z0-9]/g, '') === alnum) {
                    return true
                }
            }
        }
    }

    return false
}

function marcarReciboUsado(codigo, dados = {}) {
    if (!codigo) return
    const clean = String(codigo).trim().toUpperCase()
    if (clean.length < 6) {
        console.warn(`[RECIBOS] Tentativa de marcar recibo inválido com menos de 6 caracteres: "${clean}" ignorada.`)
        return
    }
    const alnum = clean.replace(/[^A-Z0-9]/g, '')
    const safeKey = sanitizeKey(clean)
    const prov = detectarProvedorRecibo(codigo, dados)
    const recibos = loadRecibos()

    if (!recibos.usados[prov]) recibos.usados[prov] = {}
    const info = {
        ...dados,
        sistema: prov === 'emola' ? 'e-Mola' : 'M-Pesa',
        usadoEm: new Date().toISOString()
    }

    recibos.usados[prov][clean] = info
    if (safeKey && safeKey !== clean) {
        recibos.usados[prov][safeKey] = info
    }
    if (alnum && alnum !== clean) {
        recibos.usados[prov][alnum] = info
    }

    for (const p of [prov, 'mpesa', 'emola']) {
        if (recibos.pendentes?.[p]) {
            delete recibos.pendentes[p][clean]
            delete recibos.pendentes[p][codigo]
            if (safeKey) delete recibos.pendentes[p][safeKey]
            if (alnum) delete recibos.pendentes[p][alnum]
        }
    }
    if (recibos.pendentes) {
        delete recibos.pendentes[clean]
        delete recibos.pendentes[codigo]
        if (safeKey) delete recibos.pendentes[safeKey]
        if (alnum) delete recibos.pendentes[alnum]
    }

    recibosStore.patch(`usados/${prov}/${safeKey}`, info)
    recibosStore.patch(`pendentes/${prov}/${safeKey}`, null)

    finalizarProcessamentoRecibo(clean)
    finalizarProcessamentoRecibo(codigo)
    if (safeKey) finalizarProcessamentoRecibo(safeKey)
    if (alnum) finalizarProcessamentoRecibo(alnum)
}

function desmarcarReciboUsado(codigo) {
    if (!codigo) return
    const clean = String(codigo).trim().toUpperCase()
    const alnum = clean.replace(/[^A-Z0-9]/g, '')
    const safeKey = sanitizeKey(clean)
    const prov = detectarProvedorRecibo(codigo)
    const recibos = loadRecibos()

    for (const p of [prov, 'mpesa', 'emola']) {
        if (recibos.usados?.[p]) {
            delete recibos.usados[p][clean]
            delete recibos.usados[p][codigo]
            if (alnum) delete recibos.usados[p][alnum]
            if (safeKey) delete recibos.usados[p][safeKey]
        }
    }

    if (recibos.usados) {
        delete recibos.usados[clean]
        delete recibos.usados[codigo]
        if (alnum) delete recibos.usados[alnum]
        if (safeKey) delete recibos.usados[safeKey]
    }

    recibosStore.patch(`usados/${prov}/${safeKey}`, null)
    recibosStore.patch(`usados/${safeKey}`, null)

    console.log(`[RECIBOS] Recibo ${clean} (${prov}) totalmente desmarcado de usado.`)
    finalizarProcessamentoRecibo(clean)
    finalizarProcessamentoRecibo(codigo)
    if (alnum) finalizarProcessamentoRecibo(alnum)
}

function adicionarReciboPendente(codigo, dados) {
    if (!codigo) return false
    const clean = String(codigo).trim().toUpperCase()
    if (clean.length < 6) return false
    const safeKey = sanitizeKey(clean)
    const prov = detectarProvedorRecibo(codigo, dados)
    const recibos = loadRecibos()

    if (!recibos.pendentes[prov]) recibos.pendentes[prov] = {}
    const info = {
        ...dados,
        sistema: prov === 'emola' ? 'e-Mola' : 'M-Pesa',
        criadoEm: new Date().toISOString()
    }
    recibos.pendentes[prov][clean] = info

    recibosStore.patch(`pendentes/${prov}/${safeKey}`, info)
    return true
}

function buscarReciboPendente(codigo) {
    if (!codigo) return null
    const clean = String(codigo).trim().toUpperCase()
    const prov = detectarProvedorRecibo(codigo)
    const recibos = loadRecibos()

    return recibos.pendentes?.[prov]?.[clean] ||
           recibos.pendentes?.[prov]?.[codigo] ||
           recibos.pendentes?.[clean] ||
           recibos.pendentes?.[codigo] ||
           null
}

function removerReciboPendente(codigo) {
    if (!codigo) return
    const clean = String(codigo).trim().toUpperCase()
    const safeKey = sanitizeKey(clean)
    const prov = detectarProvedorRecibo(codigo)
    const recibos = loadRecibos()

    if (recibos.pendentes?.[prov]) {
        delete recibos.pendentes[prov][clean]
        delete recibos.pendentes[prov][codigo]
    }
    if (recibos.pendentes) {
        delete recibos.pendentes[clean]
        delete recibos.pendentes[codigo]
    }

    recibosStore.patch(`pendentes/${prov}/${safeKey}`, null)
    recibosStore.patch(`pendentes/${safeKey}`, null)
}

function obterInfoRecibo(codigo) {
    if (!codigo) return null
    const clean = String(codigo).trim().replace(/^[`'"]+|[`'"]+$/g, '').toUpperCase()
    const raw = String(codigo).trim().replace(/^[`'"]+|[`'"]+$/g, '')
    const prov = detectarProvedorRecibo(codigo)
    const recibos = loadRecibos()

    for (const p of [prov, 'mpesa', 'emola']) {
        if (recibos.usados?.[p]?.[clean]) {
            return { status: 'USADO', codigo: clean, provedor: p, ...recibos.usados[p][clean] }
        }
        if (recibos.usados?.[p]?.[raw]) {
            return { status: 'USADO', codigo: raw, provedor: p, ...recibos.usados[p][raw] }
        }
    }
    if (recibos.usados?.[clean]) {
        return { status: 'USADO', codigo: clean, ...recibos.usados[clean] }
    }
    if (recibos.usados?.[raw]) {
        return { status: 'USADO', codigo: raw, ...recibos.usados[raw] }
    }

    for (const p of [prov, 'mpesa', 'emola']) {
        if (recibos.pendentes?.[p]?.[clean]) {
            return { status: 'PENDENTE', codigo: clean, provedor: p, ...recibos.pendentes[p][clean] }
        }
        if (recibos.pendentes?.[p]?.[raw]) {
            return { status: 'PENDENTE', codigo: raw, provedor: p, ...recibos.pendentes[p][raw] }
        }
    }
    if (recibos.pendentes?.[clean]) {
        return { status: 'PENDENTE', codigo: clean, ...recibos.pendentes[clean] }
    }
    if (recibos.pendentes?.[raw]) {
        return { status: 'PENDENTE', codigo: raw, ...recibos.pendentes[raw] }
    }

    return null
}

function registrarEntregaRecibo(codigo, megas = 0, valor = 0) {
    if (!codigo) return
    const clean = String(codigo).trim().toUpperCase()
    const safeKey = sanitizeKey(clean)
    const alnum = clean.replace(/[^A-Z0-9]/g, '')
    const prov = detectarProvedorRecibo(codigo)
    const recibos = loadRecibos()

    if (!recibos.usados[prov]) recibos.usados[prov] = {}
    const entry = recibos.usados[prov][clean] || recibos.usados[prov][safeKey] || recibos.usados[prov][alnum] || {
        usadoEm: new Date().toISOString()
    }
    entry.entregueComSucesso = true
    entry.megasEntregues = (entry.megasEntregues || 0) + Number(megas || 0)
    entry.valorEntregue = (entry.valorEntregue || 0) + Number(valor || 0)

    recibos.usados[prov][clean] = entry
    if (safeKey && safeKey !== clean) recibos.usados[prov][safeKey] = entry
    if (alnum && alnum !== clean) recibos.usados[prov][alnum] = entry

    removerReciboPendente(clean)

    recibosStore.patch(`usados/${prov}/${safeKey}`, entry)
    console.log(`[RECIBOS] ✅ Entrega registrada com sucesso para o recibo ${clean} (${prov}: +${megas}MB, +${valor}MT).`)
}

function reciboTeveEntregaParcial(codigo) {
    if (!codigo) return false
    const clean = String(codigo).trim().toUpperCase()
    const prov = detectarProvedorRecibo(codigo)
    const recibos = loadRecibos()

    const item = recibos.usados?.[prov]?.[clean] || recibos.usados?.[clean]
    if (!item) return false
    return !!(item.entregueComSucesso === true || (item.megasEntregues && item.megasEntregues > 0))
}

function marcarVariosRecibosUsados(listaRecibos, por = 'reset_admin') {
    if (!Array.isArray(listaRecibos) || listaRecibos.length === 0) return 0
    let marcados = 0

    for (const r of listaRecibos) {
        const codigo = typeof r === 'string' ? r : (r.tx_id || r.key || r.codigo || '')
        const clean = String(codigo).trim().toUpperCase()
        if (clean.length < 6) continue

        marcarReciboUsado(clean, {
            valor: (typeof r === 'object' ? r.valor : 0) || 0,
            por: por,
            origem: 'reset_admin_pendentes'
        })
        marcados++
    }

    console.log(`[RECIBOS] ✅ Bulk reset: ${marcados} recibos marcados como usados por ${por}.`)
    return marcados
}

async function limparRecibosExpirados() {
    try {
        const recibos = loadRecibos()
        const now = Date.now()
        const trintaDiasMs = 30 * 24 * 3600 * 1000
        const vinteQuatroHorasMs = 24 * 3600 * 1000
        let pendentesRemovidos = 0
        let usadosRemovidos = 0

        for (const prov of ['mpesa', 'emola']) {
            if (recibos.pendentes?.[prov]) {
                for (const [key, item] of Object.entries(recibos.pendentes[prov])) {
                    const criadoEm = item?.criadoEm ? new Date(item.criadoEm).getTime() : 0
                    if (criadoEm > 0 && (now - criadoEm > vinteQuatroHorasMs)) {
                        delete recibos.pendentes[prov][key]
                        pendentesRemovidos++
                    }
                }
            }
        }
        for (const [key, item] of Object.entries(recibos.pendentes || {})) {
            if (key === 'mpesa' || key === 'emola') continue
            const criadoEm = item?.criadoEm ? new Date(item.criadoEm).getTime() : 0
            if (!criadoEm || (now - criadoEm > vinteQuatroHorasMs)) {
                delete recibos.pendentes[key]
                pendentesRemovidos++
            }
        }

        for (const prov of ['mpesa', 'emola']) {
            if (recibos.usados?.[prov]) {
                for (const [key, item] of Object.entries(recibos.usados[prov])) {
                    const usadoEm = item?.usadoEm ? new Date(item.usadoEm).getTime() : (item?.timestamp || 0)
                    if (usadoEm > 0 && (now - usadoEm > trintaDiasMs)) {
                        delete recibos.usados[prov][key]
                        usadosRemovidos++
                    }
                }
            }
        }
        for (const [key, item] of Object.entries(recibos.usados || {})) {
            if (key === 'mpesa' || key === 'emola') continue
            const usadoEm = item?.usadoEm ? new Date(item.usadoEm).getTime() : (item?.timestamp || 0)
            if (usadoEm > 0 && (now - usadoEm > trintaDiasMs)) {
                delete recibos.usados[key]
                usadosRemovidos++
            }
        }

        if (pendentesRemovidos > 0 || usadosRemovidos > 0) {
            recibosStore.save(recibos, true)
            console.log(`[RECIBOS] 🧹 Limpeza automática concluída: ${usadosRemovidos} recibos antigos (>30d) e ${pendentesRemovidos} pendentes (>24h) descartados em 1 único salvamento consolidado. Banco leve!`)
        }
        return { pendentesRemovidos, usadosRemovidos }
    } catch (e) {
        console.error('[RECIBOS] Erro ao limpar recibos expirados:', e.message)
        return { pendentesRemovidos: 0, usadosRemovidos: 0 }
    }
}

setTimeout(() => {
    limparRecibosExpirados().catch(() => {})
}, 10000)

module.exports = {
    reciboJaUsado,
    marcarReciboUsado,
    marcarVariosRecibosUsados,
    desmarcarReciboUsado,
    registrarEntregaRecibo,
    reciboTeveEntregaParcial,
    obterInfoRecibo,
    iniciarProcessamentoRecibo,
    finalizarProcessamentoRecibo,
    adicionarReciboPendente,
    buscarReciboPendente,
    removerReciboPendente,
    detectarProvedorRecibo,
    limparRecibosExpirados
}
