const path = require('path')
const configManager = require('./configManager')
const { loadGruposConfig, getGrupoConfig } = require('../vendas/gruposConfig')

function getAuthorizedGroupsList() {
    const allGroupConfigs = configManager.loadGroupConfig() || {}
    const entries = Object.entries(allGroupConfigs).filter(([jid, cfg]) => cfg && cfg.authorized)

    entries.sort((a, b) => {
        const dateA = a[1].date ? new Date(a[1].date).getTime() : 0
        const dateB = b[1].date ? new Date(b[1].date).getTime() : 0
        if (dateA !== dateB) return dateA - dateB
        return a[0].localeCompare(b[0])
    })

    return entries.map(([jid, cfg], index) => {
        const gConfig = getGrupoConfig(jid)
        return {
            index: index + 1,
            jid,
            cfg,
            gConfig,
            name: cfg.name || cfg.subject || ('Grupo ' + (index + 1))
        }
    })
}

function getGroupByIndexOrJid(identifier) {
    if (!identifier) return null
    const list = getAuthorizedGroupsList()

    const num = parseInt(identifier)
    if (!isNaN(num) && num >= 1 && num <= list.length) {
        return list[num - 1]
    }

    const found = list.find(g => g.jid === identifier || g.jid.includes(identifier))
    return found || null
}

function resolveTargetGroup(arg, currentFrom, isOwner) {
    if (isOwner && arg) {
        const grp = getGroupByIndexOrJid(arg)
        if (grp) return grp
    }

    if (currentFrom && currentFrom.endsWith('@g.us')) {
        const list = getAuthorizedGroupsList()
        const grp = list.find(g => g.jid === currentFrom)
        if (grp) return grp
        return {
            index: 0,
            jid: currentFrom,
            cfg: configManager.loadGroupConfig()[currentFrom] || {},
            gConfig: getGrupoConfig(currentFrom),
            name: 'Grupo Atual'
        }
    }

    return null
}

module.exports = {
    getAuthorizedGroupsList,
    getGroupByIndexOrJid,
    resolveTargetGroup
}
