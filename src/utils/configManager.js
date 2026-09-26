const { groupConfigStore, concorrentesStore } = require('./firebaseDataLayer')

function loadGroupConfig() {
    return groupConfigStore.loadSync() || {}
}

function loadConcorrentes() {
    return concorrentesStore.loadSync() || {}
}

function saveGroupConfig(dataOrForce = false, forceParam = false) {
    let data = groupConfigStore.getCache()
    let force = false
    if (dataOrForce && typeof dataOrForce === 'object') {
        data = dataOrForce
        force = forceParam || true
    } else if (typeof dataOrForce === 'boolean') {
        force = dataOrForce
    }

    if (typeof data !== 'object' || data === null) {
        console.error('[ConfigManager] BLOQUEADO: tentativa de salvar groupConfig corrompido:', typeof data)
        return
    }

    groupConfigStore.save(data, force)
}

function saveConcorrentes(data = null, force = false) {
    concorrentesStore.save(data || concorrentesStore.getCache(), force)
}

let fbSuporteCache = null

function setSuporteCache(novoNum) {
    if (novoNum && typeof novoNum === 'string') {
        fbSuporteCache = novoNum.trim().replace(/\D/g, '')
    } else if (!novoNum) {
        fbSuporteCache = null
    }
}

async function sincronizarSuporteFirebase() {
    try {
        const { fetchFirebase } = require('./firebaseConfig')
        const fbSup = await fetchFirebase('bot_data/suporteNumber')
        if (fbSup && typeof fbSup === 'string' && fbSup.trim().length >= 8) {
            fbSuporteCache = fbSup.trim().replace(/\D/g, '')
        }
    } catch {}
}
setTimeout(() => { sincronizarSuporteFirebase().catch(() => {}) }, 1200)

function getSuporteNumber() {
    if (fbSuporteCache) return fbSuporteCache
    try {
        const fs = require('fs')
        const path = require('path')
        const cfgPath = path.join(__dirname, '../../data/config.json')
        if (fs.existsSync(cfgPath)) {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
            if (cfg.suporteNumber) {
                fbSuporteCache = String(cfg.suporteNumber).replace(/\D/g, '')
                return fbSuporteCache
            }
        }
    } catch {}
    return null
}

function getPrefixForChat(from) {
    if (from && from.endsWith('@g.us')) {
        const groupConfig = loadGroupConfig()
        const cfg = groupConfig[from] || groupConfig[from.replace(/\./g, '___dot___')] || groupConfig[from.replace(/___dot___/g, '.')]
        if (cfg && cfg.prefix && typeof cfg.prefix === 'string' && cfg.prefix.trim()) {
            return cfg.prefix.trim()
        }
    }
    try {
        const { getDynamicConfig } = require('./baileys')
        const dynCfg = getDynamicConfig()
        if (dynCfg && dynCfg.prefix && typeof dynCfg.prefix === 'string') {
            return dynCfg.prefix.trim()
        }
    } catch {}
    return '.'
}

function setGroupPrefix(groupId, newPrefix) {
    if (!groupId || !groupId.endsWith('@g.us')) return false
    const groupConfig = loadGroupConfig()
    const safeKey = groupId.replace(/\./g, '___dot___')
    if (!groupConfig[safeKey] && !groupConfig[groupId]) {
        groupConfig[safeKey] = {}
    }
    const target = groupConfig[safeKey] || groupConfig[groupId]
    if (!newPrefix || newPrefix === 'reset' || newPrefix === 'padrao' || newPrefix === 'padrão') {
        delete target.prefix
    } else {
        target.prefix = newPrefix.trim()
    }
    saveGroupConfig(groupConfig, true)
    return true
}

function setGlobalPrefix(newPrefix) {
    if (!newPrefix || typeof newPrefix !== 'string') return false
    const clean = newPrefix.trim()
    if (!clean) return false
    const fs = require('fs')
    const path = require('path')
    const cfgPath = path.join(__dirname, '../../data/config.json')
    try {
        let cfg = {}
        if (fs.existsSync(cfgPath)) {
            cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
        }
        cfg.prefix = clean
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8')
        try {
            const cachedConfig = require('../../data/config.json')
            cachedConfig.prefix = clean
        } catch {}
        return true
    } catch (e) {
        console.error('[ConfigManager] Erro ao salvar prefixo global:', e.message)
        return false
    }
}

module.exports = {
    loadGroupConfig,
    saveGroupConfig,
    loadConcorrentes,
    saveConcorrentes,
    getSuporteNumber,
    setSuporteCache,
    getPrefixForChat,
    setGroupPrefix,
    setGlobalPrefix
}
