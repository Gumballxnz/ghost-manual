const config = require('../../../data/config.json')
const { getGroupMetadataCached, invalidateGroupCache, isOwnerCheck, isSubdonoCheck, resolverParticipanteGrupo } = require('../../utils/baileys')
const path = require('path')
const { vendasStore } = require('../../utils/firebaseDataLayer')
const { buscarNumero } = require('../../bot/core')

function extrairChavesDeComparacao(val, extraProps = {}) {
    const keys = new Set()

    const addVal = (item) => {
        if (!item) return
        const str = String(item).trim()
        if (!str) return
        keys.add(str)

        const clean = str.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (!clean) return
        keys.add(clean)

        const match258 = clean.match(/^258(8[2-7]\d{7})$/)
        if (match258) {
            const local = match258[1]
            keys.add(local)
            keys.add('258' + local)
            keys.add('258' + local + '@s.whatsapp.net')
        }

        const match9 = clean.match(/^(8[2-7]\d{7})$/)
        if (match9) {
            const local = match9[1]
            keys.add(local)
            keys.add('258' + local)
            keys.add('258' + local + '@s.whatsapp.net')
        }
    }

    addVal(val)
    if (extraProps.id) addVal(extraProps.id)
    if (extraProps.lid) addVal(extraProps.lid)
    if (extraProps.pn) addVal(extraProps.pn)
    if (extraProps.phoneNumber) addVal(extraProps.phoneNumber)

    return keys
}

module.exports = async (sock, msg, from, sender, text) => {
    if (text !== config.prefix + 'naocompra') return false

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos.' }, { quoted: msg })
        return true
    }

    try {

        let metadata = null
        try {
            if (sock && typeof sock.groupMetadata === 'function') {
                metadata = await sock.groupMetadata(from)
                invalidateGroupCache(from)
            }
        } catch {}
        if (!metadata) {
            metadata = await getGroupMetadataCached(sock, from)
        }

        if (!metadata || !Array.isArray(metadata.participants)) {
            await sock.sendMessage(from, { text: '❌ Não foi possível carregar a lista de participantes do grupo.' }, { quoted: msg })
            return true
        }

        const admins = metadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id)

        const botId = sock.user.id ? sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net' : ''
        const botRawNum = sock.user.id ? sock.user.id.split(':')[0].split('@')[0] : ''

        const vendas = (await vendasStore.load()) || vendasStore.getCache() || {}

        const cleanFrom = from.split(':')[0]
        const dotFrom = cleanFrom.replace(/\./g, '___dot___')
        const slashFrom = cleanFrom.replace(/___dot___/g, '.')
        const grupoVendas = vendas[cleanFrom] || vendas[dotFrom] || vendas[slashFrom] || vendas[from] || {}
        const clientesDoGrupo = grupoVendas.clientes || {}

        const identificadoresComCompra = new Set()
        for (const [clienteId, dados] of Object.entries(clientesDoGrupo)) {
            if ((dados.compras || 0) > 0) {
                const cIds = extrairChavesDeComparacao(clienteId)
                for (const cid of cIds) {
                    identificadoresComCompra.add(cid)
                }
            }
        }

        const semCompra = []
        for (const p of metadata.participants) {
            const membroId = p.id || ''
            const pDigits = membroId.split('@')[0].split(':')[0].replace(/\D/g, '')

            if (p.admin === 'admin' || p.admin === 'superadmin' || admins.includes(membroId)) continue

            if (membroId === botId || pDigits === botRawNum) continue

            if (isOwnerCheck(membroId, msg) || isSubdonoCheck(membroId)) continue

            const pIds = extrairChavesDeComparacao(membroId, p)

            if (membroId.includes('@lid') || pDigits.length >= 14) {
                try {
                    const resolvedJid = await resolverParticipanteGrupo(sock, from, membroId)
                    if (resolvedJid && resolvedJid !== membroId) {
                        const rIds = extrairChavesDeComparacao(resolvedJid)
                        for (const rid of rIds) pIds.add(rid)
                    }
                } catch {}
            }

            let temCompra = false
            for (const pid of pIds) {
                if (identificadoresComCompra.has(pid)) {
                    temCompra = true
                    break
                }
            }

            if (!temCompra) {
                semCompra.push(membroId)
            }
        }

        if (semCompra.length === 0) {
            await sock.sendMessage(from, { text: '✅ Todos os membros já fizeram compras!' }, { quoted: msg })
            return true
        }

        let resposta = `⚠️ *Membros sem compras registradas:* ⚠️\n\n`

        for (const membro of semCompra) {
            const numero = membro.split('@')[0]
            resposta += `• @${numero}\n`
        }

        if (resposta.length > 4000) {
            const linhas = resposta.split('\n')
            let parte = ''
            for (const linha of linhas) {
                if ((parte + linha).length > 3500) {
                    await sock.sendMessage(from, { text: parte, mentions: semCompra })
                    parte = linha + '\n'
                } else {
                    parte += linha + '\n'
                }
            }
            if (parte.trim()) {
                await sock.sendMessage(from, { text: parte.trim(), mentions: semCompra })
            }
        } else {
            await sock.sendMessage(from, { text: resposta, mentions: semCompra }, { quoted: msg })
        }

    } catch (err) {
        console.error('[NAOCOMPRA] Erro:', err)
        await sock.sendMessage(from, { text: '❌ Erro ao listar membros.' }, { quoted: msg })
    }

    return true
}
