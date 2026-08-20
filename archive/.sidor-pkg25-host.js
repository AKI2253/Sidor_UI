return {
  apply(ctx) {
    const api = ctx.get('apiProxy')
    const agents = ctx.get('agents')
    const commandsSvc = ctx.get('commands')
    const skillsSvc = ctx.get('skills')
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

    /* command + skill quick-pick data: merge live agent commands and skill catalog */
    harness.handle('sidor/commands', async (args) => {
      const out = { commands: [], skills: [] }
      try {
        if (agents && commandsSvc) {
          const agent = args.sessionId ? agents.get(args.sessionId) : undefined
          if (agent) {
            const list = commandsSvc.list(agent)
            if (list) out.commands = list.map((c) => ({ name: c.name, description: c.description || '' }))
          }
        }
      } catch (e) { /* keep empty */ }
      try {
        if (skillsSvc && typeof skillsSvc.list === 'function') {
          const items = await skillsSvc.list()
          if (Array.isArray(items)) {
            out.skills = items.map((s) => ({ name: s.name || '', description: s.description || '' }))
          }
        }
      } catch (e) { /* keep empty */ }
      return { ok: true, data: out }
    })
  },
}
