return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    /* ==================================================================
     * global crash surfacing + escape hatch (independent of React)
     * ================================================================== */
    function showCrash(msg) {
      try {
        let bar = document.getElementById('sid-crash-bar')
        if (!bar) {
          bar = document.createElement('div')
          bar.id = 'sid-crash-bar'
          document.body.appendChild(bar)
        }
        bar.textContent = 'SIDOR error: ' + String(msg)
        bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:8px 12px;background:#7f1d1d;color:#fff;font:12px/18px ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;'
      } catch (e) { /* ignore */ }
    }
    const onGlobalError = (e) => showCrash(e && e.message ? e.message : String(e))
    const onGlobalRejection = (e) => {
      const r = e && e.reason
      showCrash('unhandled rejection: ' + (r && r.message ? r.message : String(r)))
    }
    window.addEventListener('error', onGlobalError)
    window.addEventListener('unhandledrejection', onGlobalRejection)
    const onDocKey = (e) => {
      /* escape: close through React only — never touch the DOM manually,
       * or React's reconciliation will crash on a stale node reference */
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onDocKey)
    ctx.effect(() => () => {
      window.removeEventListener('error', onGlobalError)
      window.removeEventListener('unhandledrejection', onGlobalRejection)
      document.removeEventListener('keydown', onDocKey)
      try {
        const bar = document.getElementById('sid-crash-bar')
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar)
      } catch (e) { /* ignore */ }
    })

    /* ==================================================================
     * data layer — same-origin /api RPC + events.mux, mirroring dsh
     * (the PRTS approach: no official UI components, only the protocol)
     * ================================================================== */

    const api = (() => {
      let seq = 0
      const rid = () => 'sid-' + Date.now().toString(36) + '-' + (++seq).toString(36) + '-' + Math.random().toString(36).slice(2, 8)
      async function request(method, payload, opts) {
        const env = { type: 'client-request', rpcId: rid(), method, payload: payload || {} }
        const timeoutMs = opts && opts.timeoutMs
        const ac = timeoutMs ? new AbortController() : null
        const timer = ac ? ctx.timeout(() => ac.abort(), timeoutMs) : null
        let res
        try {
          res = await fetch('/api/' + method, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(env),
            signal: ac ? ac.signal : undefined,
          })
        } catch (e) {
          throw new Error('dsh: network error')
        } finally {
          if (timer) timer()
        }
        if (!res.ok) throw new Error('dsh: HTTP ' + res.status)
        const body = await res.json().catch(() => null)
        if (body && body.type === 'server-response' && body.result) {
          if (body.result.ok) return body.result.value
          const e = body.result.error || {}
          const err = new Error(e.message || ('dsh: ' + method))
          err.code = e.code
          err.details = e.details
          throw err
        }
        throw new Error('dsh: unexpected response')
      }
      async function respond(rpcIdValue, value) {
        const result = value && value.ok !== undefined && (value.value !== undefined || value.error !== undefined)
          ? value : { ok: true, value }
        try {
          await fetch('/api/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'client-response', rpcId: rpcIdValue, result }),
          })
        } catch (e) { /* noop */ }
      }
      return { request, respond }
    })()

    const mux = (() => {
      const listeners = new Map()
      let ws = null
      let closed = false
      let retry = null
      const emit = (t, f) => {
        const s = listeners.get(t)
        if (s) for (const fn of Array.from(s)) { try { fn(f) } catch (e) { /* ignore */ } }
      }
      const handle = (msg) => {
        if (!msg || typeof msg !== 'object') return
        if (msg.type === 'server-request') {
          emit(msg.method, msg)
          if (msg.payload && msg.payload.type && msg.payload.type !== msg.method) emit(msg.payload.type, msg)
        }
      }
      const schedule = () => {
        if (closed) return
        if (retry) { retry(); retry = null }
        retry = ctx.timeout(connect, 1500)
      }
      const connect = () => {
        if (closed) return
        if (retry) { retry(); retry = null }
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
        try {
          ws = new WebSocket(proto + '//' + location.host + '/api/events.mux')
        } catch (e) { schedule(); return }
        ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data) } catch (err) { return } handle(m) }
        ws.onclose = () => { if (!closed) schedule() }
        ws.onerror = () => { try { ws && ws.close() } catch (e) { /* ignore */ } }
      }
      const on = (t, fn) => {
        if (!listeners.has(t)) listeners.set(t, new Set())
        listeners.get(t).add(fn)
        return () => { const s = listeners.get(t); if (s) s.delete(fn) }
      }
      const close = () => {
        closed = true
        if (retry) { retry(); retry = null }
        if (ws) { try { ws.close() } catch (e) { /* ignore */ } }
      }
      return { on, connect, close }
    })()
    ctx.effect(() => () => mux.close())

    /* ==================================================================
     * store — mirror of dsh state (no own session/history data)
     * ================================================================== */

    const store = {
      ready: false,
      connected: false,
      workspaces: [],
      archived: [],
      sessions: [],
      models: [],
      presets: [],
      wsId: null,
      sessionId: null,
      sessionInfo: null,
      currentModel: null,
      projections: {},
      messages: [],
      hasMore: false,
      loading: false,
      streaming: false,
      query: '',
    }
    const subs = new Set()
    function emitStore() { for (const l of Array.from(subs)) l() }
    function setStore(p) { Object.assign(store, p); emitStore() }
    function useStore() {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const l = () => force((n) => n + 1)
        subs.add(l)
        return () => { subs.delete(l) }
      }, [])
      return store
    }

    /* throttled re-render for streaming bursts (mirrors PRTS 90ms fold) */
    let renderPending = false
    let lastRenderAt = 0
    let renderTimer = null
    function scheduleRender() {
      if (renderPending) return
      renderPending = true
      requestAnimationFrame(() => {
        renderPending = false
        const now = performance.now()
        if (now - lastRenderAt < 90) {
          renderTimer = ctx.timeout(scheduleRender, 90 - (now - lastRenderAt))
          return
        }
        lastRenderAt = now
        emitStore()
      })
    }

    /* ==================================================================
     * toast
     * ================================================================== */
    let toastMsg = null
    const toastSubs = new Set()
    const toastTimers = new Set()
    ctx.effect(() => () => { for (const d of toastTimers) d(); toastTimers.clear() })
    function toast(msg) {
      toastMsg = msg
      for (const l of Array.from(toastSubs)) l()
      const d = ctx.timeout(() => { toastTimers.delete(d); toastMsg = null; for (const l of Array.from(toastSubs)) l() }, 2600)
      toastTimers.add(d)
    }
    function useToast() {
      const [v, setV] = React.useState(toastMsg)
      React.useEffect(() => {
        const l = () => setV(toastMsg)
        toastSubs.add(l)
        return () => { toastSubs.delete(l) }
      }, [])
      return v
    }

    /* ==================================================================
     * typography + icons (monochrome geometric)
     * ================================================================== */
    const FONT_LATIN = "'Georgia', 'Times New Roman', 'Noto Serif SC', serif"
    const FONT_CJK = "'Noto Serif SC', 'Songti SC', 'SimSun', 'Microsoft YaHei', serif"
    const STAR_14 = 'M7 0.8 8.6 5.4 13.2 7 8.6 8.6 7 13.2 5.4 8.6 0.8 7 5.4 5.4 Z'
    const STAR_96 = 'M48 5.5 59 37 90.5 48 59 59 48 90.5 37 59 5.5 48 37 37 Z'
    const STAR_12 = 'M6 0.7 7.4 4.6 11.3 6 7.4 7.4 6 11.3 4.6 7.4 0.7 6 4.6 4.6 Z'
    const svg = (inner, size) =>
      '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 14 14" fill="none" aria-hidden="true">' + inner + '</svg>'
    const IC = {
      mark: svg('<path d="' + STAR_14 + '" fill="currentColor"/>'),
      markGhost: '<svg width="460" height="460" viewBox="0 0 96 96" fill="none" aria-hidden="true"><defs><filter id="sid-ghost-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.8"/></filter></defs><path d="' + STAR_96 + '" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" filter="url(#sid-ghost-glow)" opacity="0.55"/><path d="' + STAR_96 + '" fill="currentColor" opacity="0.07"/><path d="' + STAR_96 + '" stroke="currentColor" stroke-width="0.9" stroke-linejoin="round" opacity="0.65"/></svg>',
      send: svg('<path d="M7 1.5 12.5 7 7 12.5M1.5 7h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'),
      stop: svg('<rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="currentColor"/>'),
      plus: svg('<path d="M7 1.5v11M1.5 7h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
      search: svg('<circle cx="6" cy="6" r="3.8" stroke="currentColor" stroke-width="1.3"/><path d="M9 9l3.4 3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'),
      settings: svg('<circle cx="7" cy="7" r="2.1" stroke="currentColor" stroke-width="1.3"/><path d="M7 1.6v1.7M7 10.7v1.7M1.6 7h1.7M10.7 7h1.7M3.2 3.2l1.2 1.2M9.6 9.6l1.2 1.2M10.8 3.2 9.6 4.4M4.4 9.6 3.2 10.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'),
      close: svg('<path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
      tool: svg('<path d="M5.2 2.5h5.6v1.4H5.2zM5.2 5.3h5.6v1.4H5.2zM3 2.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM3 5.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM5.2 8.1h5.6v1.4H5.2zM3 8.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="currentColor"/>'),
    }
    const dustSvg = (s) =>
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="' + STAR_12 + '" fill="currentColor"/></svg>'
    const DUST = [
      { x: 14, y: 20, s: 11, p: 2.6, d: 0.0 },
      { x: 86, y: 16, s: 9, p: 3.4, d: 0.7 },
      { x: 10, y: 62, s: 8, p: 4.1, d: 1.4 },
      { x: 90, y: 64, s: 10, p: 2.9, d: 0.3 },
      { x: 48, y: 10, s: 7, p: 3.7, d: 1.1 },
      { x: 30, y: 84, s: 9, p: 3.2, d: 1.8 },
      { x: 72, y: 80, s: 8, p: 2.4, d: 0.9 },
    ]

    /* ==================================================================
     * particle engine (intro + starfield)
     * ================================================================== */
    function createParticleEngine(canvas, opts) {
      opts = opts || {}
      const COUNT = opts.count || 6800
      let inkVar = opts.inkVar || '--dsw-alias-label-primary'
      const ctx2d = canvas.getContext('2d')
      const scratch = document.createElement('canvas')
      const sctx = scratch.getContext('2d', { willReadFrequently: true })
      const mouse = { x: 0, y: 0, active: false }
      const state = { running: false, ink: '#888888', frame: 0, sizeScale: 1.5, speedScale: 1, driftScale: 1, ambientA: 0.05, disturb: null }
      let W = 0, H = 0, CX = 0, CY = 0
      let particles = []
      let model = null
      let modelBox = null
      let raf = 0
      let t0 = 0
      let dissipating = false
      const sec = () => (performance.now() - t0) / 1000

      function readInk() {
        try {
          const s = getComputedStyle(document.documentElement)
          const v = s.getPropertyValue(inkVar).trim()
          if (v) return v
        } catch (e) { /* ignore */ }
        return '#888888'
      }
      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        W = canvas.clientWidth || window.innerWidth
        H = canvas.clientHeight || window.innerHeight
        canvas.width = Math.max(1, Math.floor(W * dpr))
        canvas.height = Math.max(1, Math.floor(H * dpr))
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
        CX = W / 2
        CY = H / 2
        if (particles.length && !model) {
          for (const p of particles) {
            p.x = (Math.random() - 0.5) * W * 1.4
            p.y = (Math.random() - 0.5) * H * 1.4
          }
        }
      }
      function spawn() {
        particles = []
        for (let i = 0; i < COUNT; i++) {
          particles.push({
            x: (Math.random() - 0.5) * W * 1.4,
            y: (Math.random() - 0.5) * H * 1.4,
            z: 0.4 + 0.6 * Math.random(),
            a: 0,
            speed: 0.022 + Math.random() * 0.035,
            target: -1,
            tx: 0, ty: 0, ta: 0,
            drift: { x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.7 },
            ph: Math.random() * Math.PI * 2,
            tw: 0.6 + Math.random() * 1.6,
            vx: 0, vy: 0,
          })
        }
      }
      function sample(maxPoints, step) {
        const data = sctx.getImageData(0, 0, scratch.width, scratch.height).data
        const pts = []
        for (let y = 0; y < scratch.height; y += step) {
          for (let x = 0; x < scratch.width; x += step) {
            if (data[(y * scratch.width + x) * 4 + 3] > 128) {
              pts.push({ x: (x / scratch.width) * 2 - 1, y: -((y / scratch.height) * 2 - 1), a: 0.3 + 0.6 * Math.random() })
            }
          }
        }
        if (pts.length > maxPoints) {
          const stride = pts.length / maxPoints
          const out = []
          for (let i = 0; i < maxPoints; i++) out.push(pts[Math.floor(i * stride)])
          return out
        }
        return pts
      }
      function starModel(scale, soft) {
        const s = scale || 1
        const size = Math.floor(560 * s)
        scratch.width = size
        scratch.height = size
        sctx.clearRect(0, 0, size, size)
        sctx.fillStyle = '#fff'
        const k = 40 * s
        const pts = [[7,0.8],[8.6,5.4],[13.2,7],[8.6,8.6],[7,13.2],[5.4,8.6],[0.8,7],[5.4,5.4]]
        sctx.beginPath()
        sctx.moveTo(pts[0][0] * k, pts[0][1] * k)
        for (let i = 1; i < pts.length; i++) sctx.lineTo(pts[i][0] * k, pts[i][1] * k)
        sctx.closePath()
        sctx.fill()
        const out = sample(12000, Math.max(2, Math.round(2.4 * s)))
        if (soft) { for (const p of out) p.a = 0.06 + 0.22 * Math.random() }
        return out
      }
      function textModel(lines, o) {
        o = o || {}
        const pad = o.pad || 96
        const maxW = o.maxW || 900
        const font = o.font || FONT_CJK
        const hasLS = 'letterSpacing' in sctx
        let totalW = 0, totalH = 0
        for (const ln of lines) {
          if (hasLS) sctx.letterSpacing = (ln.tracking || o.tracking || 0) + 'px'
          sctx.font = '600 ' + ln.size + 'px ' + font
          totalW = Math.max(totalW, sctx.measureText(ln.text).width)
          totalH += ln.size
        }
        const gap = o.gap !== undefined ? o.gap : Math.floor(totalH * 0.15)
        totalH += gap * (lines.length - 1)
        const S = Math.ceil(Math.min(maxW, totalW) + pad * 2)
        scratch.width = S
        scratch.height = S
        sctx.clearRect(0, 0, S, S)
        sctx.fillStyle = '#fff'
        sctx.textAlign = 'center'
        sctx.textBaseline = 'middle'
        let y = (S - totalH) / 2
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i]
          if (hasLS) sctx.letterSpacing = (ln.tracking || o.tracking || 0) + 'px'
          sctx.font = '600 ' + ln.size + 'px ' + font
          sctx.fillText(ln.text, S / 2, y + ln.size / 2)
          y += ln.size + (i < lines.length - 1 ? gap : 0)
        }
        if (hasLS) sctx.letterSpacing = '0px'
        const step = o.step || Math.max(2, Math.round((lines[lines.length - 1].size || 120) / 40))
        return sample(o.maxPoints || 16000, step)
      }
      function assignTargets(m, box) {
        model = m || null
        modelBox = null
        if (model) {
          let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9
          for (const pt of model) {
            if (pt.x < minX) minX = pt.x
            if (pt.x > maxX) maxX = pt.x
            if (pt.y < minY) minY = pt.y
            if (pt.y > maxY) maxY = pt.y
          }
          const bw = Math.max(1e-6, maxX - minX)
          const bh = Math.max(1e-6, maxY - minY)
          const tw = box && box.w ? box.w : Math.min(CX, CY) * 1.2
          const th = box && box.h ? box.h : tw * (bh / bw)
          const k = Math.min(tw / bw, th / bh)
          modelBox = { k: k, cxm: (minX + maxX) / 2, cym: (minY + maxY) / 2 }
        }
        for (const p of particles) {
          if (model) {
            p.target = Math.floor(Math.random() * model.length)
            p.speed = (0.02 + Math.random() * 0.035) * state.speedScale
          } else {
            p.target = -1
            p.ta = state.ambientA
          }
        }
      }
      function step() {
        const dt = sec()
        if (dissipating) {
          for (const p of particles) {
            p.x += p.vx * dt * 60
            p.y += p.vy * dt * 60
            p.a *= 0.9
          }
          return
        }
        const par = mouse.active ? 0.04 : 0.014
        const mx = (mouse.x - CX) * par
        const my = (mouse.y - CY) * par
        const now = performance.now() / 1000
        for (const p of particles) {
          let tx, ty, ta
          if (model && p.target >= 0) {
            const pt = model[p.target]
            tx = CX + (pt.x - modelBox.cxm) * modelBox.k + mx
            ty = CY - (pt.y - modelBox.cym) * modelBox.k + my
            ta = pt.a
          } else {
            tx = p.x + p.drift.x * 26 * state.driftScale * dt + mx * 0.6
            ty = p.y + p.drift.y * 26 * state.driftScale * dt + my * 0.6
            ta = state.ambientA * (0.55 + 0.45 * Math.sin(now * p.tw + p.ph))
          }
          const s = p.speed
          p.x += (tx - p.x) * s
          p.y += (ty - p.y) * s
          p.a += (ta - p.a) * Math.min(1, s * 2.4)
        }
      }
      function frame() {
        if (!state.running) return
        t0 = performance.now()
        ctx2d.clearRect(0, 0, W, H)
        step()
        state.frame++
        if (state.frame % 150 === 0) state.ink = readInk()
        ctx2d.fillStyle = state.ink
        for (const p of particles) {
          if (p.a <= 0.008) continue
          ctx2d.globalAlpha = Math.min(1, p.a * 0.85)
          const size = p.z * state.sizeScale
          ctx2d.fillRect(p.x, p.y, Math.max(1, size), Math.max(1, size))
        }
        ctx2d.globalAlpha = 1
        raf = requestAnimationFrame(frame)
      }
      const api2 = {
        scatter() { assignTargets(null); return api2 },
        showStar(scale, box, soft) { assignTargets(starModel(scale || 1, soft), box); return api2 },
        showText(text, fontPx, o) { assignTargets(textModel([{ text: text, size: fontPx }], o), o && o.box); return api2 },
        showTextLines(lines, o) { assignTargets(textModel(lines, o), o && o.box); return api2 },
        setInkVar(v) { inkVar = v; state.ink = readInk(); return api2 },
        setSize(k) { state.sizeScale = k; return api2 },
        setSpeedScale(k) { state.speedScale = k; return api2 },
        setDriftScale(k) { state.driftScale = k; return api2 },
        setAmbientAlpha(a) { state.ambientA = a; return api2 },
        setDisturb(r, f) { state.disturb = { r: r, f: f }; return api2 },
        onMouse(x, y) { mouse.x = x; mouse.y = y; mouse.active = true },
        clearMouse() { mouse.active = false },
        resize: resize,
        start() {
          if (state.running) return api2
          state.running = true
          t0 = performance.now()
          state.ink = readInk()
          resize()
          if (!particles.length) spawn()
          raf = requestAnimationFrame(frame)
          return api2
        },
        stop() {
          state.running = false
          if (raf) cancelAnimationFrame(raf)
          raf = 0
          ctx2d.clearRect(0, 0, W, H)
          return api2
        },
        dissipate() {
          dissipating = true
          const speed = Math.min(W, H) * 0.016
          for (const p of particles) {
            const dx = p.x - CX
            const dy = p.y - CY
            const len = Math.max(1e-3, Math.hypot(dx, dy))
            const k = speed * (0.5 + Math.random())
            p.vx = (dx / len) * k
            p.vy = (dy / len) * k
            p.target = -1
          }
          return api2
        },
      }
      resize()
      spawn()
      return api2
    }

    /* ==================================================================
     * data actions
     * ================================================================== */

    async function refreshAll() {
      try {
        const ws = await api.request('workspace.list', {})
        const archived = ws.archivedSessionIds || []
        const workspaces = ws.items || []
        setStore({ archived, workspaces })
        const ss = await api.request('session.list', {})
        const ar = new Set(archived)
        setStore({ sessions: (ss.items || []).filter((s) => !ar.has(s.sessionId)), ready: true })
        if (!store.wsId && workspaces.length) setStore({ wsId: workspaces[0].workspaceId })
      } catch (e) {
        setStore({ ready: true })
      }
      try {
        const m = await api.request('llm.models', {})
        setStore({ models: (m && m.groups) || [] })
      } catch (e) { /* ignore */ }
      try {
        const p = await api.request('agentPreset.list', {})
        setStore({ presets: (p && p.presets) || [] })
      } catch (e) { /* ignore */ }
    }

    function sessionOf(id) {
      return store.sessions.find((s) => s.sessionId === id) || null
    }
    function sessionTitleOf(id) {
      const s = sessionOf(id)
      if (!s) return ''
      const proj = s.projections && s.projections.values
      const t = proj && proj.title
      if (typeof t === 'string' && t.trim()) return t
      const sid = String(id)
      return sid.length > 10 ? sid.slice(0, 10) : sid
    }

    async function openSession(id) {
      setStore({
        sessionId: id,
        sessionInfo: sessionOf(id),
        currentModel: null,
        projections: {},
        messages: [],
        hasMore: false,
        streaming: false,
      })
      loadHistory(id).catch(() => {})
      try {
        const r = await api.request('session.models', { sessionId: id })
        setStore({
          currentModel: (r && r.current) || null,
          models: (r && Array.isArray(r.groups) && r.groups.length) ? r.groups : store.models,
        })
      } catch (e) { /* ignore */ }
    }

    async function ensureSession() {
      if (store.sessionId) return store.sessionId
      if (!store.workspaces.length) {
        toast('请先创建或选择一个工作区')
        return null
      }
      try {
        const r = await api.request('session.create', { workspaceId: store.wsId || store.workspaces[0].workspaceId })
        if (r && r.sessionId) {
          await refreshAll().catch(() => {})
          setStore({ wsId: store.wsId || store.workspaces[0].workspaceId })
          openSession(r.sessionId)
          return r.sessionId
        }
      } catch (e) {
        toast('新建会话失败: ' + String(e && e.message || e))
      }
      return null
    }

    async function loadHistory(id) {
      if (!id) return
      setStore({ loading: true })
      try {
        const r = await api.request('session.history', { sessionId: id })
        const events = (r && r.events) || []
        store.messages.length = 0
        resetLive()
        for (const item of events) {
          const ev = item && item.event ? item.event : item
          foldEvent(ev)
        }
        setStore({ messages: store.messages, hasMore: !!(r && r.hasMore), loading: false })
      } catch (e) {
        setStore({ loading: false })
      }
    }

    async function sendText(text, mode) {
      const id = store.sessionId || (await ensureSession())
      if (!id) return
      setStore({ streaming: true })
      try {
        await api.request('session.prompt', {
          sessionId: id,
          mode: mode || 'queue',
          content: [{ type: 'text', text: text }],
        })
      } catch (e) {
        toast('发送失败: ' + String(e && e.message || e))
        setStore({ streaming: false })
      }
    }

    async function cancelRun() {
      if (!store.sessionId) return
      try { await api.request('session.cancel', { sessionId: store.sessionId }) } catch (e) { /* ignore */ }
    }

    async function runCommand(line) {
      const id = store.sessionId || (await ensureSession())
      if (!id) return
      try {
        const r = await api.request('commands/execute', { args: { agentId: id, line: line } })
        if (r === undefined || r === null) {
          toast('未知命令: ' + line)
          return false
        }
        return true
      } catch (e) {
        toast('命令执行失败: ' + String(e && e.message || e))
        return false
      }
    }

    async function commandsFor(id) {
      if (!id) return []
      try {
        const r = await api.request('commands/list', { args: { agentId: id } })
        return Array.isArray(r) ? r.filter((c) => c && c.name).map((c) => ({ name: c.name, description: c.description || '' })) : []
      } catch (e) {
        return []
      }
    }

    async function selectModel(provider, model, reasoningEffort) {
      if (!store.sessionId) return
      const payload = { sessionId: store.sessionId, provider: provider, model: model }
      if (reasoningEffort) payload.reasoningEffort = reasoningEffort
      try {
        await api.request('session.selectModel', payload)
        setStore({ currentModel: { provider: provider, model: model, reasoningEffort: reasoningEffort || null } })
        toast('模型已切换')
      } catch (e) {
        toast('切换失败: ' + String(e && e.message || e))
      }
    }

    async function setPermission(value) {
      if (!store.sessionId) return
      try {
        const r = await api.request('commands/execute', { args: { agentId: store.sessionId, line: '/permission ' + value } })
        if (r === undefined || r === null) {
          await api.request('session.prompt', {
            sessionId: store.sessionId,
            mode: 'queue',
            content: [{ type: 'text', text: '/permission ' + value }],
          })
        }
      } catch (e) { /* ignore */ }
    }

    async function archiveSession(id) {
      try {
        await api.request('workspace.archiveSession', { sessionId: id })
        if (!store.archived.includes(id)) store.archived.push(id)
        setStore({ sessions: store.sessions.filter((s) => s.sessionId !== id) })
        if (store.sessionId === id) setStore({ sessionId: null, messages: [], streaming: false })
      } catch (e) { /* ignore */ }
    }

    /* ==================================================================
     * event folding — mirror dsh session events into messages
     * ================================================================== */

    const live = { seq: -1, id: null, reasoning: '', text: '', usage: null, model: null, toolCalls: [], blocks: [], finished: false, msgRef: null }
    function resetLive() {
      live.seq = -1; live.id = null; live.reasoning = ''; live.text = ''
      live.usage = null; live.model = null; live.toolCalls = []; live.blocks = []
      live.finished = false; live.msgRef = null
    }

    function messageParts(msg) {
      let text = '', reasoning = '', images = [], blocks = []
      const content = msg && (Array.isArray(msg.content) ? msg.content : null)
      if (content) {
        for (const b of content) {
          if (!b) continue
          if (b.type === 'text') text += b.text || ''
          else if (b.type === 'reasoning') { reasoning += b.text || ''; blocks.push({ kind: 'reasoning', text: b.text || '' }) }
          else if (b.type === 'image') { images.push(b.attachment); blocks.push({ kind: 'image', src: b.attachment }) }
          else if (b.type === 'tool-call') blocks.push({ kind: 'toolcall', callId: String(b.id), name: b.name, arguments: b.arguments || '', result: null })
          else blocks.push({ kind: 'other' })
        }
      }
      return { text: text, reasoning: reasoning, images: images, blocks: blocks, usage: msg && msg.usage, model: msg && msg.model }
    }

    function foldChunk(ev) {
      const d = ev.data || {}
      const chunk = d.chunk || {}
      if (live.seq < 0) {
        live.seq = ev.seq
        live.turn = d.turn
        live.step = d.step
        live.id = d.messageId || d.message || chunk.messageId || null
      }
      switch (chunk.type) {
        case 'reasoning-delta':
          live.reasoning += chunk.text || ''
          if (!live.blocks.some((b) => b.kind === 'reasoning')) live.blocks.push({ kind: 'reasoning', text: live.reasoning })
          else live.blocks.find((b) => b.kind === 'reasoning').text = live.reasoning
          break
        case 'text-delta':
          live.text += chunk.text || ''
          break
        case 'tool-call-delta': {
          const callId = chunk.id || chunk.callId || (chunk.toolCall && chunk.toolCall.id)
          let tc = live.toolCalls.find((x) => x.callId === callId)
          if (!tc) {
            tc = { callId: callId, name: chunk.name || (chunk.toolCall && chunk.toolCall.name) || '', args: '' }
            live.toolCalls.push(tc)
            live.blocks.push({ kind: 'toolcall', callId: callId, name: tc.name, arguments: '', result: null })
          }
          if (!tc.name && (chunk.name || (chunk.toolCall && chunk.toolCall.name))) tc.name = chunk.name || chunk.toolCall.name
          if (chunk.arguments || chunk.argumentsDelta || (chunk.toolCall && chunk.toolCall.arguments)) {
            tc.args += chunk.arguments || chunk.argumentsDelta || (chunk.toolCall && chunk.toolCall.arguments) || ''
          }
          const blk = live.blocks.find((b) => b.kind === 'toolcall' && b.callId === callId)
          if (blk) blk.arguments = tc.args
          break
        }
        case 'usage':
          live.usage = chunk.usage || chunk
          break
        case 'finish':
          live.finished = true
          break
        default:
          break
      }
      snapshotLive()
    }

    function snapshotLive() {
      const msg = {
        id: live.id || ('a' + live.seq),
        _seq: live.seq,
        _live: true,
        role: 'assistant',
        content: live.text,
        reasoning: live.reasoning,
        usage: live.usage,
        model: live.model,
        ts: Date.now(),
        blocks: live.blocks.slice(),
        streaming: !live.finished,
      }
      if (live.msgRef && store.messages.indexOf(live.msgRef) >= 0) {
        live.msgRef.content = live.text
        live.msgRef.reasoning = live.reasoning
        live.msgRef.usage = live.usage || live.msgRef.usage
        live.msgRef.model = live.model || live.msgRef.model
        live.msgRef.blocks = live.blocks.slice()
        live.msgRef.streaming = !live.finished
      } else {
        store.messages.push(msg)
        live.msgRef = msg
      }
    }

    function foldEvent(ev) {
      if (!ev || typeof ev !== 'object') return
      const type = ev.type
      const data = (ev && ev.data) || {}
      const messages = store.messages
      if (type === 'user/message') {
        const msg = data.message || data
        const parts = messageParts(msg)
        if (messages.some((m) => m._seq === ev.seq || (msg.id && m.id === msg.id))) return
        messages.push({ id: (msg && msg.id) || ('u' + ev.seq), _seq: ev.seq, role: 'user', content: parts.text, images: parts.images, ts: ev.time })
        emitStore()
      } else if (type === 'assistant/message') {
        const msg = data.message || data
        const parts = messageParts(msg)
        const id = msg && msg.id
        const existing = messages.find((m) => m._seq === ev.seq || (id && m.id === id))
        const liveMsg = live.msgRef
        if (liveMsg) {
          const idx = messages.indexOf(liveMsg)
          if (idx >= 0 && existing !== liveMsg) messages.splice(idx, 1)
          live.msgRef = null
        }
        resetLive()
        if (existing) {
          existing.content = parts.text
          if (parts.reasoning) existing.reasoning = parts.reasoning
          existing.images = parts.images
          existing.blocks = parts.blocks
          existing.usage = parts.usage || existing.usage
          existing.model = parts.model || existing.model
          existing.streaming = false
        } else {
          messages.push({
            id: id || ('a' + ev.seq), _seq: ev.seq, role: 'assistant',
            content: parts.text, reasoning: parts.reasoning, images: parts.images,
            blocks: parts.blocks, usage: parts.usage, model: parts.model,
            ts: ev.time, streaming: false,
          })
        }
        setStore({ streaming: false })
      } else if (type === 'assistant/chunk') {
        foldChunk(ev)
        scheduleRender()
      } else if (type === 'tool/call') {
        if (messages.some((m) => m._seq === ev.seq)) return
        messages.push({
          id: 't' + ev.seq, _seq: ev.seq, role: 'tool',
          content: '', name: data.name || data.tool || 'tool',
          callId: data.callId || null, args: data.arguments || '', ts: ev.time,
        })
        emitStore()
      } else if (type === 'tool/result') {
        const msg = data.message || data
        const src = msg && msg.source ? msg.source : null
        const callId = (src && src.callId) || data.callId || null
        let text = ''
        if (Array.isArray(msg && msg.content)) {
          text = msg.content.map((b) => {
            if (Array.isArray(b.content)) return b.content.map((bb) => bb.text || '').join('')
            return b.text || ''
          }).join('\n')
        } else {
          text = data.text || data.output || ''
        }
        let target = null
        let targetBlock = null
        if (callId) {
          const lb = live.blocks.find((b) => b.kind === 'toolcall' && b.callId === callId)
          if (lb) { lb.result = text; targetBlock = lb }
          if (!targetBlock) {
            for (let i = messages.length - 1; i >= 0; i--) {
              const m = messages[i]
              if (m.role !== 'assistant' || !Array.isArray(m.blocks)) continue
              const blk = m.blocks.find((b) => b.kind === 'toolcall' && b.callId === callId)
              if (blk) { blk.result = text; targetBlock = blk; break }
            }
          }
          if (!targetBlock) target = messages.filter((m) => m.role === 'tool').reverse().find((m) => m.callId === callId)
        }
        if (target && !targetBlock) target.content = text
        else if (!targetBlock) {
          messages.push({ id: 'r' + ev.seq, _seq: ev.seq, role: 'tool', content: text, name: data.name || 'tool', callId: callId, ts: ev.time })
        }
        scheduleRender()
      } else if (type === 'command/run') {
        messages.push({
          id: 'c' + ev.seq, _seq: ev.seq, role: 'system', ts: ev.time,
          content: '/' + (data.name || 'command') + (data.args ? ' ' + data.args : ''),
        })
        emitStore()
      } else if (type === 'permission/preset' || type === 'sandbox/mode' || type === 'approval/policy') {
        const label = data.preset || data.mode || data.policy || type
        messages.push({ id: type[0] + ev.seq, _seq: ev.seq, role: 'system', ts: ev.time, content: '· ' + String(label) })
        emitStore()
      } else if (type === 'step/start') {
        // no-op in M1
      }
    }

    /* mux wiring */
    mux.on('session/event', (frame) => {
      const ev = (frame.payload && frame.payload.event) ? frame.payload.event : frame.payload
      if (!ev) return
      let sid = ev.sessionId
      if (sid === undefined && frame.sessionId !== undefined) sid = frame.sessionId
      if (sid === undefined && frame.payload && frame.payload.sessionId !== undefined) sid = frame.payload.sessionId
      if (sid !== undefined && store.sessionId !== sid) return
      foldEvent(ev)
    })
    mux.on('session/subscribed', (frame) => {
      const sid = (frame.payload && frame.payload.sessionId) || frame.sessionId
      if (sid !== undefined && sid === store.sessionId) loadHistory(sid).catch(() => {})
    })
    mux.on('session/projection', (frame) => {
      const payload = frame.payload || {}
      const sid = payload.sessionId
      if (sid === undefined || sid !== store.sessionId) return
      const values = payload.values || {}
      setStore({ projections: Object.assign({}, store.projections, values) })
    })
    mux.on('disconnect', () => {
      setStore({ connected: false, streaming: false })
    })
    mux.on('connect', () => {
      setStore({ connected: true })
      if (store.sessionId) loadHistory(store.sessionId).catch(() => {})
    })

    /* boot */
    mux.connect()
    refreshAll().catch(() => {})

    /* ==================================================================
     * components
     * ================================================================== */

    /* open state for the shell */
    let open = false
    let view = 'intro'
    const openSubs = new Set()
    function emitOpen() { for (const l of Array.from(openSubs)) l() }
    function setOpen(v) { if (open !== v) { open = v; emitOpen() } }
    function setView(v) { if (view !== v) { view = v; emitOpen() } }
    function useOpen() {
      const [v, setV] = React.useState(open)
      React.useEffect(() => {
        const l = () => setV(open)
        openSubs.add(l)
        return () => { openSubs.delete(l) }
      }, [])
      return v
    }

    function FooterAction(props) {
      const isOpen = useOpen()
      return React.createElement('button', {
        type: 'button',
        className: 'sid-foot' + (isOpen ? ' on' : ''),
        title: 'SIDOR',
        'aria-label': 'SIDOR',
        'aria-pressed': isOpen,
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); setView('intro') },
      },
        React.createElement('span', { className: 'sid-foot-mark', dangerouslySetInnerHTML: { __html: IC.mark } }),
        props.wide ? React.createElement('span', { className: 'sid-foot-label' }, 'SIDOR') : null,
      )
    }

    function IntroScene(props) {
      const canvasRef = React.useRef(null)
      const engineRef = React.useRef(null)
      const [phase, setPhase] = React.useState('glow')
      const [clicking, setClicking] = React.useState(false)

      React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const engine = createParticleEngine(canvas, { count: 6800 })
        engineRef.current = engine
        engine.start()
        const onMove = (e) => {
          const r = canvas.getBoundingClientRect()
          engine.onMouse(e.clientX - r.left, e.clientY - r.top)
        }
        const onLeave = () => engine.clearMouse()
        const onResize = () => engine.resize()
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerleave', onLeave)
        window.addEventListener('resize', onResize)
        return () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerleave', onLeave)
          window.removeEventListener('resize', onResize)
          engine.stop()
        }
      }, [])

      React.useEffect(() => {
        const engine = engineRef.current
        if (!engine) return
        const pending = []
        const schedule = (ms, fn) => pending.push(ctx.timeout(fn, ms))
        const vh = () => canvasRef.current ? Math.max(320, canvasRef.current.clientHeight) : 600
        const vw = () => canvasRef.current ? Math.max(480, canvasRef.current.clientWidth) : 1200
        if (phase === 'glow') {
          engine.setInkVar('--dsw-alias-label-primary')
          engine.setSize(1.0)
          engine.setSpeedScale(1)
          engine.showStar(1, { w: Math.min(340, vh() * 0.56), h: Math.min(340, vh() * 0.56) }, true)
          schedule(700, () => setPhase('welcome'))
        } else if (phase === 'welcome') {
          engine.setInkVar('--dsw-alias-label-secondary')
          engine.setSize(0.6)
          engine.setSpeedScale(0.6)
          const wTarget = Math.min(720, vw() * 0.7, vh() * 1.5)
          engine.showText('WELCOME', 150, {
            font: FONT_LATIN,
            maxW: 860,
            step: 2,
            maxPoints: 20000,
            tracking: 20,
            box: { w: Math.min(900, vw() * 0.95), h: Math.min(wTarget * 0.2, vh() * 0.3) },
          })
          schedule(2200, () => setPhase('zh'))
        } else if (phase === 'zh') {
          engine.setInkVar('--dsw-alias-label-primary')
          engine.setSize(1.0)
          engine.setSpeedScale(1)
          engine.showTextLines([
            { text: '欢迎回来', size: 58, tracking: 12 },
            { text: '领航员', size: 150, tracking: 28 },
          ], {
            font: FONT_CJK,
            maxW: 720,
            step: 2,
            maxPoints: 24000,
            gap: 30,
            box: { w: Math.min(600, vh() * 1.25), h: Math.min(300, vh() * 0.55) },
          })
          schedule(2600, () => setPhase('out'))
        } else if (phase === 'out') {
          setClicking(true)
          engine.dissipate()
          schedule(1500, () => props.onFinished())
        }
        return () => { for (const d of pending) d() }
      }, [phase])

      React.useEffect(() => {
        if (phase === 'out') return
        const skip = () => setPhase('out')
        window.addEventListener('keydown', skip)
        window.addEventListener('pointerdown', skip)
        return () => {
          window.removeEventListener('keydown', skip)
          window.removeEventListener('pointerdown', skip)
        }
      }, [phase])

      const ghostOpacity = phase === 'welcome' ? 0.05 : phase === 'out' ? 0 : 0.12
      return React.createElement('div', { className: 'sid-intro' },
        React.createElement('div', {
          className: 'sid-marks',
          'aria-hidden': true,
          style: { opacity: ghostOpacity, transition: 'opacity 1.1s ease' },
        },
          React.createElement('span', { className: 'sid-mark-ghost' },
            React.createElement('span', { className: 'sid-ghost-click' + (clicking ? ' on' : '') },
              React.createElement('span', { className: 'sid-ghost-spin' },
                React.createElement('span', { className: 'sid-ghost-breathe', dangerouslySetInnerHTML: { __html: IC.markGhost } }),
              ),
            ),
          ),
          DUST.map((q) => React.createElement('span', {
            key: q.x + '-' + q.y,
            className: 'sid-dust-star',
            style: { left: q.x + '%', top: q.y + '%', animationDuration: q.p + 's', animationDelay: q.d + 's' },
            dangerouslySetInnerHTML: { __html: dustSvg(q.s) },
          })),
        ),
        React.createElement('canvas', { ref: canvasRef, className: 'sid-canvas', 'aria-hidden': true }),
      )
    }

    /* ambient starfield behind the whole shell */
    function Stardust() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const engine = createParticleEngine(canvas, { count: 2000 })
        engine.setInkVar('--dsw-alias-label-primary')
        engine.setSize(2.0)
        engine.setAmbientAlpha(0.3)
        engine.setDriftScale(1.0)
        engine.scatter()
        engine.start()
        const onResize = () => engine.resize()
        window.addEventListener('resize', onResize)
        return () => {
          window.removeEventListener('resize', onResize)
          engine.stop()
        }
      }, [])
      return React.createElement('canvas', { ref: ref, className: 'sid-stardust', 'aria-hidden': true })
    }

    /* ---------- message rendering ---------- */

    function msgText(m) {
      return m.content || ''
    }

    function ToolBlockView(props) {
      const blk = props.block
      const [openArgs, setOpenArgs] = React.useState(false)
      const [openResult, setOpenResult] = React.useState(true)
      return React.createElement('div', { className: 'sid-tool' },
        React.createElement('button', {
          type: 'button',
          className: 'sid-tool-head',
          onClick: () => setOpenArgs(!openArgs),
        },
          React.createElement('span', { className: 'sid-tool-ic', dangerouslySetInnerHTML: { __html: IC.tool } }),
          React.createElement('span', { className: 'sid-tool-name' }, blk.name || 'tool'),
          React.createElement('span', { className: 'sid-tool-chev' + (openArgs ? ' open' : '') }, '▾'),
        ),
        openArgs && blk.arguments ? React.createElement('pre', { className: 'sid-tool-args' }, blk.arguments) : null,
        blk.result !== null && blk.result !== undefined ? React.createElement('button', {
          type: 'button',
          className: 'sid-tool-result-head',
          onClick: () => setOpenResult(!openResult),
        },
          React.createElement('span', null, '输出'),
          React.createElement('span', { className: 'sid-tool-chev' + (openResult ? ' open' : '') }, '▾'),
        ) : null,
        openResult && blk.result ? React.createElement('pre', { className: 'sid-tool-result' }, String(blk.result)) : null,
      )
    }

    function MessageView(props) {
      const m = props.message
      try {
        if (m.role === 'user') {
          return React.createElement('div', { className: 'sid-msg user' },
            React.createElement('div', { className: 'sid-msg-bubble' },
              React.createElement('div', { className: 'sid-msg-text' }, m.content),
              m.images && m.images.length ? m.images.map((img, i) => React.createElement('img', { key: i, src: img, alt: '', className: 'sid-msg-img' })) : null,
            ),
          )
        }
        if (m.role === 'assistant') {
          const blocks = m.blocks && m.blocks.length ? m.blocks : (m.content || m.reasoning ? [{ kind: m.reasoning ? 'reasoning' : 'text', text: m.reasoning || m.content }] : [])
          const children = []
          for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i]
            if (b.kind === 'reasoning') {
              children.push(React.createElement('div', { key: 'r' + i, className: 'sid-think' },
                React.createElement('span', { className: 'sid-think-label' }, '思考'),
                React.createElement('div', { className: 'sid-think-text' }, b.text),
              ))
            } else if (b.kind === 'toolcall') {
              children.push(React.createElement(ToolBlockView, { key: 't' + i, block: b }))
            } else if (b.kind === 'image' && b.src) {
              children.push(React.createElement('img', { key: 'i' + i, src: b.src, alt: '', className: 'sid-msg-img' }))
            } else if (b.kind === 'text') {
              children.push(React.createElement('div', { key: 'x' + i, className: 'sid-msg-text' },
                b.text,
                m.streaming ? React.createElement('span', { className: 'sid-caret' }) : null,
              ))
            }
          }
          if (!children.length && m.content) {
            children.push(React.createElement('div', { key: 'c', className: 'sid-msg-text' }, m.content, m.streaming ? React.createElement('span', { className: 'sid-caret' }) : null))
          }
          return React.createElement('div', { className: 'sid-msg assistant' },
            React.createElement('div', { className: 'sid-msg-mark', dangerouslySetInnerHTML: { __html: IC.mark } }),
            React.createElement('div', { className: 'sid-msg-body' }, children),
          )
        }
        if (m.role === 'tool') {
          return React.createElement('div', { className: 'sid-msg tool' },
            React.createElement('div', { className: 'sid-tool' },
              React.createElement('div', { className: 'sid-tool-head static' },
                React.createElement('span', { className: 'sid-tool-ic', dangerouslySetInnerHTML: { __html: IC.tool } }),
                React.createElement('span', { className: 'sid-tool-name' }, m.name || 'tool'),
              ),
              m.args ? React.createElement('pre', { className: 'sid-tool-args' }, String(m.args)) : null,
              m.content ? React.createElement('pre', { className: 'sid-tool-result' }, String(m.content)) : null,
            ),
          )
        }
        return React.createElement('div', { className: 'sid-msg system' }, m.content)
      } catch (e) {
        return React.createElement('div', { className: 'sid-msg system' }, '（消息渲染异常）')
      }
    }

    function MessageFlow() {
      const st = useStore()
      const ref = React.useRef(null)
      const count = st.messages.length
      React.useEffect(() => {
        const el = ref.current
        if (el) el.scrollTop = el.scrollHeight
      }, [count, st.streaming])
      let body
      try {
        if (st.loading) {
          body = React.createElement('div', { className: 'sid-empty' }, '加载中…')
        } else if (count === 0) {
          body = React.createElement('div', { className: 'sid-empty' }, '开始对话吧')
        } else {
          body = st.messages.map((m) => React.createElement(MessageView, { key: m.id + '-' + m._seq, message: m }))
        }
      } catch (e) {
        body = React.createElement('div', { className: 'sid-empty' }, '消息区渲染异常')
      }
      return React.createElement('div', { ref: ref, className: 'sid-flow' }, body)
    }

    /* ---------- composer ---------- */

    function Composer(props) {
      const st = useStore()
      const [draft, setDraft] = React.useState('')
      const [cmdOpen, setCmdOpen] = React.useState(false)
      const [cmdList, setCmdList] = React.useState([])
      const [cmdIdx, setCmdIdx] = React.useState(0)
      const taRef = React.useRef(null)
      const composingRef = React.useRef(false)
      const empty = draft.trim() === ''

      React.useEffect(() => {
        setCmdList([])
        setCmdOpen(false)
        if (!st.sessionId) return
        commandsFor(st.sessionId).then((list) => setCmdList(list)).catch(() => {})
      }, [st.sessionId])

      const cmdFiltered = cmdList.filter((it) => {
        const q = draft.replace(/^\//, '').trim().toLowerCase()
        if (!q) return true
        return it.name.toLowerCase().indexOf(q) >= 0
      })

      const doSend = (mode) => {
        if (empty) return
        const text = draft.trim()
        setDraft('')
        requestAnimationFrame(() => { const el = taRef.current; if (el) { el.value = ''; el.style.height = 'auto' } })
        if (text.charAt(0) === '/') {
          runCommand(text)
        } else {
          sendText(text, mode)
        }
      }

      const onKeyDown = (e) => {
        if (cmdOpen && cmdFiltered.length > 0) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const delta = e.key === 'ArrowDown' ? 1 : -1
            setCmdIdx((i) => (i + delta + cmdFiltered.length) % cmdFiltered.length)
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.repeat) return
            const pick = cmdFiltered[cmdIdx]
            if (pick) { setCmdOpen(false); setDraft(''); runCommand('/' + pick.name); return }
          }
          if (e.key === 'Escape') { setCmdOpen(false); return }
        }
        if (e.key === 'Enter') {
          if (e.shiftKey) return
          if (composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
          e.preventDefault()
          if (e.repeat) return
          const accelerated = e.ctrlKey || e.metaKey
          doSend(accelerated ? 'steer' : 'queue')
        }
      }

      const stopBtn = st.streaming
        ? React.createElement('button', {
            type: 'button',
            className: 'sid-send stop',
            title: '停止',
            'aria-label': '停止',
            onClick: cancelRun,
          }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.stop } }))
        : React.createElement('button', {
            type: 'button',
            className: 'sid-send' + (empty ? ' off' : ''),
            title: '发送',
            'aria-label': '发送',
            disabled: empty,
            onClick: () => doSend('queue'),
          }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.send } }))

      return React.createElement('div', { className: 'sid-composer' },
        cmdOpen && cmdFiltered.length > 0
          ? React.createElement('div', { className: 'sid-cmdmenu' },
              cmdFiltered.slice(0, 8).map((it, i) => React.createElement('button', {
                key: it.name,
                type: 'button',
                className: 'sid-cmditem' + (i === cmdIdx ? ' on' : ''),
                onMouseEnter: () => setCmdIdx(i),
                onClick: () => { setCmdOpen(false); setDraft(''); runCommand('/' + it.name) },
              },
                React.createElement('span', { className: 'sid-cmdmark' }, '/'),
                React.createElement('span', { className: 'sid-cmdname' }, it.name),
                it.description ? React.createElement('span', { className: 'sid-cmddesc' }, it.description) : null,
              )),
            )
          : null,
        React.createElement('div', { className: 'sid-composer-card' },
          React.createElement('textarea', {
            ref: taRef,
            className: 'sid-ta',
            rows: 1,
            placeholder: '给控制中心输入指令…',
            value: draft,
            onKeyDown: onKeyDown,
            onCompositionStart: () => { composingRef.current = true },
            onCompositionEnd: () => { ctx.timeout(() => { composingRef.current = false }, 30) },
            onChange: (e) => {
              const next = e.target.value
              setDraft(next)
              const el = taRef.current
              if (el) { el.style.height = 'auto'; el.style.height = Math.min(144, Math.max(40, el.scrollHeight)) + 'px' }
              const isCmd = next.trim().startsWith('/')
              setCmdOpen(isCmd)
              setCmdIdx(0)
            },
          }),
          React.createElement('div', { className: 'sid-composer-tools' },
            React.createElement('span', { className: 'sid-composer-model' }, st.currentModel ? st.currentModel.model : (st.models.length ? '选择模型' : '')),
            React.createElement('div', { className: 'sid-spacer' }),
            React.createElement('button', {
              type: 'button',
              className: 'sid-cmdbtn' + (cmdOpen ? ' on' : ''),
              title: '命令',
              'aria-label': '命令',
              onClick: () => { setCmdOpen(!cmdOpen); setCmdIdx(0); requestAnimationFrame(() => { const el = taRef.current; if (el) el.focus() }) },
            }, '/'),
            stopBtn,
          ),
        ),
        React.createElement('div', { className: 'sid-composer-stats' },
          st.sessionId ? sessionTitleOf(st.sessionId) : 'SIDOR',
          React.createElement('span', { className: 'sid-stats-sep' }, '·'),
          st.streaming ? '运行中' : (st.connected ? '在线' : '离线'),
        ),
      )
    }

    /* ---------- sidebar ---------- */

    function Sidebar(props) {
      const st = useStore()
      const [q, setQ] = React.useState('')
      try {
        const query = q.trim().toLowerCase()
        const wsSessions = (() => {
          const ws = st.workspaces.find((w) => w.workspaceId === st.wsId)
          const ids = ws && ws.sessionIds ? ws.sessionIds : null
          const list = ids ? st.sessions.filter((s) => ids.indexOf(s.sessionId) >= 0) : st.sessions
          return query ? list.filter((s) => (sessionTitleOf(s.sessionId)).toLowerCase().indexOf(query) >= 0) : list
        })()
        return React.createElement('aside', { className: 'sid-sidebar' },
          React.createElement('div', { className: 'sid-sb-head' },
            React.createElement('span', { className: 'sid-sb-mark', dangerouslySetInnerHTML: { __html: IC.mark } }),
            React.createElement('span', { className: 'sid-sb-title' }, 'SIDOR'),
          ),
          React.createElement('div', { className: 'sid-sb-ws' },
            st.workspaces.length === 0
              ? React.createElement('div', { className: 'sid-empty' }, '暂无工作区')
              : st.workspaces.map((w) => React.createElement('button', {
                  key: w.workspaceId,
                  type: 'button',
                  className: 'sid-ws-chip' + (w.workspaceId === st.wsId ? ' on' : ''),
                  title: w.path || w.workspaceId,
                  onClick: () => setStore({ wsId: w.workspaceId }),
                }, w.title || w.workspaceId)),
          ),
          React.createElement('button', {
            type: 'button',
            className: 'sid-sb-new',
            onClick: () => { ensureSession() },
          },
            React.createElement('span', { className: 'sid-sb-new-ic', dangerouslySetInnerHTML: { __html: IC.plus } }),
            React.createElement('span', null, '新会话'),
          ),
          React.createElement('div', { className: 'sid-sb-search' },
            React.createElement('span', { className: 'sid-sb-search-ic', dangerouslySetInnerHTML: { __html: IC.search } }),
            React.createElement('input', {
              type: 'text',
              value: q,
              placeholder: '搜索会话…',
              onChange: (e) => setQ(e.target.value),
            }),
          ),
          React.createElement('div', { className: 'sid-sb-list' },
            !st.ready ? React.createElement('div', { className: 'sid-empty' }, '加载中…')
              : wsSessions.length === 0 ? React.createElement('div', { className: 'sid-empty' }, '暂无会话')
              : wsSessions.map((s) => React.createElement('div', {
                  key: s.sessionId,
                  className: 'sid-sb-row' + (st.sessionId === s.sessionId ? ' active' : ''),
                  role: 'button',
                  tabIndex: 0,
                  onClick: () => openSession(s.sessionId),
                  onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(s.sessionId) } },
                },
                  React.createElement('span', { className: 'sid-sb-row-name' }, sessionTitleOf(s.sessionId)),
                  s.running ? React.createElement('span', { className: 'sid-sb-row-meta' }, '…') : null,
                )),
          ),
          React.createElement('div', { className: 'sid-sb-foot' },
            React.createElement('button', {
              type: 'button',
              className: 'sid-sb-foot-btn',
              title: '设置',
              'aria-label': '设置',
              onClick: () => toast('设置将在后续迭代实现'),
            }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.settings } })),
            React.createElement('button', {
              type: 'button',
              className: 'sid-sb-foot-btn',
              title: '关闭 SIDOR',
              'aria-label': '关闭 SIDOR',
              onClick: () => setOpen(false),
            }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.close } })),
          ),
        )
      } catch (e) {
        showCrash('Sidebar: ' + String(e && e.message ? e.message : e))
        return React.createElement('div', { className: 'sid-empty' }, '侧栏渲染异常')
      }
    }

    /* ---------- main shell ---------- */

    function EmptyState() {
      const st = useStore()
      return React.createElement('div', { className: 'sid-empty-state' },
        React.createElement('div', { className: 'sid-es-mark', dangerouslySetInnerHTML: { __html: IC.mark } }),
        React.createElement('div', { className: 'sid-es-title' }, 'SIDOR'),
        React.createElement('div', { className: 'sid-es-sub' }, '给控制中心输入指令，或选择一个会话'),
        st.workspaces.length > 1
          ? React.createElement('div', { className: 'sid-es-chips' },
              st.workspaces.map((w) => React.createElement('button', {
                key: w.workspaceId,
                type: 'button',
                className: 'sid-ws-chip' + (w.workspaceId === st.wsId ? ' on' : ''),
                onClick: () => setStore({ wsId: w.workspaceId }),
              }, w.title || w.workspaceId)),
            )
          : null,
        React.createElement(Composer),
      )
    }

    function SessionView() {
      const st = useStore()
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'sid-session-head' },
          React.createElement('span', { className: 'sid-sh-title' }, sessionTitleOf(st.sessionId)),
          st.streaming ? React.createElement('span', { className: 'sid-sh-status run' }, '运行中') : null,
        ),
        React.createElement(MessageFlow),
        React.createElement(Composer),
      )
    }

    function Main() {
      const st = useStore()
      try {
        return React.createElement('div', { className: 'sid-main' },
          React.createElement(Stardust),
          React.createElement(Sidebar),
          React.createElement('main', { className: 'sid-stage' },
            st.sessionId ? React.createElement(SessionView) : React.createElement(EmptyState),
          ),
        )
      } catch (e) {
        showCrash('Main: ' + String(e && e.message ? e.message : e))
        return React.createElement('div', { className: 'sid-main sid-main-crash' }, 'SIDOR 渲染异常')
      }
    }

    function Toast() {
      const msg = useToast()
      if (!msg) return null
      return React.createElement('div', { className: 'sid-toast', role: 'status' }, msg)
    }

    function OverlayShell() {
      const isOpen = useOpen()
      React.useEffect(() => { if (!isOpen) setView('intro') }, [isOpen])
      if (!isOpen) return null
      let content
      try {
        content = view === 'intro'
          ? React.createElement(IntroScene, { onFinished: () => setView('main') })
          : React.createElement(Main)
      } catch (e) {
        showCrash(String(e && e.message ? e.message : e))
        content = null
      }
      return React.createElement('div', { className: 'sid-shell' },
        content,
        React.createElement(Toast),
      )
    }

    /* ==================================================================
     * styles — official dsh look with SIDOR geometry
     * ================================================================== */
    styles.insert(`
.sid-shell {
  --sid-bg: var(--dsw-alias-bg-base);
  --sid-surface: var(--dsw-alias-bg-layer-1);
  --sid-surface-2: var(--dsw-alias-bg-layer-2);
  --sid-hairline: var(--dsw-alias-border-l1);
  --sid-hairline-strong: var(--dsw-alias-border-l2);
  --sid-ink: var(--dsw-alias-label-primary);
  --sid-ink-dim: var(--dsw-alias-label-secondary);
  --sid-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: auto;
  color: var(--sid-ink);
  background: var(--sid-bg);
  background: color-mix(in srgb, var(--sid-bg) 82%, transparent);
  backdrop-filter: blur(18px) saturate(1.05);
  -webkit-backdrop-filter: blur(18px) saturate(1.05);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  animation: sid-in 0.32s var(--sid-ease);
  z-index: 0;
}
.sid-shell * { box-sizing: border-box; }
@keyframes sid-in { from { opacity: 0; transform: scale(1.012); } to { opacity: 1; transform: scale(1); } }

.sid-intro { position: absolute; inset: 0; overflow: hidden; }
.sid-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.sid-marks { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.sid-mark-ghost { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; }
.sid-ghost-click { display: inline-flex; }
.sid-ghost-click.on { animation: sid-click-pop 0.32s var(--sid-ease); }
.sid-ghost-spin { display: inline-flex; animation: sid-spin 60s linear infinite; }
.sid-ghost-breathe { display: inline-flex; animation: sid-breathe 8s ease-in-out infinite; }
@keyframes sid-click-pop { 0% { transform: scale(1); } 40% { transform: scale(0.9); } 70% { transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes sid-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sid-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
.sid-dust-star { position: absolute; transform: translate(-50%, -50%); color: var(--sid-ink); display: inline-flex; animation: sid-twinkle 3s ease-in-out infinite; }
@keyframes sid-twinkle { 0%, 100% { opacity: 0.16; } 50% { opacity: 0.8; } }

.sid-stardust { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }

.sid-main { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; min-height: 0; z-index: 1; animation: sid-main-in 0.45s var(--sid-ease); }
@keyframes sid-main-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* sidebar */
.sid-sidebar {
  width: 288px; flex: none; display: flex; flex-direction: column; min-height: 0;
  padding: 14px 12px; border-right: 1px solid var(--sid-hairline);
  background: var(--sid-surface);
  background: color-mix(in srgb, var(--sid-surface) 55%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.sid-sb-head { display: flex; align-items: center; gap: 8px; padding: 2px 4px 12px; }
.sid-sb-mark { display: inline-flex; color: var(--dsw-alias-brand-primary); }
.sid-sb-title { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; font-size: 15px; letter-spacing: 0.2em; }
.sid-sb-ws { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; max-height: 84px; overflow-y: auto; flex: none; }
.sid-ws-chip {
  display: inline-flex; align-items: center; max-width: 100%; padding: 4px 10px;
  border: 1px solid var(--sid-hairline); border-radius: 999px; background: transparent;
  color: var(--sid-ink-dim); font-size: 12px; cursor: pointer; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; transition: all 0.15s var(--sid-ease);
}
.sid-ws-chip:hover { color: var(--sid-ink); border-color: var(--sid-hairline-strong); }
.sid-ws-chip.on { color: var(--sid-ink); border-color: var(--sid-ink); background: var(--sid-surface-2); }
.sid-sb-new {
  display: flex; align-items: center; justify-content: center; gap: 6px; height: 34px;
  border: 1px solid var(--sid-hairline-strong); border-radius: 9px; background: transparent;
  color: var(--sid-ink); font-size: 13px; cursor: pointer; margin-bottom: 10px; flex: none;
  transition: background 0.15s var(--sid-ease);
}
.sid-sb-new:hover { background: var(--sid-surface-2); }
.sid-sb-new-ic { display: inline-flex; color: var(--sid-ink-dim); }
.sid-sb-search { margin-bottom: 8px; flex: none; position: relative; }
.sid-sb-search-ic { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); display: inline-flex; color: var(--sid-ink-dim); opacity: 0.8; pointer-events: none; }
.sid-sb-search input {
  width: 100%; height: 30px; padding: 0 10px 0 30px; border: 1px solid var(--sid-hairline); border-radius: 8px;
  background: color-mix(in srgb, var(--sid-surface) 72%, transparent); color: var(--sid-ink);
  font-size: 12px; outline: none;
}
.sid-sb-search input:focus { border-color: var(--sid-hairline-strong); }
.sid-sb-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 0; }
.sid-sb-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px;
  cursor: pointer; color: var(--sid-ink-dim); font-size: 13px; line-height: 18px;
}
.sid-sb-row:hover { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-sb-row.active { color: var(--sid-ink); background: var(--sid-surface-2); }
.sid-sb-row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sid-sb-row-meta { margin-left: auto; flex: none; font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: var(--sid-ink-dim); }
.sid-sb-foot { display: flex; align-items: center; gap: 4px; padding-top: 10px; margin-top: 8px; border-top: 1px solid var(--sid-hairline); flex: none; }
.sid-sb-foot-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
  border: none; border-radius: 8px; background: transparent; color: var(--sid-ink-dim); cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-sb-foot-btn:hover { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-empty { padding: 16px 8px; text-align: center; font-size: 12px; color: var(--sid-ink-dim); }
.sid-sb-list::-webkit-scrollbar, .sid-sb-ws::-webkit-scrollbar { width: 8px; }
.sid-sb-list::-webkit-scrollbar-thumb, .sid-sb-ws::-webkit-scrollbar-thumb { background: var(--sid-hairline-strong); border-radius: 4px; }

/* stage */
.sid-stage { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.sid-session-head {
  display: flex; align-items: center; gap: 10px; padding: 12px 20px; flex: none;
  border-bottom: 1px solid var(--sid-hairline);
  background: color-mix(in srgb, var(--sid-surface) 55%, transparent);
}
.sid-sh-title { font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sid-sh-status { font-size: 11px; color: var(--sid-ink-dim); }
.sid-sh-status.run { color: var(--dsw-alias-state-success-primary); }

/* message flow */
.sid-flow {
  flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px;
  display: flex; flex-direction: column; gap: 14px;
}
.sid-msg { display: flex; gap: 10px; max-width: 780px; width: 100%; align-self: center; }
.sid-msg.user { justify-content: flex-end; }
.sid-msg-bubble {
  max-width: 78%; padding: 9px 14px; border-radius: 14px;
  background: var(--sid-surface-2);
  background: color-mix(in srgb, var(--sid-surface-2) 70%, transparent);
  border: 1px solid var(--sid-hairline);
}
.sid-msg-text { font-size: 14px; line-height: 22px; white-space: pre-wrap; overflow-wrap: anywhere; }
.sid-msg-img { max-width: 240px; border-radius: 10px; margin-top: 6px; display: block; }
.sid-msg-mark { display: inline-flex; flex: none; margin-top: 6px; color: var(--sid-ink-dim); }
.sid-msg-body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.sid-caret { display: inline-block; width: 7px; height: 14px; margin-left: 2px; vertical-align: -2px; background: currentColor; animation: sid-caret-blink 0.9s steps(2) infinite; }
@keyframes sid-caret-blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
.sid-think {
  border: 1px solid var(--sid-hairline); border-radius: 10px; padding: 8px 12px;
  background: var(--sid-surface);
  background: color-mix(in srgb, var(--sid-surface) 50%, transparent);
}
.sid-think-label { display: block; font-size: 11px; letter-spacing: 0.1em; color: var(--sid-ink-dim); margin-bottom: 4px; }
.sid-think-text { font-size: 13px; line-height: 20px; color: var(--sid-ink-dim); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 200px; overflow-y: auto; }
.sid-tool { border: 1px solid var(--sid-hairline); border-radius: 10px; overflow: hidden; }
.sid-tool-head {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px;
  border: none; background: var(--sid-surface-2);
  background: color-mix(in srgb, var(--sid-surface-2) 45%, transparent);
  color: var(--sid-ink); font-size: 12px; cursor: pointer; text-align: left;
}
.sid-tool-head.static { cursor: default; }
.sid-tool-ic { display: inline-flex; color: var(--sid-ink-dim); }
.sid-tool-name { font-weight: 600; }
.sid-tool-chev { margin-left: auto; font-size: 10px; color: var(--sid-ink-dim); transition: transform 0.15s var(--sid-ease); }
.sid-tool-chev.open { transform: rotate(180deg); }
.sid-tool-args, .sid-tool-result { margin: 0; padding: 8px 10px; font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; border-top: 1px solid var(--sid-hairline); max-height: 240px; overflow-y: auto; color: var(--sid-ink-dim); }
.sid-tool-result-head { display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 10px; border: none; background: transparent; color: var(--sid-ink-dim); font-size: 11px; cursor: pointer; text-align: left; }
.sid-msg.system { justify-content: center; font-size: 12px; color: var(--sid-ink-dim); font-family: ui-monospace, Consolas, monospace; opacity: 0.8; }

/* composer */
.sid-composer { width: min(760px, 100%); margin: 0 auto; padding: 12px 24px 20px; flex: none; position: relative; }
.sid-composer-card {
  border: 1px solid var(--sid-hairline-strong); border-radius: 18px;
  background: var(--sid-surface);
  background: color-mix(in srgb, var(--sid-surface) 72%, transparent);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  padding: 10px 14px 8px;
}
.sid-composer-card:focus-within { box-shadow: 0 0 0 1px var(--sid-ink); }
.sid-ta {
  width: 100%; display: block; border: none; outline: none; resize: none;
  background: transparent; color: var(--sid-ink);
  font-size: 15px; line-height: 24px; min-height: 40px; max-height: 144px;
  padding: 6px 4px 4px; overflow-y: auto; font-family: inherit;
}
.sid-ta::placeholder { color: var(--sid-ink-dim); opacity: 0.7; }
.sid-composer-tools { display: flex; align-items: center; gap: 6px; }
.sid-composer-model {
  display: inline-flex; align-items: center; height: 28px; padding: 0 12px;
  border: 1px solid var(--sid-hairline); border-radius: 14px; color: var(--sid-ink-dim);
  font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sid-spacer { flex: 1; }
.sid-cmdbtn {
  display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
  border: 1px solid var(--sid-hairline); border-radius: 16px; background: transparent;
  color: var(--sid-ink-dim); font-size: 14px; cursor: pointer; transition: all 0.15s var(--sid-ease);
}
.sid-cmdbtn:hover, .sid-cmdbtn.on { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-send {
  display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
  border: none; border-radius: 17px; background: var(--sid-surface-2); color: var(--sid-ink); cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-send:hover:not(:disabled) { box-shadow: inset 0 0 0 1px var(--sid-hairline-strong); }
.sid-send.off { opacity: 0.4; cursor: not-allowed; }
.sid-send.stop { color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); }
.sid-composer-stats {
  display: flex; align-items: center; justify-content: center; gap: 8px; padding-top: 8px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 11px;
  letter-spacing: 0.08em; color: var(--sid-ink-dim);
}
.sid-stats-sep { opacity: 0.5; }
.sid-cmdmenu {
  position: absolute; left: 24px; right: 24px; bottom: calc(100% - 8px);
  max-height: 240px; overflow-y: auto; padding: 6px; z-index: 5;
  border: 1px solid var(--sid-hairline-strong); border-radius: 14px;
  background: color-mix(in srgb, var(--sid-surface) 94%, transparent);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 12px 38px rgba(0, 0, 0, 0.24);
  animation: sid-pop-in 0.16s var(--sid-ease); transform-origin: bottom center;
}
@keyframes sid-pop-in { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.sid-cmditem {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  padding: 8px 10px; border: none; border-radius: 10px; background: transparent;
  color: var(--sid-ink-dim); font-size: 13px; cursor: pointer;
}
.sid-cmditem:hover, .sid-cmditem.on { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-cmdmark { flex: none; font-family: ui-monospace, Consolas, monospace; color: var(--sid-ink-dim); }
.sid-cmdname { flex: none; font-weight: 500; }
.sid-cmddesc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; opacity: 0.7; }

/* empty state */
.sid-empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 0; }
.sid-es-mark { display: inline-flex; color: var(--sid-ink); opacity: 0.9; }
.sid-es-title { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; font-size: 40px; letter-spacing: 0.2em; text-indent: 0.2em; margin-top: 10px; }
.sid-es-sub { font-size: 13px; letter-spacing: 0.3em; text-indent: 0.3em; color: var(--sid-ink-dim); margin-bottom: 10px; }
.sid-es-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 640px; }
.sid-empty-state .sid-composer { width: min(680px, 92%); }

.sid-toast {
  position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); z-index: 6;
  padding: 8px 16px; border: 1px solid var(--sid-hairline-strong); border-radius: 10px;
  background: color-mix(in srgb, var(--sid-surface) 82%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-size: 12px; color: var(--sid-ink); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  animation: sid-toast-in 0.24s var(--sid-ease); pointer-events: none;
}
@keyframes sid-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

.sid-foot {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  width: 100%; height: 100%; border: none; background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer; font: inherit;
}
.sid-foot-mark { display: inline-flex; transition: transform 0.2s var(--sid-ease); }
.sid-foot:hover .sid-foot-mark { transform: rotate(90deg); }
.sid-foot.on { color: var(--dsw-alias-brand-primary); }
.sid-foot.on .sid-foot-mark { filter: drop-shadow(0 0 5px color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent)); }
.sid-foot-label { font-size: 12px; letter-spacing: 0.18em; }

/* render-error fallback */
.sid-crash {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 40px; text-align: center; z-index: 10;
  background: var(--sid-bg);
}
.sid-crash-mark { display: inline-flex; color: var(--dsw-alias-brand-primary); opacity: 0.9; }
.sid-crash-title { font-size: 15px; font-weight: 600; color: var(--sid-ink); }
.sid-crash-msg {
  max-width: 560px; padding: 12px 16px; border: 1px solid var(--sid-hairline-strong);
  border-radius: 10px; background: var(--sid-surface); color: var(--dsw-alias-state-error-primary);
  font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 18px;
  white-space: pre-wrap; overflow-wrap: anywhere; text-align: left;
}
.sid-crash-actions { display: flex; gap: 10px; }
.sid-crash-btn {
  padding: 7px 18px; border: 1px solid var(--sid-hairline-strong); border-radius: 14px;
  background: var(--sid-surface-2); color: var(--sid-ink); font-size: 13px; cursor: pointer;
}
.sid-crash-btn:hover { box-shadow: inset 0 0 0 1px var(--sid-hairline-strong); }
`)

    /* ==================================================================
     * slot registrations
     * ================================================================== */
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'sidor-open', order: 10, label: 'SIDOR' },
      (props) => React.createElement(FooterAction, { wide: !!props.wide }),
    ))
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'sidor-shell', order: 100, label: 'SIDOR' },
      () => React.createElement(OverlayShell),
    ))
  },
}
