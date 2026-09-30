const fs = require('fs')
const path = require('path')

const FLAG_PATH = path.join(__dirname, '../../data/update-flag.json')

async function verificarAutoUpdate(sock, config, primeiraConexao) {
    try {

        if (primeiraConexao && !fs.existsSync(FLAG_PATH)) {
            console.log('[START] Bot iniciado e online no servidor (notificações privadas de boot desativadas por segurança).')
            return
        }

        if (!fs.existsSync(FLAG_PATH)) return

        const flagData = JSON.parse(fs.readFileSync(FLAG_PATH, 'utf8'))

        fs.unlinkSync(FLAG_PATH)

        const commit = flagData.commit || 'desconhecido'
        const msg = flagData.msg || 'Sem descrição'
        const data = flagData.data || new Date().toLocaleString('pt-BR')

        const texto = `🔄 *AUTO-ATUALIZAÇÃO CONCLUÍDA*

⏰ *Data:* ${data}
📦 *Commit:* \`${commit}\`
📝 *Mudança:* ${msg}

✅ O bot foi reiniciado automaticamente com a nova versão.
_Esta mensagem é automática._`

        const botNumber = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : (config.botNumber || '')

        const donos = Array.isArray(config.dono) ? config.dono : [config.dono]

        for (const numero of donos) {
            if (numero === botNumber) continue
            if (numero.length > 13 || numero.startsWith('159') || numero.startsWith('231') || numero.startsWith('191') || numero.startsWith('188') || numero.startsWith('142') || numero.startsWith('242') || numero.startsWith('176')) continue
            try {
                const jid = `${numero}@s.whatsapp.net`
                await sock.sendMessage(jid, { text: texto })
                console.log(`[AUTO-UPDATE] Notificação enviada para ${numero}`)
            } catch (err) {
                console.error(`[AUTO-UPDATE] Erro ao enviar para ${numero}:`, err.message)
            }
        }

        console.log('[AUTO-UPDATE] Notificação de atualização processada.')
    } catch (err) {
        console.error('[AUTO-UPDATE] Erro ao verificar flag:', err.message)

        try { fs.unlinkSync(FLAG_PATH) } catch { }
    }
}

module.exports = { verificarAutoUpdate }
