function parseMonetaryValue(raw) {
    if (raw === null || raw === undefined) return 0
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw

    let str = String(raw).trim().replace(/\s+/g, '')

    str = str.replace(/MT|MZN|Meticais|Metical/gi, '').trim()
    if (!str) return 0

    if (str.includes(',') && str.includes('.')) {
        const lastComma = str.lastIndexOf(',')
        const lastDot = str.lastIndexOf('.')
        if (lastDot > lastComma) {

            str = str.replace(/,/g, '')
        } else {

            str = str.replace(/\./g, '').replace(',', '.')
        }
        const val = parseFloat(str)
        return isNaN(val) ? 0 : val
    }

    if (/^\d{1,3}(,\d{3})+$/.test(str)) {
        const val = parseFloat(str.replace(/,/g, ''))
        return isNaN(val) ? 0 : val
    }

    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        const val = parseFloat(str.replace(/\./g, ''))
        return isNaN(val) ? 0 : val
    }

    if (/,\d{1,2}$/.test(str)) {
        const val = parseFloat(str.replace(',', '.'))
        return isNaN(val) ? 0 : val
    }

    const val = parseFloat(str.replace(',', '.'))
    return isNaN(val) ? 0 : val
}

function extractReceiptCodeFromFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') return null
    const cleanName = fileName.trim()

    const matchEmola = cleanName.match(/(?:^|[^A-Za-z0-9])(PP\d{6}\.[A-Za-z0-9]+\.[A-Za-z0-9]+)(?:$|[^A-Za-z0-9])/i) ||
                       cleanName.match(/(?:^|[^A-Za-z0-9])(CO\d{6}\.[A-Za-z0-9]+\.[A-Za-z0-9]+)(?:$|[^A-Za-z0-9])/i)
    if (matchEmola) {
        return matchEmola[1].toUpperCase()
    }

    const matchMpesa = cleanName.match(/(?:^|[^A-Za-z0-9])((?=.*\d)[DC][A-Z0-9]{9,11})(?:$|[^A-Za-z0-9])/i) ||
                       cleanName.match(/Recibo_([A-Z0-9]{10,12})/i) ||
                       cleanName.match(/Transa[cç][aã]o_Recibo_([A-Z0-9]{10,12})/i)
    if (matchMpesa) {
        return matchMpesa[1].toUpperCase()
    }

    return null
}

module.exports = {
    parseMonetaryValue,
    extractReceiptCodeFromFileName
}
