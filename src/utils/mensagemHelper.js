const fs = require('fs')
const path = require('path')

function getOfficialLogo(sock) {
    const logoPath = path.join(__dirname, '../../assets', 'menuadm.jpg')
    return fs.existsSync(logoPath) ? logoPath : null
}

function formatarComandoIncorreto(motivo, usoExemplo) {
    const lines = [
        '╭─── ❌ *COMANDO INCORRETO* ───╮',
        '│'
    ]
    if (motivo) {
        lines.push(`│  ${motivo}`)
    }
    if (usoExemplo) {
        lines.push(`│  Use: ${usoExemplo}`)
    }
    lines.push('│')
    lines.push('╰──────────────────────────────╯')
    return lines.join('\n')
}

function formatarCaixaAviso(titulo, conteudo, emoji = '⚠️') {
    const lines = [
        `╭─── ${emoji} *${String(titulo).toUpperCase()}* ───╮`,
        '│'
    ]
    if (Array.isArray(conteudo)) {
        for (const c of conteudo) {
            lines.push(`│  ${c}`)
        }
    } else if (conteudo) {
        lines.push(`│  ${conteudo}`)
    }
    lines.push('│')
    lines.push('╰──────────────────────────────╯')
    return lines.join('\n')
}

module.exports = {
    getOfficialLogo,
    formatarComandoIncorreto,
    formatarCaixaAviso
}
