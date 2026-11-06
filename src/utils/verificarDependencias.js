const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Garante que as dependências necessárias para OCR e leitura de PDFs
 * estejam instaladas tanto a nível de sistema operacional (Ubuntu/Debian)
 * quanto a nível de pacotes Node.js (npm).
 */
function verificarEInstalarDependencias() {
  const isLinux = process.platform === 'linux'

  // 1. Verificar dependências do sistema operacional
  let temTesseract = false
  let temPoppler = false

  try {
    execSync('which tesseract || command -v tesseract', { stdio: 'ignore' })
    temTesseract = true
  } catch {}

  try {
    execSync('which pdftoppm || command -v pdftoppm', { stdio: 'ignore' })
    temPoppler = true
  } catch {}

  if ((!temTesseract || !temPoppler) && isLinux) {
    let temApt = false
    try {
      execSync('which apt-get || command -v apt-get', { stdio: 'ignore' })
      temApt = true
    } catch {}

    if (temApt) {
      console.log('\n[SISTEMA] ⚙️  Dependências de leitura de comprovantes (OCR/PDF) não encontradas.')
      console.log('[SISTEMA] 📦 Instalando tesseract-ocr e poppler-utils via apt-get...')
      try {
        const cmd = process.getuid && process.getuid() === 0
          ? 'apt-get update -qq && apt-get install -y -qq tesseract-ocr tesseract-ocr-por tesseract-ocr-eng poppler-utils'
          : 'sudo apt-get update -qq && sudo apt-get install -y -qq tesseract-ocr tesseract-ocr-por tesseract-ocr-eng poppler-utils'
        execSync(cmd, { stdio: 'inherit' })
        console.log('[SISTEMA] ✅ Dependências do sistema instaladas com sucesso!\n')
      } catch (errApt) {
        console.warn('[SISTEMA] ⚠️  Não foi possível instalar pacotes do sistema automaticamente:', errApt.message)
        console.warn('👉 Para leitura de comprovantes, instale manualmente: sudo apt-get install -y tesseract-ocr tesseract-ocr-por poppler-utils')
      }
    }
  }

  // 2. Verificar dependências Node.js (npm)
  const modulosNecessarios = ['node-tesseract-ocr', 'pdf-parse']
  const modulosFaltantes = []

  for (const mod of modulosNecessarios) {
    try {
      require.resolve(mod)
    } catch {
      modulosFaltantes.push(mod)
    }
  }

  if (modulosFaltantes.length > 0) {
    console.log(`[NODE] 📦 Instalando módulos faltantes para leitura de comprovantes: ${modulosFaltantes.join(', ')}...`)
    try {
      execSync(`npm install ${modulosFaltantes.join(' ')} --save --no-audit --no-fund`, {
        cwd: path.resolve(__dirname, '../../'),
        stdio: 'inherit'
      })
      console.log('[NODE] ✅ Módulos instalados com sucesso!\n')
    } catch (errNpm) {
      console.error('[NODE] ❌ Erro ao instalar módulos npm automaticamente:', errNpm.message)
      console.error(`👉 Execute manualmente no diretório do bot: npm install ${modulosFaltantes.join(' ')}`)
    }
  }
}

module.exports = { verificarEInstalarDependencias }
