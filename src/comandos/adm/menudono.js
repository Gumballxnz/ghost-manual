const fs = require('fs');
const path = require('path');
const { isOwnerCheck } = require('../../utils/baileys.js');
const config = require('../../../data/config.json');

module.exports = async (sock, msg, from, sender, text) => {
    if (text === config.prefix + 'menudono') {
        const isOwner = isOwnerCheck(sender, msg);

        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ Apenas o dono absoluto do bot pode usar este menu.' }, { quoted: msg });
            return true;
        }

        const prefix = config.prefix;
        const userName = msg.pushName || 'Dono';

        const header = [
            '╭┈⊰ 👻 『 *MENU DONO (MANUAL)* 』',
            `┊Olá, ${userName}!`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n');

        const bloco1 = [
            '╭┈❁ *👑 CONTROLE GLOBAL*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}onall (Ativar Global)`,
            `┊•.̇𖥨֗👻⭟${prefix}offall (Desativar Global)`,
            `┊•.̇𖥨֗👻⭟${prefix}on (Ativar Grupo)`,
            `┊•.̇𖥨֗👻⭟${prefix}off (Desativar Grupo)`,
            `┊•.̇𖥨֗👻⭟${prefix}status`,
            `┊•.̇𖥨֗👻⭟${prefix}prefixoglobal`,
            `┊•.̇𖥨֗👻⭟${prefix}subdono [add/remove]`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n');

        const bloco2 = [
            '╭┈❁ *🔌 GESTÃO DE GRUPOS & ALUGUEL*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}grupos`,
            `┊•.̇𖥨֗👻⭟${prefix}aluguel`,
            `┊•.̇𖥨֗👻⭟${prefix}renovar`,
            `┊•.̇𖥨֗👻⭟${prefix}delgrupo`,
            `┊•.̇𖥨֗👻⭟${prefix}remover aluguel`,
            `┊•.̇𖥨֗👻⭟${prefix}bcast`,
            `┊•.̇𖥨֗👻⭟${prefix}grupoall`,
            `┊•.̇𖥨֗👻⭟${prefix}entrar`,
            `┊•.̇𖥨֗👻⭟${prefix}sair`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n');

        const bloco3 = [
            '╭┈❁ *🔑 LICENÇAS DO BOT*',
            '┊',
            `┊•.̇𖥨֗👻⭟${prefix}gerarlicenca [dias]`,
            `┊•.̇𖥨֗👻⭟${prefix}diminuirlicenca grupo [dias]`,
            `┊•.̇𖥨֗👻⭟${prefix}renovar`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n');

        const menuDonoText = [header, '', bloco1, '', bloco2, '', bloco3].join('\n');

        const logoPath = path.join(__dirname, '../../../assets', 'menuadm.jpg');

        if (fs.existsSync(logoPath)) {
            await sock.sendMessage(from, {
                image: fs.readFileSync(logoPath),
                caption: menuDonoText
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: menuDonoText }, { quoted: msg });
        }
        return true;
    }
    return false;
};
