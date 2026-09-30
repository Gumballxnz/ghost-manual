const fs = require('fs')
const path = require('path')

const plugins = []
const commandMap = new Map()
let isLoaded = false

function scanDir(dirPath, defaultCategory = 'adm') {
    if (!fs.existsSync(dirPath)) return []

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            files.push(...scanDir(fullPath, defaultCategory))
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push({ fullPath, fileName: entry.name, defaultCategory })
        }
    }
    return files
}

function loadPlugins() {
    if (isLoaded) return plugins

    plugins.length = 0
    commandMap.clear()

    const admDir = path.join(__dirname, 'adm')
    const membrosDir = path.join(__dirname, 'membros')

    const fileList = [
        ...scanDir(admDir, 'adm'),
        ...scanDir(membrosDir, 'membros')
    ]

    for (const item of fileList) {
        try {

            if (item.fileName === 'pluginManager.js' || item.fileName === 'loader.js') continue

            const mod = require(item.fullPath)
            if (!mod) continue

            const execute = typeof mod === 'function' ? mod : (typeof mod.execute === 'function' ? mod.execute : null)
            if (!execute) continue

            const baseName = path.basename(item.fileName, '.js').toLowerCase()
            const name = (mod.nome || mod.name || baseName).toLowerCase()
            const aliases = Array.isArray(mod.aliases) ? mod.aliases.map(a => String(a).toLowerCase()) : []
            const categoria = (mod.categoria || mod.category || item.defaultCategory || 'adm').toLowerCase()
            const subcategoria = mod.subcategoria || mod.subcategory || 'GERAL'
            const descricao = mod.descricao || mod.description || ''
            const uso = mod.uso || mod.usage || `.${name}`
            const apenasDono = Boolean(mod.apenasDono || mod.ownerOnly)
            const apenasAdmin = Boolean(mod.apenasAdmin || mod.adminOnly)

            const pluginData = {
                name,
                aliases,
                categoria,
                subcategoria,
                descricao,
                uso,
                apenasDono,
                apenasAdmin,
                filePath: item.fullPath,
                fileName: item.fileName,
                execute
            }

            plugins.push(pluginData)

            commandMap.set(name, pluginData)
            for (const alias of aliases) {
                if (!commandMap.has(alias)) {
                    commandMap.set(alias, pluginData)
                }
            }
        } catch (err) {
            console.error(`[PLUGIN-LOADER] Erro ao carregar comando ${item.fileName}:`, err.message)
        }
    }

    isLoaded = true
    console.log(`[PLUGIN-LOADER] 🚀 ${plugins.length} comandos/plugins carregados com sucesso!`)
    return plugins
}

function getPlugins() {
    if (!isLoaded) loadPlugins()
    return plugins
}

function getPluginsByCategory(cat) {
    const list = getPlugins()
    if (!cat) return list
    const searchCat = cat.toLowerCase()
    return list.filter(p => p.categoria === searchCat)
}

async function dispatch(sock, msg, from, sender, text) {
    if (!isLoaded) loadPlugins()

    if (!text || typeof text !== 'string') return false
    const trimmed = text.trim()
    if (!trimmed) return false

    const config = require('../../data/config.json')
    const basePrefix = config.prefix || '.'
    if (!trimmed.startsWith(basePrefix)) {
        return false
    }

    const rawCmd = trimmed.toLowerCase().split(/\s+/)[0]
    const cmdName = rawCmd.slice(basePrefix.length)
    if (!cmdName) return false

    const directMatch = commandMap.get(cmdName)
    if (directMatch && typeof directMatch.execute === 'function') {
        try {
            const res = await directMatch.execute(sock, msg, from, sender, text)
            if (res !== false) return true
        } catch (err) {
            console.error(`[PLUGIN] Erro na execução do comando .${cmdName}:`, err.message)
            return true
        }
    }

    for (const p of plugins) {
        if (p === directMatch) continue
        if (p.name && !cmdName.startsWith(p.name)) continue
        try {
            const handled = await p.execute(sock, msg, from, sender, text)
            if (handled === true) return true
        } catch (err) {

        }
    }

    return false
}

module.exports = {
    loadPlugins,
    getPlugins,
    getPluginsByCategory,
    dispatch
}
