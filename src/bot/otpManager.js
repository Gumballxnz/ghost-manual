const fs = require('fs');
const path = require('path');
const config = require('../../data/config.json');
const { isOwnerCheck } = require('../utils/baileys');

const otps = {};

function gerarOTP(numero) {
    const codigo = Math.floor(10000 + Math.random() * 90000).toString();
    otps[codigo] = numero;

    setTimeout(() => {
        delete otps[codigo];
    }, 5 * 60 * 1000);

    return codigo;
}

async function handleOTPCommands(sock, msg, from, sender, text) {
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const comando = text.trim();
    const isGroup = from.endsWith('@g.us');
    const senderNumber = sender.split('@')[0].split(':')[0];

    if (isGroup && (comando === config.prefix + 'otp' || comando === config.prefix + 'vincular')) {
        const txt = `🔐 *SISTEMA OTP / AUTENTICAÇÃO DE LID*\n\n👉 *Como vincular sua conta:*\n1️⃣ Mande *.otp* ou *.vincular* no *privado* do bot para receber seu código de 5 dígitos.\n2️⃣ Depois, envie *.otp CÓDIGO* (ou *.soueu CÓDIGO*) aqui no grupo.`
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
        return true
    }

    if (!isGroup && (comando === config.prefix + 'vincular' || comando === config.prefix + 'otp' || comando === config.prefix + 'gerarotp')) {
        const isOwner = isOwnerCheck(sender, null);

        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas donos podem usar este comando.' }, { quoted: msg });
            return true;
        }

        const codigo = gerarOTP(senderNumber);

        const txt = `🔐 *SISTEMA DE LIGAÇÃO DE LIDs*\n\nSeu código de vinculação é: *${codigo}*\n\n👉 Vá no grupo onde o bot não te reconhece e envie:\n*.otp ${codigo}* ou *.soueu ${codigo}*\n\n_Válido por 5 minutos._`;

        await sock.sendMessage(from, { text: txt }, { quoted: msg });
        return true;
    }

    if (comando.startsWith(config.prefix + 'soueu') || (comando.startsWith(config.prefix + 'otp ') && comando.length > 5)) {
        const codigo = body.replace(config.prefix + 'soueu', '').replace(config.prefix + 'otp', '').trim();

        if (!codigo || !otps[codigo]) {
            await sock.sendMessage(from, { text: '❌ Código de vinculação inválido ou expirado.' }, { quoted: msg });
            return true;
        }

        const donoNumber = otps[codigo];
        const LIDNumber = sender.split('@')[0].split(':')[0];

        const mapeamentoPath = path.join(__dirname, '../../data/mapeamentoUsuarios.json');

        if (!fs.existsSync(mapeamentoPath)) {
            fs.writeFileSync(mapeamentoPath, '{}');
        }

        const mapeamento = JSON.parse(fs.readFileSync(mapeamentoPath));

        if (!mapeamento[donoNumber]) {
            mapeamento[donoNumber] = {
                sender: donoNumber + '@s.whatsapp.net',
                numero: donoNumber,
                nome: 'Dono',
                lids: []
            };
        }

        if (!mapeamento[donoNumber].lids) {
            mapeamento[donoNumber].lids = [];
        }

        if (!mapeamento[donoNumber].lids.includes(LIDNumber)) {
            mapeamento[donoNumber].lids.push(LIDNumber);
            fs.writeFileSync(mapeamentoPath, JSON.stringify(mapeamento, null, 2));
        }

        delete otps[codigo];

        await sock.sendMessage(from, { text: '✅ *Autenticação de LID Concluída!*\n\nSua identidade secreta neste grupo foi permanentemente associada à matriz do Dono.\n\nPode usar seus comandos de administração livremente!' }, { quoted: msg });
        return true;
    }

    return false;
}

module.exports = { handleOTPCommands };
