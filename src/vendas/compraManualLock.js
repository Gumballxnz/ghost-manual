const comprasManuaisRecentes = new Map()

function registrarCompraManualRecente(groupId, numeroOuJid) {
    if (!groupId || !numeroOuJid) return
    const numLimpo = String(numeroOuJid).replace(/\D/g, '').slice(-9)
    if (!numLimpo) return

    const key = `${groupId}:${numLimpo}`
    const agora = Date.now()
    comprasManuaisRecentes.set(key, agora)

    setTimeout(() => {
        if (comprasManuaisRecentes.get(key) === agora) {
            comprasManuaisRecentes.delete(key)
        }
    }, 90000)
}

function foiCompraManualRecente(groupId, numeroOuJid) {
    if (!groupId || !numeroOuJid) return false
    const numLimpo = String(numeroOuJid).replace(/\D/g, '').slice(-9)
    if (!numLimpo) return false

    const key = `${groupId}:${numLimpo}`
    const timestamp = comprasManuaisRecentes.get(key)
    if (!timestamp) return false

    return (Date.now() - timestamp) < 90000
}

module.exports = {
    registrarCompraManualRecente,
    foiCompraManualRecente
}
