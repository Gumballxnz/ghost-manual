const config = require('../../../data/config.json')
const fs = require('fs')
const path = require('path')
const { isAdmin: checkIsAdmin, isOwnerCheck } = require('../../utils/baileys')

const imagemPath = path.join(__dirname, '../../../assets/limpar.png')

function criarImagemInfinita() {
    const assetsDir = path.dirname(imagemPath)
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true })
    }

    if (fs.existsSync(imagemPath)) return

    const altura = 65000
    const largura = 100

    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

    const ihdr = Buffer.alloc(25)
    ihdr.writeUInt32BE(13, 0)
    ihdr.write('IHDR', 4)
    ihdr.writeUInt32BE(largura, 8)
    ihdr.writeUInt32BE(altura, 12)
    ihdr.writeUInt8(8, 16)
    ihdr.writeUInt8(2, 17)
    ihdr.writeUInt8(0, 18)
    ihdr.writeUInt8(0, 19)
    ihdr.writeUInt8(0, 20)
    ihdr.writeUInt32BE(0x00000000, 21)

    const zlib = require('zlib')

    const rawData = Buffer.alloc(altura * (1 + largura * 3), 255)
    for (let y = 0; y < altura; y++) {
        const offset = y * (1 + largura * 3)
        rawData[offset] = 0
    }

    const compressedData = zlib.deflateSync(rawData)

    const idat = Buffer.alloc(12 + compressedData.length)
    idat.writeUInt32BE(compressedData.length, 0)
    idat.write('IDAT', 4)
    compressedData.copy(idat, 8)
    idat.writeUInt32BE(0, 8 + compressedData.length)

    const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])

    const png = Buffer.concat([signature, ihdr, idat, iend])
    fs.writeFileSync(imagemPath, png)

    console.log('[LIMPAR] Imagem infinita v2 criada:', imagemPath)
}

module.exports = async (sock, msg, from, sender, text) => {
    if (text !== config.prefix + 'limpar') return false

    const isOwner = isOwnerCheck(sender, msg)

    let isGroupAdmin = false
    try {
        if (!isOwner && from.endsWith('@g.us')) {
            isGroupAdmin = await checkIsAdmin(sock, from, sender)
        }
    } catch { }

    if (!isGroupAdmin && !isOwner) {
        await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar este comando.' }, { quoted: msg })
        return true
    }

    const space = '‎      \n'.repeat(500)

    await sock.sendMessage(from, {
        text: `${space}🤖 LIMPEZA CONCLUÍDA ✅`
    })

    return true
}
