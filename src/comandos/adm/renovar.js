const fs = require('fs')
const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isOwnerCheck } = require('../../utils/baileys')
const configManager = require('../../utils/configManager')

function getDataMocambique() {
    const now = new Date()
    const offset = 2 * 60
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    return new Date(utc + (offset * 60000))
}

function parseTempo(str) {
    const match = str.match(/^(\d+)\s*(s|seg|segundo|segundos|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)?$/i)
    if (!match) return null

    const valor = parseInt(match[1])
    const unidade = (match[2] || 'd').toLowerCase()

    const MS = 1000, MIN = 60 * MS, HR = 60 * MIN, DIA = 24 * HR
    switch (unidade) {
        case 's': case 'seg': case 'segundo': case 'segundos': return valor * MS
        case 'min': case 'minuto': case 'minutos': return valor * MIN
        case 'h': case 'hora': case 'horas': return valor * HR
        case 'd': case 'dia': case 'dias': return valor * DIA
        case 'mes': case 'meses': return valor * 30 * DIA
        case 'a': case 'ano': case 'anos': return valor * 365 * DIA
        default: return valor * DIA
    }
}

module.exports = async (sock, msg, from, sender, text) => {
    if (text.startsWith(config.prefix + 'renovar')) {
        const isOwner = isOwnerCheck(sender, msg)
        if (!isOwner) return false

        const args = text.split(' ').slice(1)
        if (args.length === 0) {
            await sock.sendMessage(from, { text: '❌ Uso correto:\n• `.renovar [tempo]` (no grupo atual, ex: `.renovar 30d`)\n• `.renovar <index> [tempo]` (remoto, ex: `.renovar 1 30d`)' }, { quoted: msg })
            return true
        }

        let targetJid = from
        let tempoStr = ''
        let indexGrupo = null

        if (args.length >= 2) {
            if (args[0].toLowerCase() === 'grupo' || args[0].toLowerCase() === 'g' || args[0].startsWith('#')) {
                indexGrupo = parseInt(args[0].replace(/\D/g, '') || args[1])
                tempoStr = args.slice(args[0].startsWith('#') ? 1 : 2).join(' ')
            } else if (/^\d+$/.test(args[0])) {
                const resto = args.slice(1).join(' ').trim()
                const ehApenasUnidade = /^(s|seg|segundo|segundos|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)$/i.test(resto)

                if (ehApenasUnidade && from.endsWith('@g.us')) {

                    tempoStr = `${args[0]} ${resto}`
                    targetJid = from
                } else {

                    indexGrupo = parseInt(args[0])
                    tempoStr = resto
                }
            } else {
                tempoStr = args.join(' ')
            }
        } else {
            tempoStr = args.join(' ')
        }

        if (indexGrupo !== null) {
            const obterMapaGrupos = () => {
                if (global.mapaGrupos && global.mapaGrupos.length > 0) {
                    return global.mapaGrupos
                }
                const groups = configManager.loadGroupConfig()
                const jids = Object.entries(groups)
                    .filter(([id, cfg]) => cfg.authorized)
                    .map(([id]) => id)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                global.mapaGrupos = jids
                return jids
            }
            const jids = obterMapaGrupos()
            if (indexGrupo < 1 || indexGrupo > jids.length) {
                await sock.sendMessage(from, { text: `❌ Índice inválido! Use um número de 1 a ${jids.length} da lista do comando *.grupos*.` }, { quoted: msg })
                return true
            }
            targetJid = jids[indexGrupo - 1]
        } else if (!targetJid.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '❌ No chat privado, informe o número do grupo:\n\nExemplo: `.renovar 1 30d`\n(Consulte a lista com `.grupos`)' }, { quoted: msg })
            return true
        }

        if (!tempoStr) {
            await sock.sendMessage(from, { text: '❌ Especifique o tempo para a renovação (ex: 30d, 1mes, permanente).' }, { quoted: msg })
            return true
        }

        const groups = configManager.loadGroupConfig()
        if (!groups[targetJid]) {
            groups[targetJid] = {}
        }

        groups[targetJid].authorized = true
        delete groups[targetJid].avisouExpiracao
        delete groups[targetJid].avisouPreExpiracao5d
        delete groups[targetJid].avisouPreExpiracao24h

        let atingiuLimite = false
        const agora = getDataMocambique().getTime()

        if (tempoStr.toLowerCase() === 'permanente' || tempoStr.toLowerCase() === 'perm') {
            delete groups[targetJid].expiraEm
            delete groups[targetJid].duracao
        } else {
            const tempoMs = parseTempo(tempoStr)
            if (!tempoMs) {
                await sock.sendMessage(from, { text: '❌ Formato de tempo inválido (ex: 30d, 1mes, 1ano).' }, { quoted: msg })
                return true
            }

            let acumulou = false
            let novaExpira = agora + tempoMs
            if (groups[targetJid].expiraEm && groups[targetJid].expiraEm > agora) {

                novaExpira = groups[targetJid].expiraEm + tempoMs
                acumulou = true
            }

            const limiteMaximo = agora + (365 * 24 * 60 * 60 * 1000)
            if (novaExpira > limiteMaximo) {
                novaExpira = limiteMaximo
                atingiuLimite = true
            }

            groups[targetJid].expiraEm = novaExpira
            groups[targetJid].duracao = tempoStr
        }

        configManager.saveGroupConfig(true)

        let expiraMsg = 'Duração: *Permanente*'
        if (groups[targetJid].expiraEm) {
            const expiraData = new Date(groups[targetJid].expiraEm)
            let descAcumulo = ''
            if (atingiuLimite) {
                descAcumulo = ' *(ajustado ao limite de 1 ano)*'
            } else if (acumulou) {
                descAcumulo = ' *(acumulado)*'
            }
            const rotuloTempo = acumulou ? '⏱️ Tempo Adicionado' : '⏱️ Duração'
            expiraMsg = `${rotuloTempo}: *${tempoStr}*${descAcumulo}\n📅 Expiração: ${expiraData.toLocaleDateString('pt-BR')} às ${expiraData.toLocaleTimeString('pt-BR')}`
        }

        if (targetJid !== from) {
            await sock.sendMessage(from, { text: `✅ *Renovação Concluída!*\n\n${expiraMsg}\n👥 Grupo: ${targetJid.split('@')[0]}` }, { quoted: msg })
            try {
                await sock.sendMessage(targetJid, { text: `✅ *Aluguel Renovado pelo Dono!*\n\n${expiraMsg}` })
            } catch (err) {
                console.error('Erro ao notificar grupo renovado:', err.message)
            }
        } else {
            await sock.sendMessage(from, { text: `✅ *Aluguel Renovado!*\n\n${expiraMsg}` }, { quoted: msg })
        }

        return true
    }
    return false
}
