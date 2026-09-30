const fs = require('fs')
const path = require('path')

const entregasPath = path.join(__dirname, 'entregasPendentes.json')
let entregas = {}

try {
    if (fs.existsSync(entregasPath)) {
        entregas = JSON.parse(fs.readFileSync(entregasPath))
    }
} catch (err) {
    console.error('Erro ao carregar entregas pendentes:', err)
}

function salvarDados() {
    try {
        fs.writeFileSync(entregasPath, JSON.stringify(entregas, null, 2))
    } catch (err) {
        console.error('Erro ao salvar entregas pendentes:', err)
    }
}

function salvarEntregaPendente(chave, dados) {
    entregas[chave] = dados
    salvarDados()
}

function buscarEntregaPendente(chave) {
    return entregas[chave]
}

function removerEntregaPendente(chave) {
    if (entregas[chave]) {
        delete entregas[chave]
        salvarDados()
    }
}

function listarEntregasPendentes() {
    return entregas
}

function buscarEntregaPendentePorCliente(from, clienteId) {
    if (!clienteId) return null
    const cleanId = String(clienteId).split('@')[0].split(':')[0].replace(/\D/g, '')
    let melhorMatch = null
    let melhorTimestamp = 0

    for (const [chave, item] of Object.entries(entregas)) {
        if (!item) continue
        const itemGrupo = item.grupoOrigem
        const itemClienteId = String(item.clienteId || '').split('@')[0].split(':')[0].replace(/\D/g, '')
        const itemNumero = String(item.numero || '').replace(/\D/g, '')

        const matchGrupo = (!from || !itemGrupo || itemGrupo === from)
        const matchCliente = (itemClienteId && cleanId && (itemClienteId === cleanId || itemClienteId.slice(-8) === cleanId.slice(-8))) ||
                             (itemNumero && cleanId && (itemNumero === cleanId || itemNumero.slice(-8) === cleanId.slice(-8)))

        if (matchGrupo && matchCliente) {
            const ts = item.timestamp || 0
            if (ts >= melhorTimestamp) {
                melhorTimestamp = ts
                melhorMatch = { chave, ...item }
            }
        }
    }
    return melhorMatch
}

function buscarEntregaPendentePorCodigo(codigo) {
    if (!codigo) return null
    const cleanCod = String(codigo).trim().toUpperCase()
    for (const [chave, item] of Object.entries(entregas)) {
        if (item && item.codigo && String(item.codigo).trim().toUpperCase() === cleanCod) {
            return { chave, ...item }
        }
    }
    return null
}

function consumirEntregaPendente(chaveOuItem) {
    if (!chaveOuItem) return
    const item = typeof chaveOuItem === 'object' ? chaveOuItem : entregas[chaveOuItem]
    const chavesParaRemover = new Set()

    if (typeof chaveOuItem === 'string') chavesParaRemover.add(chaveOuItem)
    if (item) {
        if (item.chave) chavesParaRemover.add(item.chave)
        if (item.codigo) chavesParaRemover.add(String(item.codigo).trim().toUpperCase())
        if (item.numero) {
            chavesParaRemover.add(item.numero)
            chavesParaRemover.add('258' + item.numero)
            if (item.numero.startsWith('258')) chavesParaRemover.add(item.numero.substring(3))
        }
        if (item.clienteId) chavesParaRemover.add(item.clienteId)

        for (const [k, v] of Object.entries(entregas)) {
            if (v && item.codigo && v.codigo === item.codigo) chavesParaRemover.add(k)
        }
    }

    let mudou = false
    for (const k of chavesParaRemover) {
        if (entregas[k]) {
            delete entregas[k]
            mudou = true
        }
    }
    if (mudou) salvarDados()
}

function limparEntregasAntigas() {
    const agora = Date.now()
    const LIMITE_MS = 24 * 60 * 60 * 1000
    let alterado = false

    for (const [chave, dados] of Object.entries(entregas)) {
        if (dados.timestamp && (agora - dados.timestamp) > LIMITE_MS) {
            delete entregas[chave]
            alterado = true
        }
    }

    if (alterado) salvarDados()
}

setInterval(limparEntregasAntigas, 600000)

module.exports = {
    salvarEntregaPendente,
    buscarEntregaPendente,
    buscarEntregaPendentePorCliente,
    buscarEntregaPendentePorCodigo,
    consumirEntregaPendente,
    removerEntregaPendente,
    listarEntregasPendentes,
    limparEntregasAntigas
}
