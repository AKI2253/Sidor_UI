return {
  apply(ctx) {
    const api = ctx.get('apiProxy')
    const rid = () => 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
    const norm = (res) => {
      const r = res && res.result ? res.result : null
      if (!r) return { ok: false, error: { code: 'no-result', message: 'no result' } }
      return r.ok ? { ok: true, data: r.value } : { ok: false, error: r.error }
    }

    harness.handle('sidor/ping', async (args) => {
      return { ok: true, pkg: 'sidor-shell', ts: Date.now() }
    })

    harness.handle('sidor/models', async (args) => {
      if (!api || !api.sessions || typeof api.sessions.models !== 'function') {
        return { ok: false, error: { code: 'no-api', message: 'apiProxy unavailable' } }
      }
      const res = await api.sessions.models({ rpcId: rid(), payload: { sessionId: args.sessionId } })
      return norm(res)
    })

    harness.handle('sidor/selectModel', async (args) => {
      if (!api || !api.sessions || typeof api.sessions.selectModel !== 'function') {
        return { ok: false, error: { code: 'no-api', message: 'apiProxy unavailable' } }
      }
      const payload = { sessionId: args.sessionId, provider: args.provider, model: args.model }
      if (args.reasoningEffort) payload.reasoningEffort = args.reasoningEffort
      const res = await api.sessions.selectModel({ rpcId: rid(), payload: payload })
      return norm(res)
    })
  },
}
