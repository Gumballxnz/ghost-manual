const fs = require('fs')
const path = require('path')
const { fetchFirebase, putFirebase } = require('./firebaseConfig')

const stores = {}

function sanitizeForFirebase(data) {
    if (data === null || typeof data !== 'object') return data
    if (Array.isArray(data)) return data.map(sanitizeForFirebase)
    const result = {}
    for (const [k, v] of Object.entries(data)) {
        let safeKey = k
            .replace(/\./g, '___dot___')
            .replace(/\//g, '___slash___')
            .replace(/#/g, '___hash___')
            .replace(/\$/g, '___dollar___')
            .replace(/\[/g, '___openbracket___')
            .replace(/\]/g, '___closebracket___')
            .replace(/[\x00-\x1F\x7F]/g, '_')
        if (safeKey.length > 500) {
            safeKey = safeKey.slice(0, 500)
        }
        result[safeKey] = sanitizeForFirebase(v)
    }
    return result
}

function desanitizeFromFirebase(data) {
    if (data === null || typeof data !== 'object') return data
    if (Array.isArray(data)) return data.map(desanitizeFromFirebase)
    const result = {}
    for (const [k, v] of Object.entries(data)) {
        const origKey = k
            .replace(/___dot___/g, '.')
            .replace(/___slash___/g, '/')
            .replace(/___hash___/g, '#')
            .replace(/___dollar___/g, '$')
            .replace(/___openbracket___/g, '[')
            .replace(/___closebracket___/g, ']')
        result[origKey] = desanitizeFromFirebase(v)
    }
    return result
}

function createStore(name, firebasePath, localFallbackPath, defaultValue = {}, debounceMs = 3000) {
    if (stores[name]) return stores[name]

    let cache = null
    let loaded = false
    let saveTimer = null
    let loadPromise = null

    async function load() {
        if (cache !== null && loaded) return cache

        if (loadPromise) return loadPromise

        loadPromise = (async () => {
            try {

                const fbData = await fetchFirebase(firebasePath)

                if (fbData !== null && fbData !== undefined) {
                    cache = desanitizeFromFirebase(fbData)
                    loaded = true
                    return cache
                }

                if (localFallbackPath) {
                    const fullPath = path.isAbsolute(localFallbackPath)
                        ? localFallbackPath
                        : path.join(__dirname, '../../', localFallbackPath)

                    if (fs.existsSync(fullPath)) {
                        try {
                            const localData = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
                            cache = localData
                            loaded = true

                            putFirebase(firebasePath, sanitizeForFirebase(localData)).then(ok => {
                                if (ok) {
                                    console.log(`[FIREBASE-DL] ✅ Migrado ${name} para Firebase (${firebasePath})`)
                                    try {
                                        if (fs.existsSync(fullPath)) {
                                            fs.unlinkSync(fullPath)
                                            console.log(`[FIREBASE-DL] 🗑️ Arquivo temporário local removido: ${localFallbackPath}`)
                                        }
                                    } catch (delErr) {
                                        console.error(`[FIREBASE-DL] Aviso ao remover arquivo local ${localFallbackPath}:`, delErr.message)
                                    }
                                } else {
                                    console.error(`[FIREBASE-DL] ❌ Falha ao migrar ${name} para Firebase`)
                                }
                            })

                            return cache
                        } catch (parseErr) {
                            console.error(`[FIREBASE-DL] Erro ao ler fallback local ${name}:`, parseErr.message)
                        }
                    }
                }

                cache = typeof defaultValue === 'function' ? defaultValue() : JSON.parse(JSON.stringify(defaultValue))
                loaded = true
                return cache
            } catch (err) {
                console.error(`[FIREBASE-DL] Erro ao carregar ${name}:`, err.message)
                cache = typeof defaultValue === 'function' ? defaultValue() : JSON.parse(JSON.stringify(defaultValue))
                loaded = true
                return cache
            } finally {
                loadPromise = null
            }
        })()

        return loadPromise
    }

    function save(data, force = false) {
        if (data !== undefined && data !== null) {
            cache = data
        }
        if (!cache) return

        const doSave = () => {
            putFirebase(firebasePath, sanitizeForFirebase(cache)).then(ok => {
                if (!ok) {
                    console.error(`[FIREBASE-DL] ❌ Falha ao salvar ${name} no Firebase`)
                }
            })
        }

        if (force) {
            if (saveTimer) clearTimeout(saveTimer)
            saveTimer = null
            doSave()
        } else {
            if (saveTimer) clearTimeout(saveTimer)
            saveTimer = setTimeout(() => {
                saveTimer = null
                doSave()
            }, debounceMs)
        }
    }

    function patch(subPath, value) {
        if (!cache) cache = {}

        const keys = subPath.split('/')
        let obj = cache
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
                obj[keys[i]] = {}
            }
            obj = obj[keys[i]]
        }
        const lastKey = keys[keys.length - 1]

        if (value === undefined || value === null) {
            delete obj[lastKey]
        } else {
            obj[lastKey] = value
        }

        const fullSubPath = `${firebasePath}/${subPath}`
        const sanitizedVal = (value !== undefined && value !== null) ? sanitizeForFirebase(value) : null
        putFirebase(fullSubPath, sanitizedVal).catch(err => {
            console.error(`[FIREBASE-DL] ❌ Falha ao gravar granularmente ${fullSubPath}:`, err.message)
        })
    }

    function getCache() {
        return cache
    }

    function loadSync() {
        if (cache !== null && loaded) return cache

        load().catch(err => console.error(`[FIREBASE-DL] Erro em loadSync de ${name}:`, err.message))

        if (cache !== null) return cache

        if (localFallbackPath) {
            const fullPath = path.isAbsolute(localFallbackPath)
                ? localFallbackPath
                : path.join(__dirname, '../../', localFallbackPath)

            if (fs.existsSync(fullPath)) {
                try {
                    cache = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
                    return cache
                } catch { }
            }
        }

        return typeof defaultValue === 'function' ? defaultValue() : JSON.parse(JSON.stringify(defaultValue))
    }

    function invalidate() {
        cache = null
        loaded = false
    }

    const store = { load, loadSync, save, getCache, patch, invalidate, name, firebasePath }
    stores[name] = store
    return store
}

const groupConfigStore = createStore(
    'groupConfig',
    'bot_data/group_config',
    'data/groupConfig.json',
)

const gruposConfigStore = createStore(
    'gruposConfig',
    'bot_data/grupos_config',
    'data/grupos_config.json',
)

const carteiraStore = createStore(
    'carteira',
    'bot_data/carteiras',
    'data/usuarios_carteira.json',
)

const recibosStore = createStore(
    'recibos',
    'bot_data/recibos',
    'recibos.json',
    { usados: {}, pendentes: {} }
)

const tabelasStore = createStore(
    'tabelas',
    'bot_data/tabelas',
    'data/grupos_tabelas.json',
)

const nanosCmdsStore = createStore(
    'nanosCmds',
    'bot_data/nanos_cmds',
    'data/nanosCmds.json',
)

const nanoCmdsStore = createStore(
    'nanoCmds',
    'bot_data/nano_cmds',
    'data/nanoCmds.json',
)

const vendasStore = createStore(
    'vendas',
    'bot_data/vendas',
    'vendas.json',
)

const licencasStore = createStore(
    'licencas',
    'bot_data/licencas',
    'data/licencas.json',
)

const manualCounterStore = createStore(
    'manualCounter',
    'bot_data/manual_counter',
    'data/manualSaleCounter.json',
    { date: '', contador: 0 }
)

const sessoesStore = createStore(
    'sessoes',
    'bot_data/sessoes',
    null,
    {},
    2000
)

const contasStore = createStore(
    'contasAutorizadas',
    'bot_data/contas_autorizadas',
    'data/contasAutorizadas.json',
)

const mutesStore = createStore(
    'mutes',
    'bot_data/mutes',
    'data/mutes.json',
)

const bemvindoStore = createStore(
    'bemvindo',
    'bot_data/bemvindo',
    'data/bemvindo.json',
)

const botStatusStore = createStore(
    'botStatus',
    'bot_data/bot_status',
    'data/botStatus.json',
    { ativo: true }
)

const concorrentesStore = createStore(
    'concorrentes',
    'bot_data/concorrentes',
    'concorrentes.json',
)

const avisosStore = createStore(
    'avisos',
    'bot_data/avisos',
    'avisos.json',
)

async function preloadAll() {
    console.log('[FIREBASE-DL] Pré-carregando dados do Firebase...')
    const start = Date.now()

    const results = await Promise.allSettled([
        groupConfigStore.load(),
        gruposConfigStore.load(),
        carteiraStore.load(),
        recibosStore.load(),
        tabelasStore.load(),
        nanosCmdsStore.load(),
        nanoCmdsStore.load(),
        vendasStore.load(),
        licencasStore.load(),
        contasStore.load(),
        mutesStore.load(),
        bemvindoStore.load(),
        avisosStore.load(),
        botStatusStore.load(),
        concorrentesStore.load(),
        manualCounterStore.load(),
        sessoesStore.load()
    ])

    const elapsed = Date.now() - start
    const ok = results.filter(r => r.status === 'fulfilled').length
    const fail = results.filter(r => r.status === 'rejected').length
    console.log(`[FIREBASE-DL] ✅ Pré-carregamento completo em ${elapsed}ms (${ok} OK, ${fail} falhas)`)
}

const localClaimedMessages = new Set()

async function claimGlobalMessage(msgId) {
    if (!msgId) return true

    if (localClaimedMessages.has(msgId)) return false
    localClaimedMessages.add(msgId)

    if (localClaimedMessages.size > 5000) {
        const it = localClaimedMessages.values()
        for (let i = 0; i < 2000; i++) localClaimedMessages.delete(it.next().value)
    }

    return true
}

setInterval(async () => {
    try {
        const allClaimed = await fetchFirebase('bot_data/claimed_messages')
        if (allClaimed && typeof allClaimed === 'object') {
            const now = Date.now()
            for (const [id, val] of Object.entries(allClaimed)) {
                if (val && val.claimedAt && (now - val.claimedAt > 5 * 60 * 1000)) {
                    putFirebase(`bot_data/claimed_messages/${id}`, null)
                }
            }
        }
    } catch {}
}, 10 * 60 * 1000)

module.exports = {

    createStore,

    groupConfigStore,
    gruposConfigStore,
    carteiraStore,
    recibosStore,
    tabelasStore,
    nanosCmdsStore,
    nanoCmdsStore,
    vendasStore,
    licencasStore,
    manualCounterStore,
    sessoesStore,
    contasStore,
    mutesStore,
    bemvindoStore,
    botStatusStore,
    concorrentesStore,
    avisosStore,

    preloadAll,
    claimGlobalMessage
}
