function extrairNumerosEDistribuirPacotes(bodyText, numeroDestinoExcluir, megasTotal, valorTotal) {
    if (!bodyText) return []

    const linhas = bodyText.split('\n')

    const destinosExcluirList = (Array.isArray(numeroDestinoExcluir) ? numeroDestinoExcluir : [numeroDestinoExcluir])
        .filter(Boolean)
        .map(d => String(d).replace(/\D/g, '').slice(-9))

    const isComprovante = /Transferiste|ID da transacao|Confirmado|Confirmed|Transaction ID|Transaction|You transfered|You transferred|Taxa:|Fee:|saldo da tua conta|account balance|Destinat[aá]rio|Quantia|Obrigado|Thank you|M-Pesa|e-Mola/i.test(bodyText)

    if (isComprovante) {
        const regexDestinosTexto = /(?:para\s+(?:conta\s+|o\s+mpesa\s+|a\s+conta\s+)|to\s+(?:account\s+)?|to\s+|destinat[aá]rio[:\s]+|enviou\s+para\s+|enviado\s+para\s+)(\d{8,12})/gi
        let matchDest
        while ((matchDest = regexDestinosTexto.exec(bodyText)) !== null) {
            const dClean = matchDest[1].replace(/\D/g, '').slice(-9)
            if (dClean && !destinosExcluirList.includes(dClean)) {
                destinosExcluirList.push(dClean)
            }
        }
    }

    const numerosEncontrados = []

    const regexNumeroDireto = /(?:258)?\b(8[45]\d{7})\b/g
    for (const m of bodyText.matchAll(regexNumeroDireto)) {
        const numRaw = m[1]
        const num9 = numRaw.slice(-9)
        if (!destinosExcluirList.includes(num9) && !numerosEncontrados.some(n => n.slice(-9) === num9)) {
            numerosEncontrados.push(numRaw)
        }
    }

    const regexNumeroEspacado = /(?:258)?\b(8[45](?:[ \t-]*\d){7})\b/g
    for (const m of bodyText.matchAll(regexNumeroEspacado)) {
        const numRaw = m[1].replace(/\D/g, '')
        const num9 = numRaw.slice(-9)
        if (numRaw.length === 9 && !destinosExcluirList.includes(num9) && !numerosEncontrados.some(n => n.slice(-9) === num9)) {
            numerosEncontrados.push(numRaw)
        }
    }

    if (numerosEncontrados.length === 0) {
        return []
    }

    const totalNumeros = numerosEncontrados.length
    const totalMb = megasTotal ? (parseInt(megasTotal.mb, 10) || 0) : 0
    const isSaldo = megasTotal && megasTotal.tipo && megasTotal.tipo.toLowerCase().includes('saldo')

    const pedidos = []

    for (const num of numerosEncontrados) {
        const num9 = num.slice(-9)

        const linha = linhas.find(l => l.replace(/\D/g, '').includes(num9)) || ''

        let mbNum = 0
        let displayStr = ''
        let valorNum = valorTotal > 0 ? (valorTotal / totalNumeros) : 0

        if (totalNumeros === 1 && totalMb > 0) {
            mbNum = totalMb
            if (isSaldo) {
                displayStr = `${mbNum}MT Saldo`
            } else {
                if (mbNum >= 1024) {
                    const gbVal = mbNum / 1024
                    displayStr = Number.isInteger(gbVal) ? `${gbVal}GB` : `${gbVal.toFixed(1)}GB`
                } else {
                    displayStr = `${mbNum}MB`
                }
            }
        } else {

            if (!isComprovante) {
                const matchPacoteLinha = linha.match(/([\d.,]+)\s*(GB|MB|G|M|MT|Mt|mt|mzn|saldo)\b/i)
                if (matchPacoteLinha) {
                    const qtd = parseFloat(matchPacoteLinha[1].replace(',', '.'))
                    const unidade = matchPacoteLinha[2].toUpperCase()

                    if (unidade === 'GB' || unidade === 'G') {
                        mbNum = Math.round(qtd * 1024)
                        displayStr = qtd >= 1 ? `${qtd}GB` : `${mbNum}MB`
                    } else if (unidade === 'MB' || unidade === 'M') {
                        mbNum = Math.round(qtd)
                        displayStr = mbNum >= 1024 ? `${(mbNum / 1024).toFixed(1).replace('.0', '')}GB` : `${mbNum}MB`
                    } else if (unidade === 'MT' || unidade === 'SALDO' || unidade === 'MZN') {
                        mbNum = Math.round(qtd)
                        valorNum = qtd
                        displayStr = `${qtd}MT Saldo`
                    }
                }
            }

            if (!mbNum && totalMb > 0) {
                mbNum = Math.floor(totalMb / totalNumeros)
                if (isSaldo) {
                    const saldoIndividual = mbNum
                    displayStr = `${saldoIndividual}MT Saldo`
                } else {
                    if (mbNum >= 1024) {
                        const gbVal = mbNum / 1024
                        displayStr = Number.isInteger(gbVal) ? `${gbVal}GB` : `${gbVal.toFixed(1)}GB`
                    } else {
                        displayStr = `${mbNum}MB`
                    }
                }
            } else if (!displayStr) {
                if (totalMb > 0) {
                    const mbDiv = Math.floor(totalMb / totalNumeros)
                    mbNum = mbDiv
                    displayStr = mbDiv >= 1024 ? `${(mbDiv / 1024).toFixed(1).replace('.0', '')}GB` : `${mbDiv}MB`
                } else {
                    displayStr = megasTotal ? (megasTotal.gb || 'MANUAL') : 'MANUAL'
                }
            }
        }

        if (!isSaldo && mbNum > 0 && mbNum < 100) {
            mbNum = 100
            displayStr = '100MB'
        }

        pedidos.push({
            numero: num,
            mb: (!isSaldo && (mbNum || 1000) < 100) ? 100 : (mbNum || 1000),
            saldo: isSaldo ? (mbNum || (megasTotal && parseInt(megasTotal.mb, 10)) || valorNum) : undefined,
            gb: displayStr,
            valor: parseFloat(valorNum.toFixed(2)),
            displayPacote: displayStr
        })
    }

    const isEspecial = megasTotal && megasTotal.tipo && (
        megasTotal.tipo.toLowerCase().includes('diamante') ||
        megasTotal.tipo.toLowerCase().includes('ilimitado') ||
        megasTotal.tipo.toLowerCase().includes('semanal') ||
        megasTotal.tipo.toLowerCase().includes('mensal') ||
        megasTotal.tipo.toLowerCase().includes('tudo top')
    )

    const resultadoFinal = []

    for (const p of pedidos) {

        if (!isSaldo && !isEspecial && p.mb > 10240) {
            let restante = p.mb
            let valorRestante = p.valor
            const totalFatias = Math.ceil(p.mb / 10240)
            let fatiaIndex = 1

            while (restante > 0) {
                const fatiaMb = Math.min(10240, restante)
                const fatiaValor = parseFloat((valorRestante * (fatiaMb / (restante + fatiaMb))).toFixed(2))
                restante -= fatiaMb
                valorRestante -= fatiaValor

                const gbVal = fatiaMb / 1024
                const fatiaDisplay = Number.isInteger(gbVal) ? `${gbVal}GB` : `${gbVal.toFixed(1)}GB`

                resultadoFinal.push({
                    numero: p.numero,
                    mb: fatiaMb,
                    gb: fatiaDisplay,
                    valor: fatiaValor,
                    displayPacote: `${fatiaDisplay} (${fatiaIndex}/${totalFatias})`,
                    isSplit: true,
                    splitPart: fatiaIndex,
                    splitTotalParts: totalFatias,
                    splitTotalMegas: p.mb
                })
                fatiaIndex++
            }
        } else {
            resultadoFinal.push(p)
        }
    }

    return resultadoFinal
}

function formatarDadosDisplay(pedidos) {
    if (!pedidos || pedidos.length === 0) return ''
    if (pedidos.length === 1) {
        return `${pedidos[0].numero} -> ${pedidos[0].displayPacote}`
    }
    return '\n' + pedidos.map(p => `${p.numero} -> ${p.displayPacote}`).join('\n')
}

module.exports = {
    extrairNumerosEDistribuirPacotes,
    formatarDadosDisplay
}
