let rawFbUrl = process.env.FIREBASE_DB_URL || process.env.FIREBASE_DATABASE_URL || ''
rawFbUrl = (rawFbUrl || '').replace(/\\/g, '').replace(/["']/g, '').trim()

let firebaseUrl = rawFbUrl

if (!firebaseUrl) {
    try {
        const config = require('../../data/config.json')
        if (config && config.firebaseUrl && !config.firebaseUrl.includes('seu-projeto')) {
            firebaseUrl = config.firebaseUrl
        }
    } catch {}
}

firebaseUrl = firebaseUrl.replace(/\/+$/, '')
const firebaseHost = firebaseUrl.replace(/^https?:\/\//, '')

const https = require('https')

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 16,
    keepAliveMsecs: 15000
})

function buildFirebaseUrl(path) {
    let cleanPath = (path || '').replace(/^\/+/, '')
    let query = ''
    if (cleanPath.includes('?')) {
        const parts = cleanPath.split('?')
        cleanPath = parts[0]
        query = '?' + parts[1]
    }
    return `${firebaseUrl}/${cleanPath}.json${query}`
}

function fetchFirebase(path, isRetry = false) {
    if (!firebaseUrl) return Promise.resolve(null)
    return new Promise(res => {
        const url = buildFirebaseUrl(path)
        const req = https.get(url, { agent: isRetry ? false : httpsAgent, timeout: 5000 }, r => {
            let d = ''
            r.on('data', c => d += c)
            r.on('end', () => {
                try { res(JSON.parse(d)) } catch { res(null) }
            })
        })
        req.on('error', (err) => {
            if (!isRetry && (err.message.includes('socket hang up') || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
                return fetchFirebase(path, true).then(res)
            }
            res(null)
        })
        req.on('timeout', () => {
            req.destroy()
            if (!isRetry) {
                return fetchFirebase(path, true).then(res)
            }
            res(null)
        })
    })
}

function putFirebase(path, data, isRetry = false) {
    if (!firebaseUrl) return Promise.resolve(false)
    return new Promise(res => {
        try {
            const pData = JSON.stringify(data)
            const url = buildFirebaseUrl(path)
            const req = https.request(url, {
                method: 'PUT',
                agent: isRetry ? false : httpsAgent,
                timeout: 5000,
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pData) }
            }, r => {
                r.resume()
                res(r.statusCode >= 200 && r.statusCode < 300)
            })
            req.on('error', (err) => {
                if (!isRetry && (err.message.includes('socket hang up') || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
                    return putFirebase(path, data, true).then(res)
                }
                console.error('[PUT_ERROR]', path, err.message)
                res(false)
            })
            req.on('timeout', () => {
                req.destroy()
                if (!isRetry) {
                    return putFirebase(path, data, true).then(res)
                }
                console.error('[PUT_TIMEOUT]', path)
                res(false)
            })
            req.write(pData)
            req.end()
        } catch (err) {
            console.error('[PUT_EXCEPTION]', path, err.message)
            res(false)
        }
    })
}

function patchFirebase(path, data, isRetry = false) {
    if (!firebaseUrl) return Promise.resolve(false)
    return new Promise(res => {
        try {
            const pData = JSON.stringify(data)
            const url = buildFirebaseUrl(path)
            const req = https.request(url, {
                method: 'PATCH',
                agent: isRetry ? false : httpsAgent,
                timeout: 5000,
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pData) }
            }, r => {
                r.resume()
                res(r.statusCode >= 200 && r.statusCode < 300)
            })
            req.on('error', (err) => {
                if (!isRetry && (err.message.includes('socket hang up') || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
                    return patchFirebase(path, data, true).then(res)
                }
                console.error('[PATCH_ERROR]', path, err.message)
                res(false)
            })
            req.on('timeout', () => {
                req.destroy()
                if (!isRetry) {
                    return patchFirebase(path, data, true).then(res)
                }
                console.error('[PATCH_TIMEOUT]', path)
                res(false)
            })
            req.write(pData)
            req.end()
        } catch (err) {
            console.error('[PATCH_EXCEPTION]', path, err.message)
            res(false)
        }
    })
}

function deleteFirebase(path) {
    if (!firebaseUrl) return Promise.resolve(false)
    return new Promise(res => {
        try {
            const url = buildFirebaseUrl(path)
            const req = https.request(url, {
                method: 'DELETE',
                agent: httpsAgent,
                timeout: 10000
            }, r => {
                r.resume()
                res(r.statusCode >= 200 && r.statusCode < 300)
            })
            req.on('error', () => res(false))
            req.on('timeout', () => { req.destroy(); res(false) })
            req.end()
        } catch {
            res(false)
        }
    })
}

module.exports = {
    FIREBASE_DB_URL: firebaseUrl,
    FIREBASE_HOST: firebaseHost,
    httpsAgent,
    buildFirebaseUrl,
    fetchFirebase,
    putFirebase,
    patchFirebase,
    deleteFirebase
}
