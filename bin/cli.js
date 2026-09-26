#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

// Garante que o diretório de execução seja a raiz do pacote ou o diretório de trabalho atual
const configPath = path.resolve(process.cwd(), 'data/config.json')
const localConfigPath = path.resolve(__dirname, '../data/config.json')

if (!fs.existsSync(configPath) && !fs.existsSync(localConfigPath)) {
  const exampleConfig = path.resolve(__dirname, '../data/config.example.json')
  if (fs.existsSync(exampleConfig)) {
    const targetDir = path.resolve(process.cwd(), 'data')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    fs.copyFileSync(exampleConfig, path.join(targetDir, 'config.json'))
    console.log('\x1b[32m[GHOST-MANUAL]\x1b[0m Arquivo data/config.json gerado automaticamente a partir de config.example.json!')
  }
}

const envPath = path.resolve(process.cwd(), '.env')
const localEnvPath = path.resolve(__dirname, '../.env')
if (!fs.existsSync(envPath) && !fs.existsSync(localEnvPath)) {
  const exampleEnv = path.resolve(__dirname, '../.env.example')
  if (fs.existsSync(exampleEnv)) {
    fs.copyFileSync(exampleEnv, envPath)
    console.log('\x1b[32m[GHOST-MANUAL]\x1b[0m Arquivo .env gerado a partir de .env.example!')
  }
}

// Inicia o bot
require('../index.js')
