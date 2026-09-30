const { manualCounterStore } = require('../utils/firebaseDataLayer')

function getDataHoraMocambique() {
    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (offset * 60000))
}

function proximoNumeroManual() {
    const agora = getDataHoraMocambique()
    const hojeStr = agora.toISOString().split('T')[0]

    let dados = { date: hojeStr, contador: 0 }
    try {
        const lido = manualCounterStore.loadSync()
        if (lido && lido.date === hojeStr) {
            dados = lido
        }
    } catch { }

    dados.contador = (dados.contador || 0) + 1
    dados.date = hojeStr

    try {
        manualCounterStore.save(dados)
    } catch (err) {
        console.error('[MANUAL-COUNTER] Erro ao salvar contador:', err.message)
    }

    const yy = String(agora.getFullYear()).slice(-2)
    const mm = String(agora.getMonth() + 1).padStart(2, '0')
    const dd = String(agora.getDate()).padStart(2, '0')
    const hh = String(agora.getHours()).padStart(2, '0')
    const min = String(agora.getMinutes()).padStart(2, '0')

    return `ML${yy}${mm}${dd}.${hh}${min}.X${dados.contador}`
}

module.exports = { proximoNumeroManual }
