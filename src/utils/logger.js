function logEvent(event, details) {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${event}]`, details)
}

module.exports = { logEvent }
