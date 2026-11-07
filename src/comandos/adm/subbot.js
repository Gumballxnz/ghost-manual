const path = require('path')
const config = require(path.join(__dirname, '../../../data/config.json'))
const { isLeaderCheck, isSubdonoCheck } = require('../../utils/baileys')
const subbotManager = require('../../bot/subbotManager')

module.exports = async (sock, msg, from, sender, text) => {
  const prefix = config.prefix || '.'
  const trimmed = (text || '').trim()
  if (!trimmed.startsWith(prefix)) return false

  const args = trimmed.slice(prefix.length).trim().split(/\s+/)
  const command = (args[0] || '').toLowerCase()

  const isSubbotCmd = command === 'subbot' || command === 'subbots'
  const isConectCmd = command === 'conect' || command === 'conectar'
  const isDelSubbotCmd = command === 'delsubbot' || command === 'deletesubbot'
  const isMeusGruposCmd = command === 'meusgrupos' || command === 'meusgruposub'

  if (!isSubbotCmd && !isConectCmd && !isDelSubbotCmd && !isMeusGruposCmd) {
    return false
  }

  const isGroup = from.endsWith('@g.us')
  const isOwnerOrSubdono = isLeaderCheck(sender, msg) || isSubdonoCheck(sender)
  const isAutorizado = subbotManager.isAutorizado(sender, msg)

  // ==========================================
  // CAMADA DE SEGURANÇA RESTRITA:
  // Apenas Dono, Subdonos e Revendedores Autorizados
  // Membros comuns e admins não autorizados são bloqueados.
  // ==========================================
  if (!isAutorizado) {
    await sock.sendMessage(from, {
      text: [
        '╭┈⊰ 👻 『 *ACESSO RESTRITO* 』',
        '┊',
        '┊•.̇𖥨֗⛔⭟ *Você não tem permissão para gerenciar sub-bots.*',
        '┊',
        '┊•.̇𖥨֗🔒⭟ *Quem pode executar:*',
        '┊   1. Dono do Bot',
        '┊   2. Subdonos',
        '┊   3. Revendedores / Usuários autorizados',
        '┊',
        '┊•.̇𖥨֗💡⭟ Solicite autorização ao Dono ou Subdono.',
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
      ].join('\n')
    }, { quoted: msg })
    return true
  }

  // ==========================================
  // COMANDO DIRETO: .meusgrupos
  // ==========================================
  if (isMeusGruposCmd) {
    return await listarGruposSessoes(sock, msg, from, sender, args, isOwnerOrSubdono, prefix)
  }

  // ==========================================
  // GESTÃO DE PERMISSÕES (Exclusivo Dono & Subdono):
  // .subbot autorizar <numero | @user>
  // .subbot desautorizar <numero | @user>
  // .subbot autorizados
  // ==========================================
  const subOpcao = (args[1] || '').toLowerCase()

  if (subOpcao === 'autorizar' || subOpcao === 'auth' || subOpcao === 'permitir' || subOpcao === 'add') {
    if (!isOwnerOrSubdono) {
      await sock.sendMessage(from, {
        text: '❌ *Apenas o Dono ou Subdono podem autorizar novos usuários.*'
      }, { quoted: msg })
      return true
    }
    let rawNumber = args[2]

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant
    if (quoted) {
      rawNumber = quoted.split('@')[0].split(':')[0]
    }

    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    if ((!rawNumber || rawNumber.startsWith('@')) && mentions && mentions.length > 0) {
      rawNumber = mentions[0].split('@')[0].split(':')[0]
    }

    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número, mencione @user ou responda à mensagem dele.*\nExemplo: \`${prefix}subbot autorizar 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }

    try {
      const { buscarNumero } = require('../../bot/core')
      const real = buscarNumero(rawNumber)
      if (real && real.length >= 8) {
        rawNumber = real
      } else if (rawNumber.length >= 14 || rawNumber.startsWith('178') || rawNumber.startsWith('159')) {
        const { resolverParticipanteGrupo } = require('../../utils/baileys')
        const res = await resolverParticipanteGrupo(sock, from, rawNumber, msg)
        if (res) {
          const c = res.split('@')[0].split(':')[0].replace(/\D/g, '')
          if (c && c.length >= 8 && c !== rawNumber) rawNumber = c
        }
      }
    } catch {}

    try {
      const resultado = subbotManager.autorizarUsuario(rawNumber, sender)
      if (resultado.status === 'ja_autorizado') {
        await sock.sendMessage(from, {
          text: [
            '╭┈⊰ 👻 『 *AVISO: JÁ AUTORIZADO* 』',
            '┊',
            `┊•.̇𖥨֗ℹ️⭟ O usuário *+${resultado.numero}* já está na lista!`,
            '┊      Ele já possui permissão ativa para gerenciar sub-bots.',
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
          ].join('\n')
        }, { quoted: msg })
      } else {
        await sock.sendMessage(from, {
          text: [
            '╭┈⊰ 👻 『 *USUÁRIO AUTORIZADO* 』',
            '┊',
            `┊•.̇𖥨֗✅⭟ Usuário *+${resultado.numero}* autorizado com sucesso!`,
            `┊•.̇𖥨֗📱⭟ Agora ele tem permissão para usar \`${prefix}conect\` e gerenciar sub-bots.`,
            '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
          ].join('\n')
        }, { quoted: msg })
      }
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg })
    }
    return true
  }

  if (subOpcao === 'desautorizar' || subOpcao === 'unauth' || subOpcao === 'revogar' || subOpcao === 'remove') {
    if (!isOwnerOrSubdono) {
      await sock.sendMessage(from, {
        text: '❌ *Apenas o Dono ou Subdono podem desautorizar usuários.*'
      }, { quoted: msg })
      return true
    }
    let rawNumber = args[2]

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant
    if (quoted) {
      rawNumber = quoted.split('@')[0].split(':')[0]
    }

    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    if ((!rawNumber || rawNumber.startsWith('@')) && mentions && mentions.length > 0) {
      rawNumber = mentions[0].split('@')[0].split(':')[0]
    }

    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número a desautorizar.*\nExemplo: \`${prefix}subbot desautorizar 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }

    try {
      const { buscarNumero } = require('../../bot/core')
      const real = buscarNumero(rawNumber)
      if (real && real.length >= 8) {
        rawNumber = real
      }
    } catch {}

    const resultado = subbotManager.desautorizarUsuario(rawNumber)
    if (resultado.status === 'nunca_autorizado') {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *AVISO: NÃO AUTORIZADO* 』',
          '┊',
          `┊•.̇𖥨֗⚠️⭟ O usuário *+${resultado.numero}* nunca foi autorizado`,
          '┊      ou não consta na lista de permissões!',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *AUTORIZAÇÃO REVOGADA* 』',
          '┊',
          `┊•.̇𖥨֗🗑️⭟ O usuário *+${resultado.numero}* foi removido com sucesso!`,
          '┊      Ele não tem mais acesso aos comandos de sub-bots.',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
    }
    return true
  }

  if (subOpcao === 'autorizados' || subOpcao === 'authlist') {
    if (!isOwnerOrSubdono) {
      await sock.sendMessage(from, {
        text: '❌ *Apenas o Dono ou Subdono podem consultar a lista de autorizados.*'
      }, { quoted: msg })
      return true
    }
    const lista = subbotManager.listarAutorizados()
    if (!lista.length) {
      await sock.sendMessage(from, {
        text: 'ℹ️ *Nenhum revendedor/usuário autorizado no momento.* Apenas Dono e Subdonos têm acesso.'
      }, { quoted: msg })
      return true
    }
    const linhas = [
      '╭┈⊰ 👻 『 *REVENDEDORES / USUÁRIOS AUTORIZADOS* 』',
      '┊'
    ]
    lista.forEach((u, idx) => {
      linhas.push(`┊•.̇𖥨֗👤⭟ *#${idx + 1}:* +${u}`)
    })
    linhas.push('┊')
    linhas.push(`┊•.̇𖥨֗💡⭟ Para revogar: \`${prefix}subbot desautorizar <numero>\``)
    linhas.push('╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯')
    await sock.sendMessage(from, { text: linhas.join('\n') }, { quoted: msg })
    return true
  }

  // ==========================================
  // COMANDO: .subbot grupos [numero] / .subbot sessoes
  // Dono vê todas as sessões e seus grupos.
  // Dono da sessão vê apenas os grupos da sua sessão.
  // ==========================================
  if (subOpcao === 'grupos' || subOpcao === 'grupo' || subOpcao === 'sessao' || subOpcao === 'sessoes') {
    return await listarGruposSessoes(sock, msg, from, sender, args, isOwnerOrSubdono, prefix)
  }

  // ==========================================
  // COMANDO DIRETO: .conect / .conectar <numero>
  // ==========================================
  if (isConectCmd) {
    const rawNumber = args[1]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *CONECTAR SUB-BOT* 』',
          '┊',
          '┊•.̇𖥨֗📱⭟ *Uso correto:*',
          `┊      ${prefix}conect <número_com_ddi>`,
          '┊',
          '┊•.̇𖥨֗💡⭟ *Exemplo (Moçambique):*',
          `┊      ${prefix}conect 258841234567`,
          '┊',
          '┊•.̇𖥨֗ℹ️⭟ O bot irá gerar um código de 8 dígitos',
          '┊      para você conectar pelo WhatsApp do chip.',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    return await executarConexaoSubbot(sock, msg, from, sender, rawNumber, prefix)
  }

  // ==========================================
  // COMANDO DIRETO: .delsubbot <numero>
  // ==========================================
  if (isDelSubbotCmd) {
    const rawNumber = args[1]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número do sub-bot a ser removido.*\nExemplo: \`${prefix}delsubbot 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }
    return await executarRemoverSubbot(sock, msg, from, sender, rawNumber, isOwnerOrSubdono)
  }

  // ==========================================
  // SUBCOMANDOS: .subbot [opção]
  // ==========================================

  // 1. .subbot lista / .subbots / .subbot status
  if (!subOpcao || subOpcao === 'lista' || subOpcao === 'list' || subOpcao === 'status' || command === 'subbots') {
    const lista = isOwnerOrSubdono
      ? subbotManager.listarSubbots()
      : subbotManager.getSubbotsDoUsuario(sender)

    if (!lista || lista.length === 0) {
      await sock.sendMessage(from, {
        text: [
          '╭┈⊰ 👻 『 *SISTEMA DE SUB-BOTS* 』',
          '┊',
          `┊•.̇𖥨֗ℹ️⭟ *${isOwnerOrSubdono ? 'Nenhum sub-bot registrado no momento.' : 'Você não possui nenhum sub-bot conectado.'}*`,
          '┊',
          `┊•.̇𖥨֗➕⭟ Digite *${prefix}conect <numero>* para conectar`,
          '┊      um chip secundário agora mesmo!',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')
      }, { quoted: msg })
      return true
    }

    const linhas = [
      `╭┈⊰ 👻 『 *${isOwnerOrSubdono ? 'SUB-BOTS ATIVOS & REGISTRADOS' : 'SEUS SUB-BOTS CONECTADOS'}* 』`,
      '┊'
    ]

    for (let i = 0; i < lista.length; i++) {
      const sb = lista[i]
      const statusIcon = sb.online ? '🟢 Online' : (sb.status === 'pareando' ? '🟡 Pareando' : '🔴 Offline')
      const qtdGrupos = sb.grupos ? sb.grupos.length : 0
      linhas.push(`┊•.̇𖥨֗📱⭟ *Sub-Bot #${i + 1}:* +${sb.numero}`)
      linhas.push(`┊      Status: *${statusIcon}*`)
      linhas.push(`┊      Grupos atendidos: *${qtdGrupos}*`)
      linhas.push('┊')
    }

    linhas.push(`┊•.̇𖥨֗💡⭟ *Comandos:*`)
    linhas.push(`┊   • \`${prefix}subbot grupos\` › Ver grupos autorizados`)
    linhas.push(`┊   • \`${prefix}subbot vincular [numero]\` › Atrelar a este grupo`)
    linhas.push(`┊   • \`${prefix}subbot desvincular\` › Voltar para bot principal`)
    linhas.push(`┊   • \`${prefix}subbot del <numero>\` › Remover sub-bot`)
    if (isOwnerOrSubdono) {
      linhas.push(`┊   • \`${prefix}subbot autorizar <numero>\` › Autorizar revendedor`)
      linhas.push(`┊   • \`${prefix}subbot autorizados\` › Ver lista de autorizados`)
    }
    linhas.push('╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯')

    await sock.sendMessage(from, { text: linhas.join('\n') }, { quoted: msg })
    return true
  }

  // 2. .subbot conectar / .subbot conect <numero>
  if (subOpcao === 'conect' || subOpcao === 'conectar' || subOpcao === 'add') {
    const rawNumber = args[2]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número com DDI.*\nExemplo: \`${prefix}subbot conect 258841234567\``
      }, { quoted: msg })
      return true
    }
    return await executarConexaoSubbot(sock, msg, from, sender, rawNumber, prefix)
  }

  // 3. .subbot del / remover <numero>
  if (subOpcao === 'del' || subOpcao === 'remover' || subOpcao === 'delete') {
    const rawNumber = args[2]
    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número a remover.*\nExemplo: \`${prefix}subbot del 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }
    return await executarRemoverSubbot(sock, msg, from, sender, rawNumber, isOwnerOrSubdono)
  }

  // 4. .subbot vincular [numero] (vincula o grupo atual ao sub-bot)
  if (subOpcao === 'vincular' || subOpcao === 'associar') {
    if (!isGroup) {
      await sock.sendMessage(from, { text: '❌ Este comando só pode ser usado dentro de um grupo.' }, { quoted: msg })
      return true
    }
    let rawNumber = args[2]

    // Se o revendedor não passou número, mas tem apenas 1 subbot dele, detecta automaticamente
    if (!rawNumber && !isOwnerOrSubdono) {
      const meus = subbotManager.getSubbotsDoUsuario(sender)
      if (meus.length === 1) {
        rawNumber = meus[0].numero
      }
    }

    if (!rawNumber) {
      await sock.sendMessage(from, {
        text: `❌ *Informe o número do sub-bot a ser vinculado.*\nExemplo: \`${prefix}subbot vincular 25884xxxxxxx\``
      }, { quoted: msg })
      return true
    }

    const numLimpo = rawNumber.replace(/\D/g, '')

    // Se não for dono/subdono, verifica se a sessão pertence a ele
    if (!isOwnerOrSubdono) {
      const sub = subbotManager.dados.subbots?.[numLimpo]
      if (!sub) {
        await sock.sendMessage(from, { text: `❌ Sub-bot +${numLimpo} não encontrado.` }, { quoted: msg })
        return true
      }
      const meus = subbotManager.getSubbotsDoUsuario(sender)
      const ehDele = meus.some(s => s.numero === numLimpo)
      if (!ehDele) {
        await sock.sendMessage(from, { text: '⛔ Você só pode vincular grupos aos seus próprios sub-bots.' }, { quoted: msg })
        return true
      }
    }

    subbotManager.vincularGrupo(numLimpo, from)
    await sock.sendMessage(from, {
      text: `✅ *Grupo Vinculado!*\n\n📱 Sub-Bot: *+${numLimpo}*\nEste grupo agora é atendido por este sub-bot.`
    }, { quoted: msg })
    return true
  }

  // 5. .subbot desvincular (desvincula o grupo atual do sub-bot)
  if (subOpcao === 'desvincular' || subOpcao === 'soltar') {
    if (!isGroup) {
      await sock.sendMessage(from, { text: '❌ Este comando só pode ser usado dentro de um grupo.' }, { quoted: msg })
      return true
    }
    subbotManager.desvincularGrupo(from)
    await sock.sendMessage(from, {
      text: `🔄 *Grupo Desvinculado!*\n\nO bot principal reassumiu o atendimento deste grupo.`
    }, { quoted: msg })
    return true
  }

  // Ajuda padrão
  const ajuda = [
    '╭┈⊰ 👻 『 *SISTEMA DE SUB-BOTS* 』',
    '┊',
    '┊•.̇𖥨֗🤖⭟ *Comandos disponíveis:*',
    `┊  • \`${prefix}conect <numero>\` › Conectar novo sub-bot`,
    `┊  • \`${prefix}subbots\` › Ver sub-bots online`,
    `┊  • \`${prefix}subbot grupos\` › Ver grupos autorizados para a sessão`,
    `┊  • \`${prefix}subbot vincular [numero]\` › Atrelar a este grupo`,
    `┊  • \`${prefix}subbot desvincular\` › Bot principal reassume`,
    `┊  • \`${prefix}subbot del <numero>\` › Remover sub-bot`
  ]
  if (isOwnerOrSubdono) {
    ajuda.push(`┊  • \`${prefix}subbot autorizar <numero>\` › Autorizar revendedor`)
    ajuda.push(`┊  • \`${prefix}subbot desautorizar <numero>\` › Revogar permissão`)
    ajuda.push(`┊  • \`${prefix}subbot autorizados\` › Listar autorizados`)
  }
  ajuda.push('╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯')

  await sock.sendMessage(from, { text: ajuda.join('\n') }, { quoted: msg })
  return true
}

async function listarGruposSessoes(sock, msg, from, sender, args, isOwnerOrSubdono, prefix) {
  const numeroFiltro = args[2] ? String(args[2]).replace(/\D/g, '') : ''

  async function obterNomeGrupo(s, gid) {
    try {
      const { getGroupMetadataCached } = require('../../utils/baileys')
      const meta = await getGroupMetadataCached(s, gid)
      if (meta && meta.subject) return meta.subject
    } catch {}
    return 'Grupo WhatsApp'
  }

  // ==========================================
  // 1. VISÃO DO DONO PRINCIPAL / SUBDONOS
  // O dono vê TODAS as sessões e seus grupos
  // ==========================================
  if (isOwnerOrSubdono) {
    let subbotsParaExibir = []

    if (numeroFiltro) {
      const sb = subbotManager.dados.subbots?.[numeroFiltro]
      if (!sb) {
        await sock.sendMessage(from, {
          text: `❌ *Nenhuma sessão encontrada para o número +${numeroFiltro}.*`
        }, { quoted: msg })
        return true
      }
      subbotsParaExibir.push(sb)
    } else {
      subbotsParaExibir = Object.values(subbotManager.dados.subbots || {})
    }

    if (!subbotsParaExibir.length) {
      await sock.sendMessage(from, {
        text: 'ℹ️ *Nenhuma sessão de sub-bot cadastrada no momento.*'
      }, { quoted: msg })
      return true
    }

    const linhas = [
      '╭┈⊰ 👻 『 *RELATÓRIO GERAL DE SESSÕES & GRUPOS* 』',
      '┊',
      '┊👑 *Acesso Administrativo (Dono do Bot)*',
      `┊Total de Sessões: *${subbotsParaExibir.length}*`,
      '┊'
    ]

    for (const sb of subbotsParaExibir) {
      const active = subbotManager.activeSubbots.get(sb.numero)
      const statusIcon = active?.status === 'online' ? '🟢 Online' : (sb.status === 'pareando' ? '🟡 Pareando' : '🔴 Offline')
      const grupos = sb.grupos || []

      linhas.push(`┊📱 *Sessão: +${sb.numero}* [${statusIcon}]`)
      if (sb.criadoPor) {
        const criadorClean = String(sb.criadoPor).split('@')[0].split(':')[0]
        linhas.push(`┊👤 *Criador:* wa.me/${criadorClean}`)
      }
      linhas.push(`┊📂 *Grupos Atendidos:* ${grupos.length}`)

      if (grupos.length === 0) {
        linhas.push('┊  › _Nenhum grupo vinculado a este chip._')
      } else {
        for (let i = 0; i < grupos.length; i++) {
          const gid = grupos[i]
          const nome = await obterNomeGrupo(active?.sock || sock, gid)
          linhas.push(`┊  ${i + 1}. 📌 *${nome}*`)
          linhas.push(`┊     › \`${gid}\``)
        }
      }
      linhas.push('┊')
    }

    linhas.push(`┊•.̇𖥨֗💡⭟ *Filtrar por sessão:* \`${prefix}subbot grupos <numero>\``)
    linhas.push('╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯')

    await sock.sendMessage(from, { text: linhas.join('\n') }, { quoted: msg })
    return true
  }

  // ==========================================
  // 2. VISÃO DO DONO DA SESSÃO (Revendedor)
  // O revendedor vê APENAS os grupos da sua sessão
  // ==========================================
  const minhasSessoes = subbotManager.getSubbotsDoUsuario(sender)

  if (!minhasSessoes || minhasSessoes.length === 0) {
    await sock.sendMessage(from, {
      text: [
        '╭┈⊰ 👻 『 *SEUS GRUPOS VINCULADOS* 』',
        '┊',
        '┊•.̇𖥨֗ℹ️⭟ *Você ainda não possui nenhuma sessão de sub-bot criada.*',
        `┊•.̇𖥨֗💡⭟ Conecte seu chip usando: \`${prefix}conect <seu_numero>\``,
        '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
      ].join('\n')
    }, { quoted: msg })
    return true
  }

  let sessoesParaExibir = minhasSessoes
  if (numeroFiltro) {
    sessoesParaExibir = minhasSessoes.filter(s => s.numero === numeroFiltro)
    if (!sessoesParaExibir.length) {
      await sock.sendMessage(from, {
        text: '⛔ *Acesso Restrito:* Você só tem permissão para visualizar os grupos pertencentes à sua própria sessão.'
      }, { quoted: msg })
      return true
    }
  }

  const linhas = [
    '╭┈⊰ 👻 『 *SEUS GRUPOS AUTORIZADOS* 』',
    '┊'
  ]

  for (const sb of sessoesParaExibir) {
    const active = subbotManager.activeSubbots.get(sb.numero)
    const statusIcon = active?.status === 'online' ? '🟢 Online' : '🔴 Offline'
    const grupos = sb.grupos || []

    linhas.push(`┊📱 *Sua Sessão:* +${sb.numero} [${statusIcon}]`)
    linhas.push(`┊📂 *Total de Grupos Vinculados:* ${grupos.length}`)
    linhas.push('┊')

    if (grupos.length === 0) {
      linhas.push('┊•.̇𖥨֗ℹ️⭟ *Nenhum grupo vinculado a esta sessão ainda.*')
      linhas.push(`┊      Para vincular um grupo, digite no grupo desejado:`)
      linhas.push(`┊      \`${prefix}subbot vincular ${sb.numero}\``)
    } else {
      for (let i = 0; i < grupos.length; i++) {
        const gid = grupos[i]
        const nome = await obterNomeGrupo(active?.sock || sock, gid)
        linhas.push(`┊•.̇𖥨֗📌⭟ *${i + 1}. ${nome}*`)
        linhas.push(`┊      ID: \`${gid}\``)
      }
    }
    linhas.push('┊')
  }

  linhas.push(`┊•.̇𖥨֗💡⭟ *Comandos:*`)
  linhas.push(`┊   • \`${prefix}subbot vincular [numero]\` › Atrelar grupo atual`)
  linhas.push(`┊   • \`${prefix}subbot desvincular\` › Desatrelar grupo atual`)
  linhas.push('╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯')

  await sock.sendMessage(from, { text: linhas.join('\n') }, { quoted: msg })
  return true
}

async function executarConexaoSubbot(sock, msg, from, sender, rawNumber, prefix) {
  const cleanNumber = String(rawNumber).replace(/\D/g, '')
  if (cleanNumber.length < 8) {
    await sock.sendMessage(from, {
      text: '❌ *Número inválido!* Digite o número completo com DDI (ex: 258841234567).'
    }, { quoted: msg })
    return true
  }

  const existing = subbotManager.getSubbotPorNumero(cleanNumber)
  if (existing && existing.status === 'online') {
    await sock.sendMessage(from, {
      text: `⚠️ *O sub-bot +${cleanNumber} já está conectado e online!*`
    }, { quoted: msg })
    return true
  }

  await sock.sendMessage(from, {
    text: `⏳ *Iniciando conexão para o número +${cleanNumber}...*\n\nGerando código de pareamento, por favor aguarde alguns segundos...`
  }, { quoted: msg })

  try {
    let codigoEnviado = false

    await subbotManager.conectarSubbot({
      numero: cleanNumber,
      grupoId: from.endsWith('@g.us') ? from : null,
      autorJid: sender,
      onPairingCode: async (formattedCode, rawCode) => {
        if (codigoEnviado) return
        codigoEnviado = true

        const cardMsg = [
          '╭┈⊰ 👻 『 *SUB-BOT: CÓDIGO DE CONEXÃO* 』',
          '┊',
          `┊•.̇𖥨֗📱⭟ *Número Alvo:* +${cleanNumber}`,
          '┊•.̇𖥨֗🔑⭟ *Código de Pareamento:*',
          '┊',
          `┊     👉 *${formattedCode}* 👈`,
          '┊',
          '┊•.̇𖥨֗📋⭟ *Como conectar no WhatsApp:*',
          '┊  1. Abra o WhatsApp no aparelho desse chip.',
          '┊  2. Toque nos *3 pontinhos* (ou Configurações).',
          '┊  3. Selecione *Aparelhos Conectados*.',
          '┊  4. Toque em *Conectar um aparelho*.',
          '┊  5. Escolha *Conectar com número de telefone*.',
          '┊  6. Digite o código de 8 dígitos acima.',
          '┊',
          '┊•.̇𖥨֗⏱️⭟ *Atenção:* O código expira em ~60 segundos.',
          '╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯'
        ].join('\n')

        try {
          await sock.sendMessage(from, { text: cardMsg }, { quoted: msg })
          // Envia o código limpo na sequência para facilitar copiar no celular
          await sock.sendMessage(from, { text: `${rawCode || formattedCode.replace(/-/g, '')}` })
        } catch (sendErr) {
          console.error('[SUBBOT] Erro ao enviar mensagem do código:', sendErr.message)
        }
      },
      onConnected: async (num) => {
        try {
          await sock.sendMessage(from, {
            text: `🎉 *SUB-BOT CONECTADO COM SUCESSO!*\n\n📱 Chip: *+${num}*\n✅ Pronto para responder comandos e atender o grupo!`
          })
        } catch {}
      },
      onError: async (err) => {
        try {
          await sock.sendMessage(from, {
            text: `❌ *Erro ao gerar código para +${cleanNumber}:*\n${err.message || err}\n\n💡 Tente novamente usando: \`${prefix}conect ${cleanNumber}\``
          }, { quoted: msg })
        } catch {}
      }
    })
  } catch (err) {
    await sock.sendMessage(from, {
      text: `❌ *Erro ao iniciar conexão do sub-bot:* ${err.message}`
    }, { quoted: msg })
  }

  return true
}

async function executarRemoverSubbot(sock, msg, from, sender, rawNumber, isOwnerOrSubdono) {
  const cleanNumber = String(rawNumber).replace(/\D/g, '')
  const subbot = subbotManager.dados.subbots?.[cleanNumber]

  // Se for usuário autorizado (revendedor), ele só pode deletar o sub-bot se ele mesmo criou
  if (!isOwnerOrSubdono && subbot && subbot.criadoPor) {
    const senderClean = String(sender).split('@')[0].split(':')[0].replace(/\D/g, '')
    const criadorClean = String(subbot.criadoPor).split('@')[0].split(':')[0].replace(/\D/g, '')
    if (senderClean !== criadorClean) {
      await sock.sendMessage(from, {
        text: '❌ *Você só tem permissão para remover os sub-bots criados por você.*'
      }, { quoted: msg })
      return true
    }
  }

  await subbotManager.desconectarSubbot(cleanNumber, true)
  await sock.sendMessage(from, {
    text: `🗑️ *Sub-Bot +${cleanNumber} desconectado e removido com sucesso!*\n\nO bot principal reassumiu o atendimento de qualquer grupo que estava atrelado a ele.`
  }, { quoted: msg })
  return true
}
