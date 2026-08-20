return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    /* ============ intro open state ============ */
    let open = false
    const openSubs = new Set()
    function emitOpen() { for (const l of Array.from(openSubs)) l() }
    function setOpen(v) { if (open !== v) { open = v; emitOpen() } }
    function useOpen() {
      const [v, setV] = React.useState(open)
      React.useEffect(() => {
        const l = () => setV(open)
        openSubs.add(l)
        return () => { openSubs.delete(l) }
      }, [])
      return v
    }

    /* ============ typography — the custom-font injection point ============ */
    const FONT_LATIN = "'Georgia', 'Times New Roman', 'Noto Serif SC', serif"
    const FONT_CJK = "'Noto Serif SC', 'Songti SC', 'SimSun', 'Microsoft YaHei', serif"

    /* ============ icons (intro + footer only) ============ */
    const STAR_14 = 'M7 0.8 8.6 5.4 13.2 7 8.6 8.6 7 13.2 5.4 8.6 0.8 7 5.4 5.4 Z'
    const STAR_96 = 'M48 5.5 59 37 90.5 48 59 59 48 90.5 37 59 5.5 48 37 37 Z'
    const STAR_12 = 'M6 0.7 7.4 4.6 11.3 6 7.4 7.4 6 11.3 4.6 7.4 0.7 6 4.6 4.6 Z'
    const IC = {
      mark: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="' + STAR_14 + '" fill="currentColor"/></svg>',
      markGhost: '<svg width="460" height="460" viewBox="0 0 96 96" fill="none" aria-hidden="true"><defs><filter id="sid-ghost-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.8"/></filter></defs><path d="' + STAR_96 + '" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" filter="url(#sid-ghost-glow)" opacity="0.55"/><path d="' + STAR_96 + '" fill="currentColor" opacity="0.07"/><path d="' + STAR_96 + '" stroke="currentColor" stroke-width="0.9" stroke-linejoin="round" opacity="0.65"/></svg>',
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

    /* ============ particle engine ============ */
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
        if (soft) {
          for (const p of out) p.a = 0.06 + 0.22 * Math.random()
        }
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
        if (state.disturb && mouse.active) {
          const R = state.disturb.r
          const R2 = R * R
          for (const p of particles) {
            const dx = p.x - mouse.x
            const dy = p.y - mouse.y
            const d2 = dx * dx + dy * dy
            if (d2 < R2 && d2 > 1e-6) {
              const d = Math.sqrt(d2)
              const f = state.disturb.f * (1 - d / R) * 0.55
              p.x += (dx / d) * f
              p.y += (dy / d) * f
            }
          }
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

      const api = {
        scatter() { assignTargets(null); return api },
        showStar(scale, box, soft) { assignTargets(starModel(scale || 1, soft), box); return api },
        showText(text, fontPx, o) { assignTargets(textModel([{ text: text, size: fontPx }], o), o && o.box); return api },
        showTextLines(lines, o) { assignTargets(textModel(lines, o), o && o.box); return api },
        setInkVar(v) { inkVar = v; state.ink = readInk(); return api },
        setInk(c) { state.ink = c; return api },
        setSize(k) { state.sizeScale = k; return api },
        setSpeedScale(k) { state.speedScale = k; return api },
        setDriftScale(k) { state.driftScale = k; return api },
        setAmbientAlpha(a) { state.ambientA = a; return api },
        setDisturb(r, f) { state.disturb = { r: r, f: f }; return api },
        disturbOff() { state.disturb = null; return api },
        onMouse(x, y) { mouse.x = x; mouse.y = y; mouse.active = true },
        clearMouse() { mouse.active = false },
        refreshInk() { state.ink = readInk(); return api },
        resize: resize,
        start() {
          if (state.running) return api
          state.running = true
          t0 = performance.now()
          state.ink = readInk()
          resize()
          if (!particles.length) spawn()
          raf = requestAnimationFrame(frame)
          return api
        },
        stop() {
          state.running = false
          if (raf) cancelAnimationFrame(raf)
          raf = 0
          ctx2d.clearRect(0, 0, W, H)
          return api
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
          return api
        },
      }
      resize()
      spawn()
      return api
    }

    /* ============ components ============ */
    function FooterAction(props) {
      const isOpen = useOpen()
      const onClick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setOpen(true)
      }
      return React.createElement('button', {
        type: 'button',
        className: 'sid-foot' + (isOpen ? ' on' : ''),
        title: 'SIDOR',
        'aria-label': 'SIDOR',
        'aria-pressed': isOpen,
        onClick: onClick,
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

    function IntroOverlay() {
      const isOpen = useOpen()
      if (!isOpen) return null
      return React.createElement('div', { className: 'sid-intro-shell' },
        React.createElement(IntroScene, { onFinished: () => setOpen(false) }),
      )
    }

    /* ambient starfield, permanently over the official UI (very faint) */
    function Stardust() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const engine = createParticleEngine(canvas, { count: 1600 })
        engine.setInkVar('--dsw-alias-label-primary')
        engine.setSize(1.8)
        engine.setAmbientAlpha(0.16)
        engine.setDriftScale(0.9)
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

    /* ============ styles ============ */
    styles.insert(`
.sid-intro-shell {
  --sid-bg: var(--dsw-alias-bg-base);
  --sid-surface: var(--dsw-alias-bg-layer-1);
  --sid-surface-2: var(--dsw-alias-bg-layer-2);
  --sid-hairline: var(--dsw-alias-border-l1);
  --sid-hairline-strong: var(--dsw-alias-border-l2);
  --sid-ink: var(--dsw-alias-label-primary);
  --sid-ink-dim: var(--dsw-alias-label-secondary);
  --sid-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 100;
  pointer-events: auto;
  color: var(--sid-ink);
  background: color-mix(in srgb, var(--sid-bg) 90%, transparent);
  backdrop-filter: blur(16px) saturate(1.05);
  -webkit-backdrop-filter: blur(16px) saturate(1.05);
  animation: sid-in 0.32s var(--sid-ease);
}
.sid-intro-shell * { box-sizing: border-box; }
@keyframes sid-in {
  from { opacity: 0; transform: scale(1.012); }
  to { opacity: 1; transform: scale(1); }
}

.sid-intro { position: absolute; inset: 0; overflow: hidden; }
.sid-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.sid-marks { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.sid-mark-ghost { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; }
.sid-ghost-click { display: inline-flex; }
.sid-ghost-click.on { animation: sid-click-pop 0.32s var(--sid-ease); }
.sid-ghost-spin { display: inline-flex; animation: sid-spin 60s linear infinite; }
.sid-ghost-breathe { display: inline-flex; animation: sid-breathe 8s ease-in-out infinite; }
@keyframes sid-click-pop {
  0% { transform: scale(1); }
  40% { transform: scale(0.9); }
  70% { transform: scale(1.06); }
  100% { transform: scale(1); }
}
@keyframes sid-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sid-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
.sid-dust-star {
  position: absolute; transform: translate(-50%, -50%);
  color: var(--sid-ink); display: inline-flex;
  animation: sid-twinkle 3s ease-in-out infinite;
}
@keyframes sid-twinkle { 0%, 100% { opacity: 0.16; } 50% { opacity: 0.8; } }

/* permanent faint starfield over the official UI */
.sid-stardust {
  position: fixed; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 10;
}

/* sidebar footer entry */
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
`)

    /* ============ slot registrations ============ */
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'sidor-open', order: 10, label: 'SIDOR' },
      (props) => React.createElement(FooterAction, { wide: !!props.wide }),
    ))
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'sidor-stardust', order: 50, label: 'SIDOR' },
      () => React.createElement(Stardust),
    ))
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'sidor-intro', order: 100, label: 'SIDOR' },
      () => React.createElement(IntroOverlay),
    ))
  },
}
