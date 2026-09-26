const { getDataMocambique, getHojeMocambique, getHoraMinutoMocambique: getHmMz } = require('./timezone')
const { getGroupMetadataCached, invalidateGroupCache } = require('./baileys')
const configManager = require('./configManager')

let relogioIniciado = false
let proximoTickTimer = null
let ultimoDiaResetado = ''

function getHoraMinutoMocambique() {
    const { horas, minutos } = getHmMz()
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`
}

async function limparDadosDiarios() {
    try {
        console.log('[RELÓGIO] 🌙 Executando rotina de limpeza diária...')
        try {
            const { limparRecibosExpirados } = require('../vendas/recibos')
            await limparRecibosExpirados()
            console.log('[RELÓGIO] ✅ Recibos expirados limpos com sucesso.')
        } catch (eRecibo) {
            console.error('[RELÓGIO] Erro ao limpar recibos expirados:', eRecibo.message)
        }
    } catch (e) {
        console.error('[RELÓGIO] Erro na rotina diária:', e.message)
    }
}

async function resetarLimitesSimDiarios() {
    // No-op no bot manual: sem modems/chips SIM físicos
    return 0
}

async function verificarExpiracaoSmsDiaria() {
    // No-op no bot manual: sem licenças de SMS/modem
    return
}

async function verificarEExecutarResetDiario(force = false) {
    try {
        const diaAtualMz = getHojeMocambique()

        if (!force && ultimoDiaResetado === diaAtualMz) {
            return false
        }

        const souPrimario = Boolean(global.sockConnected || global.sock || global.primaryConnected)
        if (!souPrimario && !force) {
            return false
        }

        console.log(`[RELÓGIO] 🌙 Virada de dia detectada (${diaAtualMz}). Executando rotina diária...`)
        ultimoDiaResetado = diaAtualMz

        await limparDadosDiarios()

        console.log(`[RELÓGIO] ✅ Rotina diária finalizada para ${diaAtualMz}.`)
        return true
    } catch (e) {
        console.error('[RELÓGIO] ❌ Erro em verificarEExecutarResetDiario:', e.message)
        return false
    }
}

async function baterRelogio() {
    try {
        const horaAtualMz = getHoraMinutoMocambique()
        const botConectado = Boolean(global.sockConnected || global.sock || global.primaryConnected)

        await verificarEExecutarResetDiario().catch(() => {})

        if (botConectado) {
            const groups = configManager.loadGroupConfig()
            const activeSock = global.sock || global.primarySocket
            const agoraMz = getDataMocambique().getTime()

            for (const [groupId, cfg] of Object.entries(groups)) {
                if (!groupId || !groupId.endsWith('@g.us')) continue
                if (cfg.authorized === false) continue
                if (cfg.expiraEm && agoraMz >= cfg.expiraEm) continue

                // Abertura automática de grupo
                if (cfg.horaAbrir && cfg.horaAbrir === horaAtualMz) {
                    try {
                        const metadata = await getGroupMetadataCached(activeSock, groupId).catch(() => null)
                        const isCurrentlyClosed = metadata ? metadata.announce === true : true

                        if (isCurrentlyClosed) {
                            await activeSock.groupSettingUpdate(groupId, 'not_announcement')
                            invalidateGroupCache(groupId)
                            await activeSock.sendMessage(groupId, { text: '🔓 *Grupo aberto automaticamente!*\n\n⏰ Horário programado atingido.' })
                            console.log(`[ALARME] ⏰ 🔓 Batida do Relógio (${horaAtualMz}): Grupo ABERTO com sucesso: ${groupId} (${cfg.name || ''})`)
                        } else {
                            console.log(`[ALARME] Batida do Relógio (${horaAtualMz}): Grupo ${groupId} já estava aberto.`)
                        }
                    } catch (err) {
                        console.error(`[ALARME] Erro ao abrir grupo ${groupId}:`, err.message)
                    }
                }

                // Fechamento automático de grupo
                if (cfg.horaFechar && cfg.horaFechar === horaAtualMz) {
                    try {
                        const metadata = await getGroupMetadataCached(activeSock, groupId).catch(() => null)
                        const isCurrentlyClosed = metadata ? metadata.announce === true : false

                        if (!isCurrentlyClosed) {
                            await activeSock.groupSettingUpdate(groupId, 'announcement')
                            invalidateGroupCache(groupId)
                            await activeSock.sendMessage(groupId, { text: '🔒 *Grupo fechado automaticamente!*\n\n⏰ Horário programado atingido.' })
                            console.log(`[ALARME] ⏰ 🔒 Batida do Relógio (${horaAtualMz}): Grupo FECHADO com sucesso: ${groupId} (${cfg.name || ''})`)
                        } else {
                            console.log(`[ALARME] Batida do Relógio (${horaAtualMz}): Grupo ${groupId} já estava fechado.`)
                        }
                    } catch (err) {
                        console.error(`[ALARME] Erro ao fechar grupo ${groupId}:`, err.message)
                    }
                }
            }
        }
    } catch (e) {
        console.error('[ALARME] Erro na batida do relógio:', e.message)
    } finally {
        agendarProximaBatida()
    }
}

function agendarProximaBatida() {
    if (proximoTickTimer) {
        clearTimeout(proximoTickTimer)
        proximoTickTimer = null
    }

    const now = new Date()
    const delayAteProximoMinuto = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    const delayReal = Math.max(delayAteProximoMinuto + 50, 1000)

    proximoTickTimer = setTimeout(baterRelogio, delayReal)
}

function inicializarRelogioMocambique() {
    if (relogioIniciado) return
    relogioIniciado = true

    const horaInicial = getHoraMinutoMocambique()
    console.log(`[ALARME] 🕰️ Relógio Oficial de Moçambique sincronizado (${horaInicial}). Monitorando viradas de minuto em tempo real e rotina diária às 00:00.`)

    setTimeout(() => {
        verificarEExecutarResetDiario().catch(() => {})
    }, 3000)

    agendarProximaBatida()
}

module.exports = {
    inicializarRelogioMocambique,
    getHoraMinutoMocambique,
    resetarLimitesSimDiarios,
    verificarEExecutarResetDiario,
    verificarExpiracaoSmsDiaria
}
