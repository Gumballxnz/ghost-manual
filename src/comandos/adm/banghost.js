const config = require('../../../data/config.json')
const { isAdmin: checkIsAdmin, isOwnerCheck, isSubdonoCheck, getGroupMetadataCached, invalidateGroupCache, resolverParticipanteGrupo } = require('../../utils/baileys')
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
    if (!text.startsWith(config.prefix + 'banghost')) return false

    const isOwner = isOwnerCheck(sender, msg)

    let isGroupAdmin = false
    try {
        if (!isOwner && from.endsWith('@g.us')) {
            isGroupAdmin = await checkIsAdmin(sock, from, sender)
        }
    } catch { }

    if (!isGroupAdmin && !isOwner) {
        await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
        return true
    }

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Este comando só funciona em grupos.' }, { quoted: msg })
        return true
    }

    try {

        const args = text.replace(config.prefix + 'banghost', '').trim().split(/\s+/).filter(a => a !== '')

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

        const botIdentifiers = new Set()
        if (sock.user?.id) {
            botIdentifiers.add(sock.user.id)
            const bNum = sock.user.id.split('@')[0].split(':')[0].replace(/\D/g, '')
            if (bNum) {
                botIdentifiers.add(bNum)
                botIdentifiers.add(bNum + '@s.whatsapp.net')
            }
        }
        if (sock.user?.lid) {
            botIdentifiers.add(sock.user.lid)
            const bLid = sock.user.lid.split('@')[0].split(':')[0].replace(/\D/g, '')
            if (bLid) botIdentifiers.add(bLid)
        }
        if (config.botNumber) {
            const cNum = String(config.botNumber).replace(/\D/g, '')
            if (cNum) {
                botIdentifiers.add(cNum)
                botIdentifiers.add(cNum + '@s.whatsapp.net')
            }
        }

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

        let toRemove = []

        for (const p of metadata.participants) {
            const membroId = p.id || ''
            const pDigits = membroId.split('@')[0].split(':')[0].replace(/\D/g, '')

            if (p.admin === 'admin' || p.admin === 'superadmin' || admins.includes(membroId)) continue

            if (membroId === sender) continue

            if (botIdentifiers.has(membroId) || botIdentifiers.has(pDigits)) continue

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
                toRemove.push(membroId)
            }
        }

        if (toRemove.length === 0) {
            await sock.sendMessage(from, { text: `✅ Não encontrei nenhum membro com ${maxCompras} compra(s) ou menos para remover.` }, { quoted: msg })
            return true
        }

        if (limite > 0 && limite < toRemove.length) {
            for (let i = toRemove.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [toRemove[i], toRemove[j]] = [toRemove[j], toRemove[i]]
            }
            toRemove = toRemove.slice(0, limite)
        }

        await sock.sendMessage(from, { text: `🧹 Removendo *${toRemove.length}* fantasma(s) com ${maxCompras} compra(s) ou menos...` }, { quoted: msg })

        const chunkSize = 20
        let removedCount = 0

        for (let i = 0; i < toRemove.length; i += chunkSize) {
            const chunk = toRemove.slice(i, i + chunkSize)
            try {
                await sock.groupParticipantsUpdate(from, chunk, 'remove')
                removedCount += chunk.length

                if (i + chunkSize < toRemove.length) {
                    await new Promise(res => setTimeout(res, 2000))
                }
            } catch (err) {
                console.error('[BANGHOST] Erro em chunk:', err)
                if (err.message?.includes('not-authorized') || err.message?.includes('forbidden') || err.message?.includes('403')) {
                    await sock.sendMessage(from, { text: '❌ O WhatsApp não autorizou a remoção. Verifique se o bot possui permissão de administrador ativa no grupo.' }, { quoted: msg })
                    return true
                }
            }
        }

        await sock.sendMessage(from, { text: `✅ Limpeza concluída!\n*${removedCount}* membro(s) foram expulsos do grupo.` }, { quoted: msg })

    } catch (err) {
        console.error('[BANGHOST] Erro:', err)
        await sock.sendMessage(from, { text: '❌ Erro ao realizar varredura de fantasmas.' }, { quoted: msg })
    }

    return true
}
