const fs = require('fs')
const path = require('path')

async function limparArquivosSessao(sessionDir = './session') {
    try {
        if (!fs.existsSync(sessionDir)) return
        const credsPath = path.join(sessionDir, 'creds.json')
        if (!fs.existsSync(credsPath)) return

        const credsRaw = await fs.promises.readFile(credsPath, 'utf8')
        const creds = JSON.parse(credsRaw)
        const nextPreKeyId = Number(creds.nextPreKeyId || creds.firstUnuploadedPreKeyId)
        if (!nextPreKeyId || isNaN(nextPreKeyId)) return

        // Manter com segurança as últimas 150 pre-keys antes do nextPreKeyId
        const minKeepId = Math.max(1, nextPreKeyId - 150)

        const files = await fs.promises.readdir(sessionDir)
        let deletedCount = 0

        for (const file of files) {
            const match = file.match(/^pre-key-(\d+)\.json$/)
            if (match) {
                const keyId = parseInt(match[1], 10)
                if (keyId < minKeepId) {
                    try {
                        await fs.promises.unlink(path.join(sessionDir, file))
                        deletedCount++
                    } catch {}
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`[SESSION-PRUNER] 🧹 ${deletedCount} pre-keys antigas/consumidas removidas da sessão com segurança.`)
        }
    } catch (err) {
        console.error('[SESSION-PRUNER] Erro na limpeza segura de sessão:', err.message)
    }
}

function iniciarLimpezaSessao() {
    setTimeout(() => {
        limparArquivosSessao('./session').catch(() => {})
    }, 15000)

    setInterval(() => {
        limparArquivosSessao('./session').catch(() => {})
    }, 30 * 60 * 1000)
}

module.exports = { iniciarLimpezaSessao, limparPreKeysAntigas: limparArquivosSessao, limparArquivosSessao }
