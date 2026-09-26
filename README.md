# 👻 GhostBot Manual

[![npm version](https://img.shields.io/badge/npm-v1.0.0-cb3837.svg)](https://www.npmjs.com/package/@gumballwotersan/ghost-manual)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Baileys](https://img.shields.io/badge/Baileys-v6.7+-blue.svg)](https://github.com/WhiskeySockets/Baileys)

> **Bot profissional de moderação de grupos e gestão manual de megas/saldo no WhatsApp**, construído com a biblioteca [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys).

---

## ⚡ Visão Geral

O **GhostBot Manual** é uma versão independente, modular e de código aberto focada exclusivamente em:
1. **Moderação Completa de Grupos:** Anti-link, anti-mídia seletivo, anti-flood, anti-bot, anti-gringo, boas-vindas e agendador automático de abertura/fechamento de grupos.
2. **Gestão Manual de Vendas e Tabelas:** Leitura inteligente de comprovantes (M-Pesa e e-Mola) com anti-fraude/anti-duplicação, tabelas de preços customizáveis por grupo (`.tabela`, `.tabelasaldo`) e configuração de contas de recebimento.
3. **Controle Administrativo:** Gestão de administradores, subdonos, avisos em massa (`.todos`), banimentos e auditoria.

> 💡 **Nota:** Esta versão é 100% manual e não contém rotinas automáticas de leitura bancária ou webhooks privados.

---

## 🚀 Execução Rápida (NPX / Sem Instalar Nada)

Você pode executar o GhostBot Manual diretamente do terminal sem precisar clonar o repositório:

### 1. Conexão via QR Code
```bash
npx @gumballwotersan/ghost-manual --qr
```

### 2. Conexão via Código de Pareamento (Pairing Code)
```bash
npx @gumballwotersan/ghost-manual --pair 25887xxxxxxx
```

Ou diretamente a partir do GitHub:
```bash
npx github:Gumballxnz/ghost-manual --qr
```

---

## 📦 Instalação Tradicional (Git Clone)

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/Gumballxnz/ghost-manual.git
cd ghost-manual
npm install
```

### 2. Configurar o Bot
Copie o arquivo de exemplo de configuração:
```bash
cp data/config.example.json data/config.json
```

Edite `data/config.json` com suas preferências:
```json
{
  "prefix": ".",
  "dono": ["258XXXXXXXXX"],
  "ownerDisplayNumber": "258XXXXXXXXX",
  "ownerName": "Seu Nome",
  "botName": "GHOST BOT",
  "canalLink": "",
  "botaoExtra": "Sobre o bot"
}
```

### 3. Conectar a Sessão
```bash
# Parear com código no terminal:
node index.js --pair 258XXXXXXXXX

# Ou escanear QR Code:
node index.js --qr
```

### 4. Rodar em Produção (VPS via PM2)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o bot em background
pm2 start index.js --name "ghost-manual"

# Salvar lista para reinício automático no boot
pm2 save
pm2 startup

# Ver logs em tempo real
pm2 logs ghost-manual
```

---

## 📱 Lista de Comandos Principais

### 🛡️ Moderação & Proteção de Grupos
| Comando | Descrição | Nível |
| :--- | :--- | :--- |
| `.antifoto [on/off]` | Bloqueia envio de fotos no grupo | Admin |
| `.antivideo [on/off]` | Bloqueia envio de vídeos no grupo | Admin |
| `.antimidia [on/off]` | Bloqueia todas as mídias (foto, vídeo, áudio, doc) | Admin |
| `.antilink [on/off]` | Expulsa membros que enviarem links de outros grupos | Admin |
| `.antigringo [on/off]` | Remove números com DDI internacional suspeito | Admin |
| `.antibot [on/off]` | Expulsa outros bots que entrarem no grupo | Admin |
| `.antiflood [on/off]` | Proteção contra spam de mensagens seguidas | Admin |
| `.ban @membro` | Remove um membro do grupo | Admin |
| `.mute [minutos]` | Silencia o grupo temporariamente | Admin |

### 👥 Gestão de Grupos
| Comando | Descrição | Nível |
| :--- | :--- | :--- |
| `.grupo [abrir/fechar]` | Abre ou fecha o grupo para mensagens de membros | Admin |
| `.alarme [abrir HH:MM / fechar HH:MM]` | Agenda horário diário para abrir/fechar o grupo | Admin |
| `.bemvindo [on/off]` | Mensagem de recepção automática para novos membros | Admin |
| `.todos [texto]` | Menciona todos os participantes do grupo | Admin |
| `.aviso [texto]` | Envia um comunicado oficial no grupo | Admin |
| `.linkgp` | Gera o link de convite atual do grupo | Admin |
| `.infogp` | Exibe as configurações e contadores do grupo | Todos |

### 📦 Vendas Manuais & Tabelas
| Comando | Descrição | Nível |
| :--- | :--- | :--- |
| `.tabela` | Exibe a tabela de megas configurada no grupo | Todos |
| `.tabelasaldo` | Exibe a tabela de saldo configurada no grupo | Todos |
| `.configurar tabela/[texto]` | Personaliza a tabela de megas do grupo | Admin |
| `.configurar saldo/[texto]` | Personaliza a tabela de saldo do grupo | Admin |
| `.configurar M-Pesa [número] [nome]` | Cadastra conta de recebimento M-Pesa | Admin |
| `.configurar E-mola [número] [nome]` | Cadastra conta de recebimento E-mola | Admin |
| `.configurar listar` | Lista as contas cadastradas para pagamento | Admin |
| `.compras` | Histórico e auditoria de compras no grupo | Admin |
| `.perfil` | Consulta estatísticas do membro no grupo | Todos |

### ⚙️ Painel do Dono & Configurações
| Comando | Descrição | Nível |
| :--- | :--- | :--- |
| `.menu` | Menu visual interativo com todos os comandos | Todos |
| `.menuadm` | Painel de controle de ferramentas administrativas | Admin |
| `.menudono` | Configurações avançadas do sistema | Dono |
| `.prefixo [caractere]` | Altera o prefixo de comandos no grupo | Admin |
| `.subdono [add/remove]` | Gerencia administradores de nível superior | Dono |
| `.status` | Mostra consumo de memória, CPU e uptime do bot | Dono |

---

## 🔒 Segurança e Privacidade

- **Sem Telemetria Oculta:** O bot não envia estatísticas para servidores externos.
- **Sessão Local:** Todas as credenciais de autenticação Baileys permanecem criptografadas na pasta `session/` local.
- **Pruner Integrado:** Otimizador periódico de chaves pré-estabelecidas para evitar lentidão e estouro de memória na VPS.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.

Desenvolvido por **[Gumballwotersan](https://github.com/Gumballxnz)**.
