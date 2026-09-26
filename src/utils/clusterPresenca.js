// Módulo desativado: O sistema agora opera com conexão única (1 bot exclusivo, sem backup/cluster)

function getRoleId() {
    return 'principal'
}

async function publicarPresenca() {
    return Promise.resolve()
}

function iniciarListenerCluster() {
    // No-op: conexao única, sem necessidade de listener SSE
}

function souLiderDoGrupo() {
    // Conexão única: o bot é sempre o líder exclusivo de todos os grupos
    return true
}

function obterEstadoCluster() {
    return {
        status: 'ONLINE',
        modo: 'unico',
        conexoes: 1
    }
}

module.exports = {
    vpsId: 'vps1',
    publicarPresenca,
    iniciarListenerCluster,
    souLiderDoGrupo,
    obterEstadoCluster
}
