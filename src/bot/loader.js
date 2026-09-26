const fs = require('fs')
const path = require('path')

function loadCommandDir(dirPath) {
  const commands = []
  if (!fs.existsSync(dirPath)) return commands

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'))

  for (const file of files) {
    try {
      const mod = require(path.join(dirPath, file))
      const fn = typeof mod === 'function' ? mod : (typeof mod?.execute === 'function' ? mod.execute : null)
      if (fn) {
        commands.push(fn)
      } else {
        console.warn(`⚠️ Comando ignorado (não exporta função): ${file}`)
      }
    } catch (err) {
      console.error(`❌ Erro ao carregar comando ${file}:`, err)
    }
  }

  return commands
}

const admCommands = loadCommandDir(path.join(__dirname, '../comandos/adm'))
const memberCommands = loadCommandDir(path.join(__dirname, '../comandos/membros'))

module.exports = { admCommands, memberCommands }
