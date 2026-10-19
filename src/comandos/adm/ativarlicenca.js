const fs = require('fs');
const path = require('path');
const { isAdmin, isOwnerCheck } = require('../../utils/baileys');
const configManager = require('../../utils/configManager');
const { addNanosCommand, listNanosCommands } = require('../../bot/nano');

let config = {};
try {
    config = require('../../../data/config.json');
} catch {
    config = { prefix: '.' };
}

function getDataMocambique() {
    const now = new Date();
    const offset = 2 * 60;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (offset * 60000));
}

function parseTempo(str) {
    if (!str) return null;
    const cleanStr = String(str).trim().toLowerCase()
        .replace(/messes/g, 'meses')
        .replace(/mês/g, 'mes');
    const match = cleanStr.match(/^(\d+)\s*(s|seg|segundo|segundos|min|minuto|minutos|h|hora|horas|d|dia|dias|mes|meses|a|ano|anos)?$/i);
    if (!match) return null;
    const valor = parseInt(match[1]);
    const unidade = (match[2] || 'd').toLowerCase();
    const MS = 1000, MIN = 60 * MS, HR = 60 * MIN, DIA = 24 * HR;
    switch (unidade) {
        case 's': case 'seg': case 'segundo': case 'segundos': return valor * MS;
        case 'min': case 'minuto': case 'minutos': return valor * MIN;
        case 'h': case 'hora': case 'horas': return valor * HR;
        case 'd': case 'dia': case 'dias': return valor * DIA;
        case 'mes': case 'meses': return valor * 30 * DIA;
        case 'a': case 'ano': case 'anos': return valor * 365 * DIA;
        default: return valor * DIA;
    }
}

module.exports = async (sock, msg, from, sender, text) => {
    if (!text || typeof text !== 'string') return false;

    const pfx = config.prefix || '.';
    const cleanLower = text.trim().toLowerCase();

    const isExplicitCmd = cleanLower === (pfx + 'ativarlicenca') ||
                          cleanLower.startsWith(pfx + 'ativarlicenca ') ||
                          cleanLower.startsWith(pfx + 'ativarlicenca\t') ||
                          cleanLower === (pfx + 'ativarlicensa') ||
                          cleanLower.startsWith(pfx + 'ativarlicensa ') ||
                          cleanLower.startsWith(pfx + 'ativarlicensa\t');

    const matchCode = text.match(/GHOST-[A-Z0-9]{4}-[A-Z0-9]{4}/i);
    const isDirectGhostCode = cleanLower.startsWith('ghost-') && cleanLower.length >= 10 && cleanLower.includes('-');

    if (!isExplicitCmd && !isDirectGhostCode && !matchCode) {
        return false;
    }

    let rawCode = '';
    if (isExplicitCmd) {
        const parts = text.trim().split(/\s+/).slice(1);
        rawCode = parts.join(' ').trim();
        if (!rawCode) {
            await sock.sendMessage(from, {
                text: '❌ Informe o código da licença.\n\n*Exemplo:*\n• .ativarlicenca GHOST-XXXX-XXXX\nOu envie apenas o código da licença no grupo.'
            }, { quoted: msg });
            return true;
        }
    } else if (matchCode) {
        rawCode = matchCode[0];
    } else {
        rawCode = text.trim();
    }

    const extractedMatch = rawCode.match(/GHOST-[A-Z0-9]{4}-[A-Z0-9]{4}/i);
    let inputCode = (extractedMatch ? extractedMatch[0] : rawCode).trim().toUpperCase();

    const isGroup = from.endsWith('@g.us');
    if (!isGroup) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ O código de licença deve ser enviado diretamente no grupo que deseja ativar.' }, { quoted: msg });
        return true;
    }

    let adminStatus = false;
    try {
        adminStatus = await isAdmin(sock, from, sender);
    } catch (e) {}

    const isOwner = isOwnerCheck(sender, msg);
    if (!adminStatus && !isOwner) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ Apenas administradores do grupo ou o dono do bot podem ativar uma licença.' }, { quoted: msg });
        return true;
    }

    const { licencasStore } = require('../../utils/firebaseDataLayer');
    let licencas = licencasStore.loadSync() || {};

    const getAltCode = (c) => {
        if (!c) return c;
        if (c.startsWith('GHOST-')) {
            return 'GHOST-' + c.slice(6).replace(/O/g, '0');
        }
        return c.replace(/O/g, '0');
    };

    let targetCode = null;
    if (licencas[inputCode]) {
        targetCode = inputCode;
    } else {
        const altCode = getAltCode(inputCode);
        if (licencas[altCode]) {
            targetCode = altCode;
        }
    }

    if (!targetCode && typeof licencasStore.load === 'function') {
        try {
            const freshLicencas = await licencasStore.load();
            if (freshLicencas && typeof freshLicencas === 'object') {
                licencas = freshLicencas;
                if (licencas[inputCode]) {
                    targetCode = inputCode;
                } else {
                    const altCode = getAltCode(inputCode);
                    if (licencas[altCode]) {
                        targetCode = altCode;
                    }
                }
            }
        } catch (errSync) {
            console.error('[LICENCA] Erro ao sincronizar licencas do Firebase:', errSync.message);
        }
    }

    if (!targetCode || !licencas[targetCode]) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, {
            text: `❌ *Código de licença não encontrado ou já utilizado!*\n\n🔑 Código recebido: *${inputCode}*\n\nVerifique se o código foi digitado corretamente ou contate o suporte.`
        }, { quoted: msg });
        return true;
    }

    try { await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }) } catch {}

    const licencaInfo = licencas[targetCode];

    if (licencaInfo.grupoId && licencaInfo.grupoId !== from) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ Esta licença é exclusiva e só pode ser ativada no grupo para o qual foi gerada.' }, { quoted: msg });
        return true;
    }

    const now = Date.now();
    if (licencaInfo.expiraEm && now > licencaInfo.expiraEm) {
        try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
        await sock.sendMessage(from, { text: '❌ Esta licença expirou (já passaram 24 horas desde a sua criação sem ativação).' }, { quoted: msg });

        delete licencas[targetCode];
        licencasStore.save(licencas, true);
        return true;
    }

    const groups = configManager.loadGroupConfig();
    if (!groups[from]) groups[from] = {};

    groups[from].authorized = true;
    groups[from].date = getDataMocambique().toISOString();
    delete groups[from].botRemovido;
    delete groups[from].avisouExpiracao;
    delete groups[from].avisouPreExpiracao5d;
    delete groups[from].avisouPreExpiracao24h;

    const tempoStr = licencaInfo.duracao;
    let expiracaoMs = null;
    let atingiuLimite = false;
    let acumulou = false;

    if (tempoStr.toLowerCase() === 'permanente' || tempoStr.toLowerCase() === 'perm') {
        delete groups[from].expiraEm;
        delete groups[from].duracao;
    } else {
        expiracaoMs = parseTempo(tempoStr);
        if (expiracaoMs) {
            const agora = getDataMocambique().getTime();
            let novaExpira = agora + expiracaoMs;
            if (groups[from].expiraEm && groups[from].expiraEm > agora) {
                novaExpira = groups[from].expiraEm + expiracaoMs;
                acumulou = true;
            }
            const limiteMaximo = agora + (365 * 24 * 60 * 60 * 1000);
            if (novaExpira > limiteMaximo) {
                novaExpira = limiteMaximo;
                atingiuLimite = true;
            }
            groups[from].expiraEm = novaExpira;
            groups[from].duracao = tempoStr;
        } else {
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }) } catch {}
            await sock.sendMessage(from, { text: '❌ Erro na licença: Formato de tempo inválido no registro interno.' }, { quoted: msg });
            return true;
        }
    }

    configManager.saveGroupConfig(groups, true);
    try {
        const { groupConfigStore } = require('../../utils/firebaseDataLayer');
        if (groupConfigStore && typeof groupConfigStore.patch === 'function') {
            const safeKey = from.replace(/\./g, '___dot___');
            groupConfigStore.patch(safeKey, groups[from]);
        }
    } catch (errPatch) {
        console.error('[LICENCA] Erro ao gravar patch granular:', errPatch.message);
    }

    const NANOS_PADRAO = {
        'peço megas': 'Pode mandar, megas nunca acabam ✅',
        'peco megas': 'Pode mandar, megas nunca acabam ✅',
        'quero megas': '✅ Pode mandar! Megas disponíveis 24h 🚀',
        'preciso de megas': 'Disponível! Pode mandar o valor ✅',
        'como comprar': '📞 *ATENDIMENTO AUTOMÁTICO*\n\nPara comprar megas, digite *Tabela* para ver nossos preços!\n\nEm seguida, envie o valor via *M-Pesa* e mande o comprovativo aqui mesmo no grupo.\nO Bot entregará automaticamente! 🚀'
    };

    const existentes = listNanosCommands(from);
    let nanosCopiados = 0;
    if (existentes.length === 0) {
        for (const [chave, resposta] of Object.entries(NANOS_PADRAO)) {
            addNanosCommand(from, chave, resposta);
            nanosCopiados++;
        }
    }
    const msgNanos = nanosCopiados > 0 ? `\n\n🤖 *${nanosCopiados} respostas automáticas* configuradas!` : '';

    delete licencas[targetCode];
    licencasStore.save(licencas, true);

    let expiraMsg = '♾️ Duração: *Permanente*';
    if (expiracaoMs) {
        const expiraData = new Date(groups[from].expiraEm);
        let descAcumulo = '';
        if (atingiuLimite) {
            descAcumulo = ' *(ajustado ao limite de 1 ano)*';
        } else if (acumulou) {
            descAcumulo = ' *(acumulado)*';
        }
        const rotuloDuracao = acumulou ? '⏱️ Duração Adicionada' : '⏱️ Duração';
        expiraMsg = `${rotuloDuracao}: *${tempoStr}*${descAcumulo}\n📅 Expiração: ${expiraData.toLocaleDateString('pt-BR')} às ${expiraData.toLocaleTimeString('pt-BR')}`;
    }

    try { await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }) } catch {}
    await sock.sendMessage(from, {
        text: `✅ *Licença Ativada com Sucesso!*\n\n${expiraMsg}\n\nO bot agora está ativo neste grupo.${msgNanos}`
    }, { quoted: msg });

    return true;
};
