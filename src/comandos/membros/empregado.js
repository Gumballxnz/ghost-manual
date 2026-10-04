const { fetchFirebase } = require('../../utils/firebaseConfig')

async function handleEmpregado(sock, msg, from) {
    let numero = '-'
    let nome = 'Antonio'

    try {
        const fbSup = await fetchFirebase('bot_data/suporteNumber')
        if (fbSup) {
            if (typeof fbSup === 'object') {
                if (fbSup.numero) numero = String(fbSup.numero).trim()
                if (fbSup.nome) nome = String(fbSup.nome).trim()
            } else if (typeof fbSup === 'string' || typeof fbSup === 'number') {
                const clean = String(fbSup).trim()
                if (clean) numero = clean
            }
        }
    } catch (e) {
        numero = '-'
    }

    const resposta = `Nome: ${nome}\nNumero: ${numero}`
    await sock.sendMessage(from, { text: resposta }, { quoted: msg })
    return true
}

module.exports = async function(sock, msg, from, sender, text) {
    return handleEmpregado(sock, msg, from)
}

module.exports.nome = 'empregado'
module.exports.aliases = ['suporteempregado']
module.exports.categoria = 'membros'
module.exports.descricao = 'Exibe o contato do suporte/empregado'
module.exports.uso = '.empregado'
module.exports.handleEmpregado = handleEmpregado
