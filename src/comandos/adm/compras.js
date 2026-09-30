const config = require('../../../data/config.json')
const fs = require('fs')
const path = require('path')
const { isOwnerCheck, isAdmin } = require('../../utils/baileys')
const { vendasStore } = require('../../utils/firebaseDataLayer')

const backupPath = path.join(__dirname, '../../../vendas_backup.json')

module.exports = async (sock, msg, from, sender, text) => {
    const isOwner = isOwnerCheck(sender, msg)
    const isAdm = await isAdmin(sock, from, sender)
    const canUse = isOwner || isAdm

    if (text === config.prefix + 'limparcompras') {
        if (!canUse) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores ou o dono podem usar este comando.' }, { quoted: msg })
            return true
        }
        await sock.sendMessage(from, { text: '⚠️ *ATENÇÃO!*\n\nVocê está prestes a apagar TODO o histórico de compras e clientes deste grupo.\n\nPara confirmar, digite: `.limparcompras confirmar`' }, { quoted: msg })
        return true
    }

    if (text === config.prefix + 'limparcompras confirmar') {
        if (!canUse) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores ou o dono podem usar este comando.' }, { quoted: msg })
            return true
        }

        try {
            const vendas = vendasStore.loadSync() || {}
            if (Object.keys(vendas).length > 0) {
                fs.writeFileSync(backupPath, JSON.stringify(vendas, null, 2))

                if (vendas[from]) {
                    vendas[from] = { clientes: {}, historico: [] }
                    vendasStore.save(vendas)
                }

                await sock.sendMessage(from, {
                    text: '✅ *Histórico limpo com sucesso!*\n\nUm backup foi criado. Use `.recuperarcompras` para restaurar.'
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: '❌ Nenhum histórico de vendas encontrado.' }, { quoted: msg })
            }
        } catch (err) {
            console.error('[LIMPARCOMPRAS] Erro:', err)
            await sock.sendMessage(from, { text: '❌ Erro ao limpar histórico.' }, { quoted: msg })
        }
        return true
    }

    if (text === config.prefix + 'recuperarcompras') {
        if (!canUse) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores ou o dono podem usar este comando.' }, { quoted: msg })
            return true
        }

        try {
            if (fs.existsSync(backupPath)) {
                const backup = fs.readFileSync(backupPath)
                const vendas = JSON.parse(backup)
                vendasStore.save(vendas)

                await sock.sendMessage(from, {
                    text: '✅ *Compras restauradas com sucesso!*\nTodo histórico foi recuperado do backup.'
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: '❌ Nenhum backup encontrado.' }, { quoted: msg })
            }
        } catch (err) {
            console.error('[RECUPERARCOMPRAS] Erro:', err)
            await sock.sendMessage(from, { text: '❌ Erro ao recuperar histórico.' }, { quoted: msg })
        }
        return true
    }

    return false
}
