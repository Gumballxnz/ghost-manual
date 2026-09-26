const fs = require('fs')
const path = require('path')
const config = require('../../data/config.json')
const { nanoCmdsStore, nanosCmdsStore, groupConfigStore, tabelasStore } = require('../utils/firebaseDataLayer')

const nanoPath = path.join(__dirname, '../../data/nanoCmds.json')
const nanosPath = path.join(__dirname, '../../data/nanosCmds.json')

let nanoCmds = {}
let nanosCmds = {}

try { nanoCmds = JSON.parse(fs.readFileSync(nanoPath, 'utf8')) } catch { nanoCmds = {} }
try { nanosCmds = JSON.parse(fs.readFileSync(nanosPath, 'utf8')) } catch { nanosCmds = {} }

function getGrupoObj(storeObj, groupId) {
    if (!storeObj || !groupId) return null
    if (storeObj[groupId]) return storeObj[groupId]
    const dotFormat = groupId.replace(/\./g, '___dot___')
    if (storeObj[dotFormat]) return storeObj[dotFormat]
    const cleanFormat = groupId.replace(/___dot___/g, '.')
    if (storeObj[cleanFormat]) return storeObj[cleanFormat]
    return null
}

function salvarNano() {
    try { fs.writeFileSync(nanoPath, JSON.stringify(nanoCmds, null, 2)) } catch {}
    try { nanoCmdsStore.save(nanoCmds) } catch {}
}

function salvarNanos() {
    try { fs.writeFileSync(nanosPath, JSON.stringify(nanosCmds, null, 2)) } catch {}
    try { nanosCmdsStore.save(nanosCmds) } catch {}
}

function addNanoCommand(groupId, nome, resposta) {
    if (!nanoCmds[groupId]) nanoCmds[groupId] = {}
    nanoCmds[groupId][nome] = resposta
    salvarNano()
    if (nome && (nome.toLowerCase() === 'tabela' || nome.toLowerCase() === 'precos' || nome.toLowerCase() === 'preços')) {
        try {
            const { salvarTabelaMegasGrupo } = require('../vendas/tabela')
            salvarTabelaMegasGrupo(groupId, resposta)
        } catch (e) {
            console.error('[NANO] Erro ao sincronizar tabela:', e.message)
        }
    }
}

function addNanosCommand(groupId, nome, resposta) {
    if (!nanosCmds[groupId]) nanosCmds[groupId] = {}
    nanosCmds[groupId][nome] = resposta
    salvarNanos()
    if (nome && (nome.toLowerCase() === 'tabela' || nome.toLowerCase() === 'precos' || nome.toLowerCase() === 'preços')) {
        try {
            const { salvarTabelaMegasGrupo } = require('../vendas/tabela')
            salvarTabelaMegasGrupo(groupId, resposta)
        } catch (e) {
            console.error('[NANOS] Erro ao sincronizar tabela:', e.message)
        }
    }
}

function getExactNanoCommand(groupId, nome) {
    if (!groupId || !nome) return null
    const busca = nome.trim().toLowerCase()
    if (!busca) return null

    const firebaseNanoCmds = nanoCmdsStore?.getCache() || {}
    const localNano = getGrupoObj(nanoCmds, groupId) || getGrupoObj(firebaseNanoCmds, groupId)
    if (localNano) {
        if (localNano[nome]) return localNano[nome]
        for (const chave of Object.keys(localNano)) {
            if (chave.toLowerCase() === busca) return localNano[chave]
        }
        for (const chave of Object.keys(localNano)) {
            if (chave.toLowerCase().startsWith(busca)) return localNano[chave]
        }
    }
    return null
}

function getNanoCommand(groupId, nome) {
    if (!groupId || !nome) return null
    const busca = nome.trim().toLowerCase()
    if (!busca) return null

    if (busca === 'tabela' || busca === 'tabelas' || busca === 'precos' || busca === 'preços') {
        try {
            const { obterTabelaMegasGrupo } = require('../vendas/tabela')
            const tabOficial = obterTabelaMegasGrupo(groupId)
            if (tabOficial) return tabOficial
        } catch {}
        const tabelas = tabelasStore.getCache() || {}
        const gTab = getGrupoObj(tabelas, groupId)
        if (gTab?.tabelaMegas) return gTab.tabelaMegas
        if (gTab?.tabelaDiarios) return gTab.tabelaDiarios
        const groupConfig = groupConfigStore.getCache() || {}
        const gCfg = getGrupoObj(groupConfig, groupId)
        if (gCfg?.textoTabela) return gCfg.textoTabela
        if (gCfg?.tabela) return gCfg.tabela

    }

    const firebaseNanoCmds = nanoCmdsStore?.getCache() || {}
    const localNano = getGrupoObj(nanoCmds, groupId) || getGrupoObj(firebaseNanoCmds, groupId)
    if (localNano) {
        if (localNano[nome]) return localNano[nome]
        for (const chave of Object.keys(localNano)) {
            if (chave.toLowerCase() === busca) return localNano[chave]
        }
        for (const chave of Object.keys(localNano)) {
            if (chave.toLowerCase().startsWith(busca)) return localNano[chave]
        }
    }

    const firebaseNanos = nanosCmdsStore.getCache() || {}
    const fbNano = getGrupoObj(firebaseNanos, groupId) || getGrupoObj(nanosCmds, groupId)
    if (fbNano) {
        if (fbNano[nome]) return fbNano[nome]
        for (const chave of Object.keys(fbNano)) {
            if (chave.toLowerCase() === busca) return fbNano[chave]
        }
        for (const chave of Object.keys(fbNano)) {
            if (chave.toLowerCase().startsWith(busca)) return fbNano[chave]
        }
    }

    if (busca === 'pagamento' || busca === 'pagamentos' || busca === 'conta' || busca === 'contas') {
        const groupConfig = groupConfigStore.getCache() || {}
        const gCfg = getGrupoObj(groupConfig, groupId)
        if (gCfg?.contas) return gCfg.contas
        if (gCfg?.pagamento) return gCfg.pagamento
    }

    return null
}

function getNanosCommand(groupId, textoOriginal) {
    if (!groupId || !textoOriginal) return null
    const texto = textoOriginal.trim().toLowerCase()
    if (!texto) return null

    const firebaseNanos = nanosCmdsStore.getCache() || {}
    const grupoNanos = getGrupoObj(nanosCmds, groupId) || getGrupoObj(firebaseNanos, groupId)
    if (!grupoNanos) return null

    const chaves = Object.keys(grupoNanos)

    for (const chave of chaves) {
        const chaveLower = chave.toLowerCase().trim()
        if (!chaveLower) continue

        if (chaveLower === 'tabela' || chaveLower === 'precos' || chaveLower === 'preço' || chaveLower === 'tabelas') {
            const isTabelaQuery = /^((\.|\/|!)?tabelas?|(\.|\/|!)?pre[çc]os?|manda a? tabela|pe[çc]o a? tabela|ver a? tabela|qual [eé] a? tabela|envia a? tabela)$/i.test(texto)
            if (isTabelaQuery) {
                return grupoNanos[chave]
            }
            continue
        }

        const regexChave = new RegExp(`\\b${chaveLower.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i')
        if (regexChave.test(texto)) {
            return grupoNanos[chave]
        }
    }

    return null
}

function deleteNanoCommand(groupId, nome) {
    if (!groupId || !nome) return false
    const busca = nome.trim().toLowerCase()
    const dotFormat = groupId.replace(/\./g, '___dot___')
    const cleanFormat = groupId.replace(/___dot___/g, '.')

    let deleted = false
    for (const gid of [groupId, dotFormat, cleanFormat]) {
        if (nanoCmds[gid]) {
            for (const key of Object.keys(nanoCmds[gid])) {
                if (key.trim().toLowerCase() === busca) {
                    delete nanoCmds[gid][key]
                    deleted = true
                }
            }
        }
    }
    if (deleted) {
        salvarNano()
        if (busca === 'tabela' || busca === 'precos' || busca === 'preços') {
            try {
                const { salvarTabelaMegasGrupo } = require('../vendas/tabela')
                salvarTabelaMegasGrupo(groupId, '')
            } catch {}
        }
    }
    return deleted
}

function deleteNanosCommand(groupId, nome) {
    if (!groupId || !nome) return false
    const busca = nome.trim().toLowerCase()
    const dotFormat = groupId.replace(/\./g, '___dot___')
    const cleanFormat = groupId.replace(/___dot___/g, '.')

    let deleted = false
    for (const gid of [groupId, dotFormat, cleanFormat]) {
        if (nanosCmds[gid]) {
            for (const key of Object.keys(nanosCmds[gid])) {
                if (key.trim().toLowerCase() === busca) {
                    delete nanosCmds[gid][key]
                    deleted = true
                }
            }
        }
    }
    if (deleted) {
        salvarNanos()
        if (busca === 'tabela' || busca === 'precos' || busca === 'preços') {
            try {
                const { salvarTabelaMegasGrupo } = require('../vendas/tabela')
                salvarTabelaMegasGrupo(groupId, '')
            } catch {}
        }
    }
    return deleted
}

function clearNanoCommands(groupId) {
    if (!groupId) return 0
    const dotFormat = groupId.replace(/\./g, '___dot___')
    const cleanFormat = groupId.replace(/___dot___/g, '.')
    let count = 0

    for (const gid of [groupId, dotFormat, cleanFormat]) {
        if (nanoCmds[gid]) {
            count += Object.keys(nanoCmds[gid]).length
            delete nanoCmds[gid]
        }
    }
    if (count > 0) salvarNano()
    return count
}

function clearNanosCommands(groupId) {
    if (!groupId) return 0
    const dotFormat = groupId.replace(/\./g, '___dot___')
    const cleanFormat = groupId.replace(/___dot___/g, '.')
    let count = 0

    for (const gid of [groupId, dotFormat, cleanFormat]) {
        if (nanosCmds[gid]) {
            count += Object.keys(nanosCmds[gid]).length
            delete nanosCmds[gid]
        }
    }
    if (count > 0) salvarNanos()
    return count
}

function listNanoCommands(groupId) {
    const firebaseNanoCmds = nanoCmdsStore?.getCache() || {}
    const local = getGrupoObj(nanoCmds, groupId) || getGrupoObj(firebaseNanoCmds, groupId)
    return local ? Object.keys(local) : []
}

function listNanosCommands(groupId) {
    const firebaseNanos = nanosCmdsStore.getCache() || {}
    const obj = getGrupoObj(nanosCmds, groupId) || getGrupoObj(firebaseNanos, groupId)
    return obj ? Object.keys(obj) : []
}

function copyNanoCommands(sourceGroupId, targetGroupId) {
    if (!nanoCmds[sourceGroupId] || Object.keys(nanoCmds[sourceGroupId]).length === 0) {
        return 0
    }
    if (!nanoCmds[targetGroupId]) nanoCmds[targetGroupId] = {}

    let count = 0
    for (const [nome, resposta] of Object.entries(nanoCmds[sourceGroupId])) {
        nanoCmds[targetGroupId][nome] = resposta
        count++
    }
    salvarNano()
    return count
}

function copyNanosCommands(sourceGroupId, targetGroupId) {
    if (!nanosCmds[sourceGroupId] || Object.keys(nanosCmds[sourceGroupId]).length === 0) {
        return 0
    }
    if (!nanosCmds[targetGroupId]) nanosCmds[targetGroupId] = {}

    let count = 0
    for (const [nome, resposta] of Object.entries(nanosCmds[sourceGroupId])) {
        nanosCmds[targetGroupId][nome] = resposta
        count++
    }
    salvarNanos()
    return count
}

module.exports = {
    addNanoCommand, getNanoCommand, getExactNanoCommand, deleteNanoCommand, clearNanoCommands, listNanoCommands, copyNanoCommands,
    addNanosCommand, getNanosCommand, deleteNanosCommand, clearNanosCommands, listNanosCommands, copyNanosCommands
}
