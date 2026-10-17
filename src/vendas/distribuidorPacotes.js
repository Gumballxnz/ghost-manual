function extrairNumerosEDistribuirPacotes(bodyText, numeroDestinoExcluir, megasTotal, valorTotal) {
    if (!bodyText) return []

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

    const matches = []
    const regexNumeroDireto = /(?:258)?\b(8[45]\d{7})\b/g
    for (const m of bodyText.matchAll(regexNumeroDireto)) {
        const numRaw = m[1]
        const num9 = numRaw.slice(-9)
        if (!destinosExcluirList.includes(num9) && !matches.some(n => n.num.slice(-9) === num9)) {
            matches.push({ num: numRaw, index: m.index, len: m[0].length })
        }
    }

    const regexNumeroEspacado = /(?:258)?\b(8[45](?:[ \t-]*\d){7})\b/g
    for (const m of bodyText.matchAll(regexNumeroEspacado)) {
        const numRaw = m[1].replace(/\D/g, '')
        const num9 = numRaw.slice(-9)
        if (numRaw.length === 9 && !destinosExcluirList.includes(num9) && !matches.some(n => n.num.slice(-9) === num9)) {
            matches.push({ num: numRaw, index: m.index, len: m[0].length })
        }
    }

    if (matches.length === 0) return []

    matches.sort((a, b) => a.index - b.index)
    const K = matches.length
    const totalMb = megasTotal ? (parseInt(megasTotal.mb, 10) || 0) : 0
    const isSaldo = megasTotal && megasTotal.tipo && megasTotal.tipo.toLowerCase().includes('saldo')

    const pkgRegex = /(?:^|[^0-9])(?:[.,\s]+)?([1-9]\d*(?:[.,]\d+)?)\s*(GB|MB|G|M|MT|Mt|mt|mzn|saldo)\b/i
    const rawParsed = []

    for (let i = 0; i < K; i++) {
        const cur = matches[i]
        const prev = i > 0 ? matches[i - 1] : null
        const next = i < K - 1 ? matches[i + 1] : null

        const textAfter = bodyText.slice(cur.index + cur.len, next ? next.index : bodyText.length)
        const textBefore = bodyText.slice(prev ? prev.index + prev.len : 0, cur.index)

        let match = null
        if (!isComprovante) {
            const matchBefore = textBefore.match(pkgRegex)
            const matchAfter = textAfter.match(pkgRegex)

            if (matchBefore && /(?:para|pro|p\/|ao|a\s+conta)\s*$/i.test(textBefore.trim())) {
                match = matchBefore
            } else if (matchAfter) {
                match = matchAfter
            } else if (matchBefore) {
                match = matchBefore
            }
        }

        let mbNum = null
        let isSaldoNum = false
        if (match) {
            const qtd = parseFloat(match[1].replace(',', '.'))
            const unidade = match[2].toUpperCase()

            if (unidade === 'GB' || unidade === 'G') {
                mbNum = Math.round(qtd * 1024)
            } else if (unidade === 'MB' || unidade === 'M') {
                mbNum = Math.round(qtd)
            } else if (unidade === 'MT' || unidade === 'SALDO' || unidade === 'MZN') {
                mbNum = Math.round(qtd)
                isSaldoNum = true
            }
        }

        rawParsed.push({ num: cur.num, mbNum, isSaldoNum })
    }

    const isMultipleOf10GB = !isSaldo && totalMb >= 10240 && (totalMb % 10240 === 0)
    const totalUnits = isMultipleOf10GB ? Math.round(totalMb / 10240) : 0
    const anySpecified = rawParsed.some(p => p.mbNum !== null)

    let allocated = []

    if (anySpecified) {
        let remMb = totalMb
        for (const p of rawParsed) {
            if (p.mbNum !== null) {
                let desired = p.mbNum
                if (isMultipleOf10GB) {
                    desired = Math.max(10240, Math.round(desired / 10240) * 10240)
                }
                const actual = Math.min(desired, remMb)
                remMb -= actual
                allocated.push({ num: p.num, mb: actual, specified: true, isSaldoNum: p.isSaldoNum })
            } else {
                allocated.push({ num: p.num, mb: 0, specified: false, isSaldoNum: false })
            }
        }

        const unspec = allocated.filter(a => !a.specified)
        if (remMb > 0 && unspec.length > 0) {
            if (isMultipleOf10GB) {
                const remUnits = Math.round(remMb / 10240)
                const baseU = Math.floor(remUnits / unspec.length)
                const extraU = remUnits % unspec.length
                unspec.forEach((item, idx) => {
                    const u = baseU + (idx < extraU ? 1 : 0)
                    item.mb += u * 10240
                    remMb -= u * 10240
                })
            } else {
                const share = Math.floor(remMb / unspec.length)
                unspec.forEach((item, idx) => {
                    const add = (idx === 0) ? (remMb - share * (unspec.length - 1)) : share
                    item.mb += add
                })
                remMb = 0
            }
        }

        if (remMb > 0 && allocated.length > 0) {
            allocated[0].mb += remMb
        }
    } else {
        if (isMultipleOf10GB) {
            const baseU = Math.floor(totalUnits / K)
            const extraU = totalUnits % K
            for (let i = 0; i < K; i++) {
                const u = baseU + (i < extraU ? 1 : 0)
                allocated.push({ num: matches[i].num, mb: u * 10240, specified: false, isSaldoNum: false })
            }
        } else if (isSaldo) {
            const share = Math.floor(totalMb / K)
            const rem = totalMb % K
            for (let i = 0; i < K; i++) {
                const s = (i === 0) ? (share + rem) : share
                allocated.push({ num: matches[i].num, mb: s, specified: false, isSaldoNum: true })
            }
        } else {
            const share = Math.floor(totalMb / K)
            const rem = totalMb % K
            for (let i = 0; i < K; i++) {
                const mb = (i === 0) ? (share + rem) : share
                allocated.push({ num: matches[i].num, mb, specified: false, isSaldoNum: false })
            }
        }
    }

    allocated = allocated.filter(a => a.mb > 0)

    let valRestante = valorTotal > 0 ? valorTotal : 0
    const pedidos = []

    for (let i = 0; i < allocated.length; i++) {
        const item = allocated[i]
        let val
        if (i === allocated.length - 1) {
            val = parseFloat(valRestante.toFixed(2))
        } else {
            val = totalMb > 0 ? parseFloat(((valorTotal * item.mb) / totalMb).toFixed(2)) : 0
            valRestante -= val
        }

        let displayStr = ''
        if (isSaldo || item.isSaldoNum) {
            displayStr = `${item.mb}MT Saldo`
        } else {
            if (item.mb >= 1024) {
                const gbVal = item.mb / 1024
                displayStr = Number.isInteger(gbVal) ? `${gbVal}GB` : `${gbVal.toFixed(1)}GB`
            } else {
                displayStr = `${item.mb}MB`
            }
        }

        pedidos.push({
            numero: item.num,
            mb: (!isSaldo && !item.isSaldoNum && item.mb < 100) ? 100 : item.mb,
            saldo: (isSaldo || item.isSaldoNum) ? item.mb : undefined,
            gb: displayStr,
            valor: val,
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
        if (!isSaldo && !p.saldo && !isEspecial && p.mb > 10240) {
            let restante = p.mb
            let valorRestante = p.valor
            const totalFatias = Math.ceil(p.mb / 10240)
            let fatiaIndex = 1

            while (restante > 0) {
                const fatiaMb = Math.min(10240, restante)
                let fatiaValor
                if (fatiaIndex === totalFatias) {
                    fatiaValor = parseFloat(valorRestante.toFixed(2))
                } else {
                    fatiaValor = parseFloat(((p.valor * fatiaMb) / p.mb).toFixed(2))
                }
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
