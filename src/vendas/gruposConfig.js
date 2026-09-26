const { gruposConfigStore } = require('../utils/firebaseDataLayer')

function loadGruposConfig() {
    return gruposConfigStore.loadSync() || {}
}

function saveGruposConfig(dataOrForce = false) {
    let data = gruposConfigStore.getCache()
    let force = false
    if (dataOrForce && typeof dataOrForce === 'object') {
        data = dataOrForce
    }
    if (dataOrForce === true) {
        force = true
    }
    gruposConfigStore.save(data, force)
}

function getGrupoConfig(groupId) {
    if (!groupId) return { modoEnvio: 'manual', donoPhone: null, rankingAtivo: false }
    const config = loadGruposConfig()
    const gp = config[groupId] || config[groupId.replace(/\./g, '___dot___')] || config[groupId.replace(/___dot___/g, '.')] || {}
    return {
        ...gp,
        modoEnvio: 'manual',
        donoPhone: gp.donoPhone || null,
        rankingAtivo: gp.rankingAtivo === true
    }
}

function setRankingAtivo(groupId, ativo) {
    if (!groupId) return false
    const config = loadGruposConfig()
    config[groupId] = {
        ...(config[groupId] || {}),
        rankingAtivo: !!ativo,
        atualizadoEm: new Date().toISOString()
    }
    saveGruposConfig(config)
    return true
}

function isRankingAtivo(groupId) {
    if (!groupId) return false
    const config = getGrupoConfig(groupId)
    return config.rankingAtivo === true
}

module.exports = {
    getGrupoConfig,
    setRankingAtivo,
    isRankingAtivo,
    loadGruposConfig,
    saveGruposConfig
}
