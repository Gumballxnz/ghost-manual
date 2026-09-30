class MessageQueue {
    constructor(concurrency = 3, minDelay = 50) {
        this.highPriorityQueue = []
        this.normalQueue = []
        this.concurrency = concurrency
        this.minDelay = minDelay
        this.activeWorkers = 0
        this.maxRetries = 2
        this.paused = false
        this.throttleTimer = null
    }

    async add(fn, isHighPriority = true, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const item = { fn, resolve, reject, retries: 0, isHighPriority, timeoutMs }
            if (isHighPriority) {
                this.highPriorityQueue.push(item)
            } else {
                this.normalQueue.push(item)
            }
            this.dispatch()
        })
    }

    pause() {
        this.paused = true
    }

    flush() {
        const pending = [...this.highPriorityQueue, ...this.normalQueue]
        this.highPriorityQueue = []
        this.normalQueue = []
        for (const item of pending) {
            item.reject(new Error('Conexão perdida, mensagem descartada'))
        }
    }

    resume() {
        this.paused = false
        if (this.throttleTimer) {
            clearTimeout(this.throttleTimer)
            this.throttleTimer = null
        }
        this.dispatch()
    }

    dispatch() {
        while (this.activeWorkers < this.concurrency && (this.highPriorityQueue.length > 0 || (!this.paused && this.normalQueue.length > 0))) {
            const item = this.highPriorityQueue.length > 0
                ? this.highPriorityQueue.shift()
                : (!this.paused ? this.normalQueue.shift() : null)
            if (!item) break

            this.activeWorkers++
            this.executeItem(item).finally(() => {
                this.activeWorkers--
                this.dispatch()
            })
        }
    }

    async executeItem(item) {
        const { fn, resolve, reject, retries, isHighPriority, timeoutMs } = item
        let timer = null

        try {
            const timeoutLimit = timeoutMs || 10000
            const timeoutPromise = new Promise((_, rej) => {
                timer = setTimeout(() => rej(new Error(`Timed Out (${Math.round(timeoutLimit / 1000)}s)`)), timeoutLimit)
            })

            const result = await Promise.race([fn(), timeoutPromise])
            if (timer) clearTimeout(timer)
            resolve(result)
        } catch (err) {
            if (timer) clearTimeout(timer)

            const isRateLimit = err.message && (
                err.message.includes('rate-overlimit') ||
                err.message.includes('429') ||
                err.message.includes('Too Many Requests')
            )

            if (isRateLimit && retries < this.maxRetries) {
                const backoffMs = Math.min(500 * Math.pow(1.5, retries), 2000)
                console.log(`[QUEUE] ⚠️ Rate-limit detectado. Reagendando mensagem (${retries + 1}/${this.maxRetries}) em ${Math.round(backoffMs)}ms...`)

                if (!this.throttleTimer) {
                    this.paused = true
                    this.throttleTimer = setTimeout(() => {
                        this.paused = false
                        this.throttleTimer = null
                        this.dispatch()
                    }, backoffMs)
                }

                const retryItem = { fn, resolve, reject, retries: retries + 1, isHighPriority, timeoutMs }
                if (isHighPriority) {
                    this.highPriorityQueue.push(retryItem)
                } else {
                    this.normalQueue.push(retryItem)
                }
            } else {
                if (isRateLimit) {
                    console.error(`[QUEUE] Rate-limit persistente após ${this.maxRetries} tentativas. Descartando.`)
                } else {
                    console.error('[QUEUE] Erro na execução:', err.message)
                }
                reject(err)
            }
        }

        if (this.minDelay > 0) {
            await new Promise(r => setTimeout(r, this.minDelay))
        }
    }
}

module.exports = MessageQueue
