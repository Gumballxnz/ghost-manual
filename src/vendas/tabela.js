const fs = require('fs')
const path = require('path')
const configManager = require('../utils/configManager')

function loadGroupConfig() {
    return configManager.loadGroupConfig()
}

function padronizarTipo(tipo) {
    if (!tipo) return ''
    let t = tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase()
    if (/^di[aá]rios?$/i.test(t)) return 'Diário'
    if (/^semanais$/i.test(t)) return 'Semanal'
    if (/^semanal$/i.test(t)) return 'Semanal'
    if (/^mensais$/i.test(t)) return 'Mensal'
    if (/^mensal$/i.test(t)) return 'Mensal'
    if (/^ilimitados?$/i.test(t)) return 'Ilimitado'
    if (/^diamante/i.test(t)) return 'Ilimitado'
    if (/^ofertas?$/i.test(t)) return 'Oferta'
    if (/^internet$/i.test(t)) return 'Internet'
    if (/^24\s?h$/i.test(t)) return 'Diário'
    if (/^atualiz/i.test(t)) return 'Diário'
    return t
}

const HEADER_REGEX = /(di[aá]rios?|semanais|semanal|mensais|mensal|ilimitados?|diamante|ofertas?|internet|24h|24 h|atualiz[aá]v|30\s?dias?|7\s?dias?)/gi

function encontrarSecao(texto, posicao) {
    const parteAnterior = texto.substring(0, posicao)
    const linhas = parteAnterior.split('\n')

    for (let i = linhas.length - 1; i >= 0; i--) {
        const l = linhas[i].trim()
        if (!l) continue

        if (/diamante|tudo\s*top|tudotop|ilimitad/i.test(l)) {
            return 'Ilimitado'
        }

        if (/semanais|semanal|7\s*dias?/i.test(l) && !/mensal|30\s*dias?/i.test(l)) {
            return 'Semanal'
        }

        if (/mensais|mensal|30\s*dias?/i.test(l)) {
            return 'Mensal'
        }

        if (/di[aá]rios?|24\s*h|atualiz/i.test(l)) {
            return 'Diário'
        }
    }
    return 'Diário'
}

function normalizarTextoTabela(str) {
    if (!str || typeof str !== 'string') return ''
    return str
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[➔➜➝➞➟➡➡➤►]/g, '➔')
}

function limparNumeroTabela(str) {
    if (!str) return 0
    let s = normalizarTextoTabela(String(str)).trim().replace(/\s+/g, '')
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
        s = s.replace(/\./g, '').replace(',', '.')
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
        s = s.replace(/,/g, '')
    } else {
        s = s.replace(',', '.')
    }
    const val = parseFloat(s)
    return isNaN(val) ? 0 : val
}

function parsearTabela(textoTabela) {
    if (!textoTabela) return []
    const resultados = []

    const textoLimpo = normalizarTextoTabela(textoTabela).replace(/\*/g, '')

    const linhas = textoLimpo.split('\n')

    let posAcumulada = 0

    for (let i = 0; i < linhas.length; i++) {
        const linhaOriginal = linhas[i]
        const linha = linhaOriginal.trim()

        if (!linha || linha.length < 4) {
            posAcumulada += linhaOriginal.length + 1
            continue
        }

        const posicao = posAcumulada

        let preco = null
        let mb = null

        const matchA = linha.match(/(?:^|[^\d.,])([\d.,]+)\s*(?:MT[Ss]?|mzn|meticais)\b.*?([\d][\d.,]*)\s*(MB|GB|mb|gb|mega|gigas?|megas?|G|M)\b/i)

        const matchBC = linha.match(/(?:^|[^\d.,])([\d][\d.,]*)\s*(MB|GB|mb|gb|mega|gigas?|megas?|G|M)\b.*?(\d[\d\s.,]*)\s*(?:MT[Ss]?|mzn|meticais)\b/i)

        if (matchBC) {
            preco = limparNumeroTabela(matchBC[3])
            const valorRaw = limparNumeroTabela(matchBC[1])
            const unidade = matchBC[2].toUpperCase()
            mb = unidade === 'GB' || unidade === 'G' || unidade.startsWith('GIGA') ? valorRaw * 1024 : valorRaw
        } else if (matchA) {
            preco = limparNumeroTabela(matchA[1])
            const valorRaw = limparNumeroTabela(matchA[2])
            const unidade = matchA[3].toUpperCase()
            mb = unidade === 'GB' || unidade === 'G' || unidade.startsWith('GIGA') ? valorRaw * 1024 : valorRaw
        }

        if (preco !== null && mb !== null && preco > 0 && mb > 0) {

            const tipo = encontrarSecao(textoLimpo, posicao)

            let extraDesc = ''
            if (/chamada/i.test(linha) || /sms/i.test(linha) || /ilimitad/i.test(linha) || tipo === 'Ilimitado') {
                extraDesc = ' + Chamadas & SMS Ilimitadas'
            }

            const jaTem = resultados.some(r => r.preco === preco && Math.abs(r.mb - Math.round(mb)) < 5 && r.tipo === tipo)
            if (!jaTem) {
                resultados.push({ preco, mb: Math.round(mb), tipo, extraDesc, index: posicao })
            }
        }

        posAcumulada += linhaOriginal.length + 1
    }

    return resultados
}

function calcularMegasPorTexto(valor, textoTabela) {
    const v = parseFloat(valor)
    const entradas = parsearTabela(textoTabela)

    for (const e of entradas) {
        if (e.preco === v) {
            const display = formatarDisplay(e.mb)
            return { gb: display, mb: e.mb.toString(), tipo: e.tipo || 'Convencional', preco: e.preco }
        }
    }

    return null
}

function buscarDadosPorPacoteNaTabela(planoStr, textoTabela) {
    if (!planoStr) return null

    const str = normalizarTextoTabela(String(planoStr)).trim()
    const isExplicitPreco = /(?:MT[Ss]?|mzn|meticais)\b/i.test(str)

    const matchPlano = str.match(/^([\d.,]+)\s*(MB|GB|mb|gb|M|G|MT[Ss]?|mzn|meticais)?$/i)
    let valorAlvo = null
    let unidadePlano = ''

    if (matchPlano) {
        valorAlvo = parseFloat(matchPlano[1].replace(',', '.'))
        unidadePlano = (matchPlano[2] || '').toUpperCase()
    } else {
        const matchLivre = str.match(/([\d.,]+)\s*(MB|GB|mb|gb|M|G|MT[Ss]?|mzn|meticais)?/i)
        if (!matchLivre) return null
        valorAlvo = parseFloat(matchLivre[1].replace(',', '.'))
        unidadePlano = (matchLivre[2] || '').toUpperCase()
    }

    if (isNaN(valorAlvo) || valorAlvo <= 0) return null

    const entradas = textoTabela ? parsearTabela(textoTabela) : []

    if (isExplicitPreco || /^MT/i.test(unidadePlano) || unidadePlano === 'MZN' || unidadePlano === 'METICAIS') {
        for (const e of entradas) {
            if (e.preco === valorAlvo) {
                const display = formatarDisplay(e.mb, e.extraDesc || '', e.tipo || '')
                return { preco: e.preco, tipo: e.tipo || 'Convencional', mb: e.mb.toString(), gb: display, extraDesc: e.extraDesc }
            }
        }
        return null
    }

    let mbAlvo = valorAlvo
    if (unidadePlano === 'GB' || unidadePlano === 'G' || (unidadePlano === '' && valorAlvo <= 50)) {
        mbAlvo = Math.round(valorAlvo * 1024)
    } else {
        mbAlvo = Math.round(valorAlvo)
    }

    for (const e of entradas) {
        if (Math.abs(e.mb - mbAlvo) <= 15) {
            const display = formatarDisplay(e.mb, e.extraDesc || '', e.tipo || '')
            return { preco: e.preco, tipo: e.tipo || 'Convencional', mb: e.mb.toString(), gb: display, extraDesc: e.extraDesc }
        }
    }

    const displayMb = mbAlvo >= 1024 ? `${(mbAlvo / 1024).toFixed(1).replace('.0', '')}GB` : `${mbAlvo}MB`
    return {
        preco: null,
        tipo: 'Diário/Manual',
        mb: mbAlvo.toString(),
        gb: displayMb,
        extraDesc: ''
    }
}

const { tabelasStore, nanosCmdsStore } = require('../utils/firebaseDataLayer')

function getGrupoEntry(store, groupId) {
    if (!store || !groupId) return null
    if (store[groupId]) return store[groupId]
    const dotFormat = groupId.replace(/\./g, '___dot___')
    if (store[dotFormat]) return store[dotFormat]
    const cleanFormat = groupId.replace(/___dot___/g, '.')
    if (store[cleanFormat]) return store[cleanFormat]
    return null
}

function loadGruposTabelas() {
    return tabelasStore.loadSync() || {}
}

function saveGruposTabelas(data) {
    tabelasStore.save(data)
    return true
}

function obterTabelaMegasGrupo(groupId) {
    if (!groupId) return null
    const tabelas = loadGruposTabelas()
    const gTab = getGrupoEntry(tabelas, groupId)
    const partes = []

    if (gTab?.tabelaMegas) {
        partes.push(gTab.tabelaMegas)
    }

    if (gTab?.tabelaDiarios || gTab?.tabelaDiario) {
        partes.push(`\n\n📱 PACOTES DIÁRIOS (24h)\n${gTab.tabelaDiarios || gTab.tabelaDiario}`)
    }

    if (gTab?.tabelaSemanal) {
        partes.push(`\n\n📦 PACOTES SEMANAL (7d)\n${gTab.tabelaSemanal}`)
    }

    if (gTab?.tabelaMensal) {
        partes.push(`\n\n📦 PACOTES MENSAL (30d)\n${gTab.tabelaMensal}`)
    }

    if (gTab?.tabelaDiamante) {
        partes.push(`\n\n👑 TUDO TOP / DIAMANTE (30d)\n${gTab.tabelaDiamante}`)
    }

    const groupConfig = loadGroupConfig()
    const gCfg = getGrupoEntry(groupConfig, groupId)
    const cfgTab = gCfg?.textoTabela || gCfg?.tabela
    if (cfgTab && !partes.some(p => p.includes(cfgTab))) partes.push(cfgTab)

    if (partes.length === 0) {
        try {
            const nanosData = nanosCmdsStore.loadSync() || {}
            const gNano = getGrupoEntry(nanosData, groupId) || {}
            const textoNano = gNano.tabela || gNano.precos || gNano.preco
            if (textoNano) partes.push(textoNano)
        } catch {}
    }

    if (partes.length > 0) {
        return partes.join('\n\n')
    }

    return null
}

function obterTabelaDiariosGrupo(groupId) {
    if (!groupId) return null
    const tabelas = loadGruposTabelas()
    if (tabelas[groupId]?.tabelaDiarios) return tabelas[groupId].tabelaDiarios
    if (tabelas[groupId]?.tabelaDiario) return tabelas[groupId].tabelaDiario
    return null
}

function salvarTabelaDiariosGrupo(groupId, texto) {
    if (!groupId) return false
    const tabelas = loadGruposTabelas()
    if (!tabelas[groupId]) tabelas[groupId] = {}
    if (texto && texto.trim().length > 0) {
        tabelas[groupId].tabelaDiarios = texto.trim()
    } else {
        delete tabelas[groupId].tabelaDiarios
        delete tabelas[groupId].tabelaDiario
    }
    tabelas[groupId].atualizadoEm = new Date().toISOString()
    saveGruposTabelas(tabelas)

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (nanosData[groupId]) {
            if (texto && texto.trim().length > 0) {
                nanosData[groupId].diarios = texto.trim()
            } else {
                delete nanosData[groupId].diarios
                delete nanosData[groupId].diario
            }
            nanosCmdsStore.save(nanosData)
        }
    } catch {}

    return true
}

function obterTabelaSemanalGrupo(groupId) {
    if (!groupId) return null
    const tabelas = loadGruposTabelas()
    if (tabelas[groupId]?.tabelaSemanal) return tabelas[groupId].tabelaSemanal

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (nanosData[groupId]?.semanal) return nanosData[groupId].semanal
    } catch {}
    return null
}

function obterTabelaMensalGrupo(groupId) {
    if (!groupId) return null
    const tabelas = loadGruposTabelas()
    if (tabelas[groupId]?.tabelaMensal) return tabelas[groupId].tabelaMensal

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (nanosData[groupId]?.mensal) return nanosData[groupId].mensal
    } catch {}
    return null
}

function obterTabelaDiamanteGrupo(groupId) {
    if (!groupId) return null
    const tabelas = loadGruposTabelas()
    if (tabelas[groupId]?.tabelaDiamante) return tabelas[groupId].tabelaDiamante

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (nanosData[groupId]?.diamante) return nanosData[groupId].diamante
        if (nanosData[groupId]?.tudotop) return nanosData[groupId].tudotop
    } catch {}
    return null
}

function obterTabelaSaldoGrupo(groupId) {
    if (!groupId) return null
    const tabelas = loadGruposTabelas()
    if (tabelas[groupId]?.tabelaSaldo) return tabelas[groupId].tabelaSaldo

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        const textoNano = nanosData[groupId]?.tabelasaldo || nanosData[groupId]?.saldo || nanosData[groupId]?.precossaldo
        if (textoNano) return textoNano
    } catch {}

    return null
}

function salvarTabelaMegasGrupo(groupId, texto) {
    if (!groupId) return false
    const tabelas = loadGruposTabelas()
    if (!tabelas[groupId]) tabelas[groupId] = {}
    if (texto && texto.trim().length > 0) {
        tabelas[groupId].tabelaMegas = texto.trim()
    } else {
        delete tabelas[groupId].tabelaMegas
        delete tabelas[groupId].tabela
    }
    tabelas[groupId].atualizadoEm = new Date().toISOString()
    saveGruposTabelas(tabelas)

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (!nanosData[groupId]) nanosData[groupId] = {}
        if (texto && texto.trim().length > 0) {
            nanosData[groupId].tabela = texto.trim()
        } else {
            delete nanosData[groupId].tabela
        }
        nanosCmdsStore.save(nanosData)
    } catch {}

    return true
}

function salvarTabelaSemanalGrupo(groupId, texto) {
    if (!groupId) return false
    const tabelas = loadGruposTabelas()
    if (!tabelas[groupId]) tabelas[groupId] = {}
    if (texto && texto.trim().length > 0) {
        tabelas[groupId].tabelaSemanal = texto.trim()
    } else {
        delete tabelas[groupId].tabelaSemanal
    }
    tabelas[groupId].atualizadoEm = new Date().toISOString()
    saveGruposTabelas(tabelas)

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (!nanosData[groupId]) nanosData[groupId] = {}
        if (texto && texto.trim().length > 0) {
            nanosData[groupId].semanal = texto.trim()
        } else {
            delete nanosData[groupId].semanal
        }
        nanosCmdsStore.save(nanosData)
    } catch {}
    return true
}

function salvarTabelaMensalGrupo(groupId, texto) {
    if (!groupId) return false
    const tabelas = loadGruposTabelas()
    if (!tabelas[groupId]) tabelas[groupId] = {}
    if (texto && texto.trim().length > 0) {
        tabelas[groupId].tabelaMensal = texto.trim()
    } else {
        delete tabelas[groupId].tabelaMensal
    }
    tabelas[groupId].atualizadoEm = new Date().toISOString()
    saveGruposTabelas(tabelas)

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (!nanosData[groupId]) nanosData[groupId] = {}
        if (texto && texto.trim().length > 0) {
            nanosData[groupId].mensal = texto.trim()
        } else {
            delete nanosData[groupId].mensal
        }
        nanosCmdsStore.save(nanosData)
    } catch {}
    return true
}

function salvarTabelaDiamanteGrupo(groupId, texto) {
    if (!groupId) return false
    const tabelas = loadGruposTabelas()
    if (!tabelas[groupId]) tabelas[groupId] = {}
    if (texto && texto.trim().length > 0) {
        tabelas[groupId].tabelaDiamante = texto.trim()
    } else {
        delete tabelas[groupId].tabelaDiamante
    }
    tabelas[groupId].atualizadoEm = new Date().toISOString()
    saveGruposTabelas(tabelas)

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (!nanosData[groupId]) nanosData[groupId] = {}
        if (texto && texto.trim().length > 0) {
            nanosData[groupId].diamante = texto.trim()
            nanosData[groupId].tudotop = texto.trim()
        } else {
            delete nanosData[groupId].diamante
            delete nanosData[groupId].tudotop
        }
        nanosCmdsStore.save(nanosData)
    } catch {}
    return true
}

function salvarTabelaSaldoGrupo(groupId, texto) {
    if (!groupId) return false
    const tabelas = loadGruposTabelas()
    if (!tabelas[groupId]) tabelas[groupId] = {}
    if (texto && texto.trim().length > 0) {
        tabelas[groupId].tabelaSaldo = texto.trim()
    } else {
        delete tabelas[groupId].tabelaSaldo
        delete tabelas[groupId].tabelasaldo
    }
    tabelas[groupId].atualizadoEm = new Date().toISOString()
    saveGruposTabelas(tabelas)

    try {
        const nanosData = nanosCmdsStore.loadSync() || {}
        if (!nanosData[groupId]) nanosData[groupId] = {}
        if (texto && texto.trim().length > 0) {
            nanosData[groupId].tabelasaldo = texto.trim()
        } else {
            delete nanosData[groupId].tabelasaldo
            delete nanosData[groupId].saldo
            delete nanosData[groupId].precossaldo
        }
        nanosCmdsStore.save(nanosData)
    } catch {}
    return true
}

function calcularMegas(valor, groupId) {
    const v = parseFloat(valor)
    if (isNaN(v) || v <= 0) return null

    const pacotes = obterTodosPacotesPorValor(v, groupId)
    if (pacotes && pacotes.length > 0) {
        return pacotes[0]
    }

    if (groupId) {
        const textoTabela = obterTabelaMegasGrupo(groupId)
        if (textoTabela && typeof textoTabela === 'string') {
            return calcularMegasPorTexto(v, textoTabela)
        }
    }

    return null
}

function parsearTabelaSaldo(textoSaldo) {
    if (!textoSaldo) return []
    const resultados = []
    const textoLimpo = normalizarTextoTabela(textoSaldo).replace(/\*/g, '')
    const linhas = textoLimpo.split('\n')

    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i].trim()
        if (!linha || linha.length < 3) continue

        let saldo = null
        let preco = null

        // 1. Tenta formato: <preco> MT ... <saldo> saldo (mais comum)
        const matchB = linha.match(/(?:^|[^\d.,])([\d.,]+)\s*(?:MT[Ss]?|mzn|meticais)\b.*?(\d[\d\s.,]*)\s*(?:saldo|Saldo|s)\b/i)
        // 2. Tenta formato: <saldo> saldo ... <preco> MT
        const matchA = linha.match(/(?:^|[^\d.,])([\d.,]+)\s*(?:saldo|Saldo|s)\b.*?(\d[\d\s.,]*)\s*(?:MT[Ss]?|mzn|meticais)\b/i)
        // 3. Fallback: <preco> MT ... <saldo> (número puro após separador)
        const matchBFallback = !matchB && !matchA ? linha.match(/(?:^|[^\d.,])([\d.,]+)\s*(?:MT[Ss]?|mzn|meticais)\b.*?(\d[\d\s.,]*)/i) : null

        if (matchB) {
            preco = limparNumeroTabela(matchB[1])
            saldo = limparNumeroTabela(matchB[2])
        } else if (matchA) {
            saldo = limparNumeroTabela(matchA[1])
            preco = limparNumeroTabela(matchA[2])
        } else if (matchBFallback) {
            preco = limparNumeroTabela(matchBFallback[1])
            saldo = limparNumeroTabela(matchBFallback[2])
        }

        if (saldo !== null && preco !== null && saldo > 0 && preco > 0) {
            const jaTem = resultados.some(r => r.saldo === saldo && r.preco === preco)
            if (!jaTem) {
                resultados.push({ saldo: Math.round(saldo), preco: parseFloat(preco.toFixed(2)) })
            }
        }
    }

    return resultados
}

function encontrarPrecoSaldoNaTabela(saldoDesejado, groupId) {
    const s = parseInt(saldoDesejado, 10)
    if (isNaN(s) || s <= 0) return null

    if (groupId) {
        const textoSaldo = obterTabelaSaldoGrupo(groupId)
        if (textoSaldo && typeof textoSaldo === 'string') {
            const entradas = parsearTabelaSaldo(textoSaldo)
            for (const e of entradas) {
                if (e.saldo === s) {
                    return e.preco
                }
            }
        }
    }

    return null
}

function calcularSaldo(valor, groupId) {
    const v = parseFloat(valor)
    if (isNaN(v) || v <= 0) return null

    if (groupId) {
        const textoSaldo = obterTabelaSaldoGrupo(groupId)
        if (textoSaldo && typeof textoSaldo === 'string') {
            const entradas = parsearTabelaSaldo(textoSaldo)
            for (const e of entradas) {
                if (e.preco === v) {
                    return { saldo: e.saldo, preco: e.preco, tipo: 'Saldo' }
                }
            }
        }
    }

    return { saldo: v, preco: v, tipo: 'Saldo' }
}

function obterTodosPacotesPorValor(valor, groupId) {
    const v = parseFloat(valor)
    if (isNaN(v) || v <= 0) return []

    const pacotesEncontrados = []
    let textoTabela = null

    if (groupId) {
        textoTabela = obterTabelaMegasGrupo(groupId)
    }

    if (textoTabela && typeof textoTabela === 'string') {
        const entradas = parsearTabela(textoTabela)
        for (const e of entradas) {
            if (e.preco === v) {
                const tipoPadrao = padronizarTipo(e.tipo || 'Diário')
                const display = formatarDisplay(e.mb, e.extraDesc || '', tipoPadrao)
                
                const jaExiste = pacotesEncontrados.some(p => p.tipo === tipoPadrao && Math.abs(Number(p.mb) - Number(e.mb)) < 50)
                if (!jaExiste) {
                    pacotesEncontrados.push({
                        gb: display,
                        mb: e.mb.toString(),
                        tipo: tipoPadrao,
                        extraDesc: e.extraDesc || '',
                        preco: e.preco
                    })
                }
            }
        }
    }

    if (groupId) {
        const textoSaldo = obterTabelaSaldoGrupo(groupId)
        if (textoSaldo && typeof textoSaldo === 'string') {
            const entradasSaldo = parsearTabelaSaldo(textoSaldo)
            for (const s of entradasSaldo) {
                if (s.preco === v) {
                    const jaExisteSaldo = pacotesEncontrados.some(p => p.tipo === 'Saldo' && Math.abs(Number(p.mb) - Number(s.saldo)) < 1)
                    if (!jaExisteSaldo) {
                        pacotesEncontrados.push({
                            gb: `${s.saldo} MT (Saldo)`,
                            mb: s.saldo.toString(),
                            tipo: 'Saldo',
                            extraDesc: '',
                            preco: s.preco
                        })
                    }
                }
            }
        }
    }

    return pacotesEncontrados
}

function formatarDisplay(mb, extraDesc = '', tipo = '') {
    let base = ''
    if (mb >= 1024) {
        const gbVal = mb / 1024
        base = Number.isInteger(gbVal) ? `${gbVal}GB` : `${gbVal.toFixed(1)}GB`
    } else {
        base = `${Math.round(mb)}MB`
    }

    if (extraDesc) {
        return `${base}${extraDesc}`
    } else if (tipo === 'Ilimitado' || tipo === 'Diamante') {
        return `${base} + Chamadas & SMS Ilimitadas`
    }
    return base
}

function encontrarPrecoMegasNaTabela(megasDesejados, groupId) {
    if (!megasDesejados || megasDesejados <= 0) return null

    const textoTabela = obterTabelaMegasGrupo(groupId)
    if (textoTabela && typeof textoTabela === 'string') {
        const entradas = parsearTabela(textoTabela)
        for (const e of entradas) {
            if (e.mb === Number(megasDesejados)) {
                return e.preco
            }
        }
        return null
    }

    return null
}

function encontrarPrecoSaldoNaTabela(saldoDesejado, groupId) {
    if (!saldoDesejado || saldoDesejado <= 0) return null

    const textoSaldo = obterTabelaSaldoGrupo(groupId)
    if (textoSaldo && typeof textoSaldo === 'string') {
        const entradasSaldo = parsearTabelaSaldo(textoSaldo)
        for (const s of entradasSaldo) {
            if (Number(s.saldo) === Number(saldoDesejado)) {
                return s.preco
            }
        }
    }
    return null
}

module.exports = {
    calcularMegas,
    calcularMegasPorTexto,
    calcularSaldo,
    buscarDadosPorPacoteNaTabela,
    obterTabelaMegasGrupo,
    obterTabelaDiariosGrupo,
    obterTabelaSemanalGrupo,
    obterTabelaMensalGrupo,
    obterTabelaDiamanteGrupo,
    obterTabelaSaldoGrupo,
    salvarTabelaMegasGrupo,
    salvarTabelaDiariosGrupo,
    salvarTabelaSemanalGrupo,
    salvarTabelaMensalGrupo,
    salvarTabelaDiamanteGrupo,
    salvarTabelaSaldoGrupo,
    parsearTabela,
    parsearTabelaSaldo,
    encontrarPrecoMegasNaTabela,
    encontrarPrecoSaldoNaTabela,
    obterTodosPacotesPorValor,
    formatarDisplay,
    padronizarTipo,
    normalizarTextoTabela
}
