const configManager = require('../utils/configManager')
const { isOwnerCheck, isLeaderCheck, getGroupMetadataCached } = require('../utils/baileys')
const { concorrentesStore } = require('../utils/firebaseDataLayer')

async function anticoncorrenciaAtivo(sock, update) {
    if (update.action !== 'add') return

    const { id: groupId, participants } = update
    if (!groupId || !groupId.endsWith('@g.us')) return

    const groupConfig = configManager.loadGroupConfig()
    const dotGid = groupId.replace(/\./g, '___dot___')
    const gInfo = groupConfig[groupId] || groupConfig[dotGid] || {}

    if (!gInfo?.authorized || gInfo?.anticoncorrencia !== true) return

    const whitelistLocal = new Set(gInfo.concorrentes_whitelist || [])

    const concStoreData = concorrentesStore.loadSync() || {}
    const manualGlobal = new Set(concStoreData.global || [])

    let allGroups = {}
    try {
        allGroups = await sock.groupFetchAllParticipating()
    } catch {
        allGroups = groupConfig
    }

    const otherGroupIds = Object.keys(allGroups).filter(id => id.endsWith('@g.us') && id !== groupId)
    const adminDeOutrosGrupos = new Map()

    for (const otherGid of otherGroupIds) {
        const dotOther = otherGid.replace(/\./g, '___dot___')
        const otherInfo = groupConfig[otherGid] || groupConfig[dotOther]
        if (otherInfo && otherInfo.authorized === false) continue

        let otherMeta = allGroups[otherGid]
        if (!otherMeta || !otherMeta.participants) {
            try {
                otherMeta = await getGroupMetadataCached(sock, otherGid)
            } catch {
                continue
            }
        }
        if (!otherMeta || !otherMeta.participants) continue

        const otherGroupName = otherMeta.subject || 'Outro Grupo de Vendas'
        const otherAdmins = otherMeta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')

        for (const adm of otherAdmins) {
            const admNum = (adm.id || '').split('@')[0].split(':')[0].replace(/\D/g, '')
            if (admNum && !adminDeOutrosGrupos.has(admNum)) {
                adminDeOutrosGrupos.set(admNum, otherGroupName)
            }
        }
    }

    for (const participant of participants) {
        const numClean = participant.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (!numClean) continue

        if (isLeaderCheck(participant) || isOwnerCheck(participant) || isLeaderCheck(numClean) || isOwnerCheck(numClean)) {
            continue
        }

        if (whitelistLocal.has(numClean)) {
            continue
        }

        let motivo = null
        if (adminDeOutrosGrupos.has(numClean)) {
            motivo = `Admin em outro grupo de vendas (${adminDeOutrosGrupos.get(numClean)})`
        } else if (manualGlobal.has(numClean)) {
            motivo = 'Registrado na Lista Negra de Concorrentes'
        }

        if (motivo) {
            try {
                await sock.sendMessage(groupId, {
                    text: `🛡️ *ANTI-CONCORRÊNCIA ATIVADO*\n\n🚫 O usuário @${numClean} foi identificado como concorrente (_${motivo}_) e foi banido automaticamente deste grupo.`,
                    mentions: [participant]
                })

                setTimeout(async () => {
                    try {
                        await sock.groupParticipantsUpdate(groupId, [participant], 'remove')
                    } catch (err) {
                        console.error('[Anti-Concorrencia] Erro ao banir:', err.message)
                    }
                }, 800)
            } catch (err) {
                console.error('[Anti-Concorrencia] Erro ao enviar aviso:', err.message)
            }
        }
    }
}

module.exports = anticoncorrenciaAtivo
