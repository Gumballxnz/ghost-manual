const config = require('../../../data/config.json')
const path = require('path')
const { getGroupMetadataCached, invalidateGroupCache, isOwnerCheck, isSubdonoCheck, resolverParticipanteGrupo } = require('../../utils/baileys')
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
    if (!text.startsWith(config.prefix + 'fantasmas')) return false

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos.' }, { quoted: msg })
        return true
    }

    try {

        const args = text.replace(config.prefix + 'fantasmas', '').trim().split(/\s+/).filter(a => a !== '')

        let maxCompras = 0
        let limite = 0

        if (args.length === 1) {
            maxCompras = parseInt(args[0]) || 0
        } else if (args.length >= 2) {
            maxCompras = parseInt(args[0]) || 0
            limite = parseInt(args[1]) || 0
        }

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

        const comprasById = new Map()
        for (const [clienteId, dados] of Object.entries(clientesDoGrupo)) {
            const compras = dados.compras || 0
            if (compras <= 0) continue

            const cIds = extrairChavesDeComparacao(clienteId)
            for (const cid of cIds) {
                comprasById.set(cid, Math.max(comprasById.get(cid) || 0, compras))
            }
        }

        const listaFantasmas = []
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

            let userCompras = 0
            for (const pid of pIds) {
                if (comprasById.has(pid)) {
                    userCompras = Math.max(userCompras, comprasById.get(pid))
                }
            }

            if (userCompras <= maxCompras) {
                listaFantasmas.push(membroId)
            }
        }

        let fantasmas = listaFantasmas

        if (fantasmas.length === 0) {
            await sock.sendMessage(from, { text: `✅ Todos os membros têm mais de ${maxCompras} compra(s)!` }, { quoted: msg })
            return true
        }

        if (limite > 0 && limite < fantasmas.length) {
            for (let i = fantasmas.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [fantasmas[i], fantasmas[j]] = [fantasmas[j], fantasmas[i]]
            }
            fantasmas = fantasmas.slice(0, limite)
        }

        let textoFantasmas = fantasmas.map(m => `@${m.split('@')[0]}`).join(' ')

        let cabecalho = `👻 *Fantasmas (${maxCompras} compra(s) ou menos):*\n`
        cabecalho += `📊 Mostrando: ${fantasmas.length} membro(s)\n\n`
        cabecalho += textoFantasmas

        await sock.sendMessage(from, { text: cabecalho, mentions: fantasmas }, { quoted: msg })

    } catch (err) {
        console.error('[FANTASMAS] Erro:', err)
        await sock.sendMessage(from, { text: '❌ Erro ao listar fantasmas.' }, { quoted: msg })
    }

    return true
}
