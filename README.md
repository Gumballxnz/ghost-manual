# 👻 GhostBot Manual

[![npm version](https://img.shields.io/badge/npm-v1.0.0-cb3837.svg)](https://github.com/Gumballxnz/ghost-manual/packages)
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
npx @gumballxnz/ghost-manual --qr
```

### 2. Conexão via Código de Pareamento (Pairing Code)
```bash
npx @gumballxnz/ghost-manual --pair 25887xxxxxxx
```

Ou diretamente a partir do GitHub:
```bash
npx github:Gumballxnz/ghost-manual --qr
```

---

## 📦 Instalação e Configuração

### 🧙‍♂️ Modo Rápido: Assistente Interativo (Recomendado para VPS)

No seu terminal ou VPS recém-criada, basta clonar o repositório, instalar as dependências e iniciar o assistente:

```bash
git clone https://github.com/Gumballxnz/ghost-manual.git
cd ghost-manual
npm install
npm run setup
```

O assistente interativo vai guiar você em 3 etapas simples:
1. **Configuração Básica:** Pergunta o número do dono, nome do dono, nome do bot e prefixo, criando automaticamente o `data/config.json` e `.env`.
2. **Conexão com WhatsApp:** Escolha entre **Código de Pareamento de 8 dígitos** (ideal para VPS) ou **QR Code**, exibindo o código formatado no terminal para conectar direto no celular.
3. **Execução 24/7 (PM2):** Pergunta se deseja iniciar o bot em segundo plano no PM2 e já deixa tudo configurado e salvo para reinício automático após reboot da VPS.

---

### ⚙️ Modo Manual Avançado

Caso prefira configurar os arquivos manualmente:

#### 1. Configurar o Bot
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

#### 2. Conectar a Sessão
```bash
# Parear com código no terminal:
node index.js --pair 258XXXXXXXXX

# Ou escanear QR Code:
node index.js --qr
```

#### 3. Rodar em Produção (VPS via PM2)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o bot em background
pm2 start index.js --name "ghost-manual" --time

# Salvar lista para reinício automático no boot
pm2 save
pm2 startup

# Ver logs em tempo real
pm2 logs ghost-manual
```

---

## 📱 Hospedagem no Termux (Android)

Você pode rodar o bot diretamente no seu celular Android usando o aplicativo **Termux**:

1. **Instale os pacotes necessários:**
   ```bash
   pkg update && pkg upgrade -y
   pkg install git nodejs -y
   ```
2. **Clone e instale as dependências:**
   ```bash
   git clone https://github.com/Gumballxnz/ghost-manual.git
   cd ghost-manual
   npm install
   ```
3. **Execute o assistente interativo:**
   ```bash
   npm run setup
   ```
   > 💡 **Dica de ouro no Termux:** Escolha a **Opção 1 (Código de Pareamento)**! Em telas de celular, o QR Code em texto costuma quebrar e ficar ilegível. O código de 8 dígitos (`XXXX-XXXX`) cabe perfeitamente na tela.
   > ⚠️ **Na Etapa 3 (PM2):** Escolha **`n` (não usar PM2)**. Para evitar que o Android encerre o processo com a tela apagada, execute:
   > ```bash
   > termux-wake-lock
   > node index.js
   > ```

---

## ☁️ Hospedagem em Painéis Web (Lunes.host / Pterodactyl)

Para quem hospeda na **Lunes.host**, SquareCloud ou qualquer servidor baseado no painel **Pterodactyl**:

> ⚠️ **REGRA DE OURO:** **NUNCA use PM2 dentro de painéis Pterodactyl!**  
> O próprio painel Pterodactyl já monitora e mantém o bot ativo 24/7 em primeiro plano. Disparar PM2 fará o processo principal encerrar, e o painel achará que o bot caiu (`Crashed`), gerando reinícios em loop.

1. **Upload dos Arquivos:** Compacte os arquivos do bot (sem a pasta `node_modules` nem `session`) e envie pelo **Gerenciador de Arquivos** do painel da Lunes, descompactando na raiz.
2. **Configuração dos Dados:** No próprio navegador, renomeie `data/config.example.json` para `data/config.json` e edite com seu número de dono e preferências.
3. **Startup:** Na aba **Startup** (Inicialização), verifique se o comando está definido como `node index.js` (ou `npm start`).
4. **Conexão:** Vá na aba **Console** e clique no botão verde **Start**. O bot solicitará o método de conexão diretamente na caixa de comandos do console web.

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
| `.x9 [on/off]` | Notificações de administradores promovidos ou rebaixados | Admin |
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
