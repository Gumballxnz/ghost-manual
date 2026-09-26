function getHojeMocambique() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function getOntemMocambique() {
    const hoje = getHojeMocambique()
    const [y, m, d] = hoje.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    return dt.toISOString().split('T')[0]
}

function toDateStrMZ(dateInput) {
    if (!dateInput) return null
    try {
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput
        }
        const d = new Date(dateInput)
        if (isNaN(d.getTime())) return null
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    } catch {
        return null
    }
}

function getHoraMinutoMocambique(date = new Date()) {
    const str = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
    const [h, m] = str.split(':').map(Number)
    return { horas: h, minutos: m }
}

function getDataMocambique() {
    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (offset * 60000))
}

function getDataFormatada() {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'Africa/Maputo' }).format(new Date())
}

function getHoraFormatada() {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
}

function getDataHoraFormatada() {
    return `${getDataFormatada()} ${getHoraFormatada()}`
}

function getTimestampMocambique() {
    return getDataMocambique().getTime()
}

function timestampParaData(timestamp) {
    return new Date(timestamp)
}

function formatarTempoRestante(ms) {
    if (ms <= 0) return 'Expirado'

    const dias = Math.floor(ms / (24 * 60 * 60 * 1000))
    const horas = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutos = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    const segundos = Math.floor((ms % (60 * 1000)) / 1000)

    if (dias > 0) return `${dias} dia(s) e ${horas}h`
    if (horas > 0) return `${horas}h e ${minutos}min`
    if (minutos > 0) return `${minutos}min e ${segundos}s`
    return `${segundos} segundo(s)`
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
        case 's': case 'seg': case 'segundo': case 'segundos':
            return valor * MS_POR_SEGUNDO
        case 'min': case 'minuto': case 'minutos':
            return valor * MS_POR_MINUTO
        case 'h': case 'hora': case 'horas':
            return valor * MS_POR_HORA
        case 'd': case 'dia': case 'dias':
            return valor * MS_POR_DIA
        case 'mes': case 'meses':
            return valor * 30 * MS_POR_DIA
        case 'a': case 'ano': case 'anos':
            return valor * 365 * MS_POR_DIA
        default:
            return valor * MS_POR_DIA
    }
}

module.exports = {
    getHojeMocambique,
    getOntemMocambique,
    toDateStrMZ,
    getHoraMinutoMocambique,
    getDataMocambique,
    getDataFormatada,
    getHoraFormatada,
    getDataHoraFormatada,
    getTimestampMocambique,
    timestampParaData,
    formatarTempoRestante,
    parseTempo
}
