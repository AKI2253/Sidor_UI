return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const conversation = ctx.get('conversation')

    /* ============ icon set (confirmed SIDOR assets) ============ */
    const STAR_14 = 'M7 0.8 8.6 5.4 13.2 7 8.6 8.6 7 13.2 5.4 8.6 0.8 7 5.4 5.4 Z'
    const STAR_96 = 'M48 5.5 59 37 90.5 48 59 59 48 90.5 37 59 5.5 48 37 37 Z'
    const STAR_12 = 'M6 0.7 7.4 4.6 11.3 6 7.4 7.4 6 11.3 4.6 7.4 0.7 6 4.6 4.6 Z'
    const IC = {
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

    /* ============ typography (confirmed intro fonts) ============ */
    const FONT_LATIN = "'Georgia', 'Times New Roman', 'Noto Serif SC', serif"
    const FONT_CJK = "'Noto Serif SC', 'Songti SC', 'SimSun', 'Microsoft YaHei', serif"

    /* ============ file-button icon (paperclip-ish) ============ */
    const BRAND_STAR = '<svg width="34" height="34" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="' + STAR_14 + '" fill="currentColor"/></svg>'
    const ICON_FILE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.1 3.6C9.1 3.34 8.86 3.1 8.6 3.1H4.8C4.08 3.1 3.5 3.68 3.5 4.4V11.6C3.5 12.32 4.08 12.9 4.8 12.9H11.2C11.92 12.9 12.5 12.32 12.5 11.6V7.4C12.5 7.14 12.26 6.9 12 6.9H10.4C9.68 6.9 9.1 6.32 9.1 5.6V3.6Z" fill="currentColor"/><path d="M10.5 3.15L12.9 5.55H10.5V3.15Z" fill="currentColor"/></svg>'
    const ICON_CHEVRON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"/></svg>'

    /* ============ particle engine (confirmed version) ============ */
    function createParticleEngine(canvas, opts) {
      opts = opts || {}
      const COUNT = opts.count || 6800
      let inkVar = opts.inkVar || '--dsw-alias-label-primary'
      const ctx2d = canvas.getContext('2d')
      const scratch = document.createElement('canvas')
      const sctx = scratch.getContext('2d', { willReadFrequently: true })
      const mouse = { x: 0, y: 0, active: false }
      const state = { running: false, ink: '#888888', frame: 0, sizeScale: 1.5, speedScale: 1, driftScale: 1, ambientA: 0.05, disturb: null, flow: null }
      // Optional soft glow: a pre-rendered radial-gradient sprite drawn under
      // each particle with 'lighter' blending (opts.glow: {size, alpha}).
      let glow = opts.glow || null
      let glowSprite = null
      let glowInk = null
      // A fixed ink (setInk) overrides the theme variable until setInkVar is
      // called again — used by the low-balance red-tinted starfield.
      let fixedInk = null
      let W = 0, H = 0, CX = 0, CY = 0
      let particles = []
      let model = null
      let modelBox = null
      let raf = 0
      let t0 = 0
      let dissipating = false
      const sec = () => (performance.now() - t0) / 1000

      function readInk() {
        if (fixedInk) return fixedInk
        try {
          const s = getComputedStyle(document.documentElement)
          const v = s.getPropertyValue(inkVar).trim()
          if (v) return v
        } catch (e) { /* ignore */ }
        return '#888888'
      }

      // Build (or rebuild) the soft radial glow sprite for the current ink
      // color. It is a small offscreen canvas drawn under each particle with
      // 'lighter' compositing, so the glow follows the theme's ink hue.
      function buildGlow() {
        if (!glow) { glowSprite = null; return }
        const ink = state.ink
        const S = 48
        const c = document.createElement('canvas')
        c.width = S
        c.height = S
        const g = c.getContext('2d')
        const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
        grad.addColorStop(0, ink)
        grad.addColorStop(0.35, ink)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.clearRect(0, 0, S, S)
        g.globalAlpha = glow.alpha || 0.35
        g.fillStyle = grad
        g.fillRect(0, 0, S, S)
        g.globalAlpha = 1
        glowSprite = c
        glowInk = ink
      }

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        // Container-sized mode: the caller supplies a size source (settings
        // panel), otherwise the engine fills the viewport as before.
        if (opts.getSize) {
          const s = opts.getSize() || {}
          W = Math.max(1, s.w || window.innerWidth)
          H = Math.max(1, s.h || window.innerHeight)
        } else {
          W = window.innerWidth
          H = window.innerHeight
        }
        canvas.width = Math.max(1, Math.floor(W * dpr))
        canvas.height = Math.max(1, Math.floor(H * dpr))
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
        CX = W / 2
        CY = H / 2
        // Re-home scattered particles ONLY when the viewport truly resizes
        // (opts.rehome defaults to true). The settings panel calls resize()
        // defensively on a timer; re-homing there would re-scatter every
        // particle each tick and look like jitter — pass rehome:false instead.
        if (particles.length && !model && opts.rehome !== false) {
          for (const p of particles) {
            p.x = (Math.random() - 0.5) * W * 1.6
            p.y = (Math.random() - 0.5) * H * 1.6
          }
        }
      }

      function spawn() {
        particles = []
        for (let i = 0; i < COUNT; i++) {
          particles.push({
            x: (Math.random() - 0.5) * W * 1.6,
            y: (Math.random() - 0.5) * H * 1.6,
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
            // Directed flow: all ambient particles stream along (flow.x, flow.y)
            // at flow.speed, producing a fast, directional particle current.
            // Each particle keeps its own small random drift on top, so the
            // stream still shimmers like a solar-storm field line.
            let fx = 0
            let fy = 0
            if (state.flow) {
              const fs = state.flow.speed * 34 * dt
              fx = state.flow.x * fs
              fy = state.flow.y * fs
            }
            tx = p.x + p.drift.x * 26 * state.driftScale * dt + fx + mx * 0.6
            ty = p.y + p.drift.y * 26 * state.driftScale * dt + fy + my * 0.6
            ta = state.ambientA * (0.55 + 0.45 * Math.sin(now * p.tw + p.ph))
          }
          const s = p.speed
          p.x += (tx - p.x) * s
          p.y += (ty - p.y) * s
          p.a += (ta - p.a) * Math.min(1, s * 2.4)
        }
        if (!model && !dissipating) {
          const mx2 = W * 0.55
          const my2 = H * 0.55
          for (const p of particles) {
            if (p.x < -mx2 || p.x > W + mx2 || p.y < -my2 || p.y > H + my2) {
              p.x = Math.random() * W
              p.y = Math.random() * H
              // Directed-flow mode (storm): brand-new particles light up
              // almost instantly so the torrent visibly regenerates at speed.
              // Ambient mode keeps the original fade-in.
              p.a = state.flow ? Math.max(0.3, state.ambientA * 0.75) : 0
              p.drift = { x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.7 }
              p.ph = Math.random() * Math.PI * 2
              p.tw = 0.6 + Math.random() * 1.6
            }
          }
        }
      }

      function frame() {
        if (!state.running) return
        t0 = performance.now()
        ctx2d.clearRect(0, 0, W, H)
        step()
        state.frame++
        if (state.frame % 150 === 0) {
          state.ink = readInk()
          if (glow && glowInk !== state.ink) buildGlow()
        }
        // Soft glow pass (only for engines that enabled it).
        if (glow && glowSprite) {
          const gs = glow.size || 5
          ctx2d.globalCompositeOperation = 'lighter'
          for (const p of particles) {
            if (p.a <= 0.008) continue
            const size = Math.max(2, p.z * state.sizeScale * gs)
            ctx2d.globalAlpha = Math.min(1, p.a * 0.4)
            ctx2d.drawImage(glowSprite, p.x - size / 2, p.y - size / 2, size, size)
          }
          ctx2d.globalAlpha = 1
          ctx2d.globalCompositeOperation = 'source-over'
        }
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
        setInkVar(v) { inkVar = v; fixedInk = null; state.ink = readInk(); return api },
        setInk(c) { fixedInk = c; state.ink = c; return api },
        setSize(k) { state.sizeScale = k; return api },
        setSpeedScale(k) { state.speedScale = k; return api },
        setDriftScale(k) { state.driftScale = k; return api },
        setAmbientAlpha(a) { state.ambientA = a; return api },
        setDisturb(r, f) { state.disturb = { r: r, f: f }; return api },
        disturbOff() { state.disturb = null; return api },
        setFlow(x, y, speed) { state.flow = { x: x, y: y, speed: speed }; return api },
        flowOff() { state.flow = null; return api },
        setGlow(cfg) {
          glow = cfg || null
          glowSprite = null
          glowInk = null
          if (glow) buildGlow()
          return api
        },
        onMouse(x, y) { mouse.x = x; mouse.y = y; mouse.active = true },
        clearMouse() { mouse.active = false },
        refreshInk() { state.ink = readInk(); return api },
        resize: resize,
        start() {
          if (state.running) return api
          state.running = true
          t0 = performance.now()
          state.ink = readInk()
          if (glow) buildGlow()
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
    function IntroScene(props) {
      const canvasRef = React.useRef(null)
      const bgRef = React.useRef(null)
      const engineRef = React.useRef(null)
      const bgEngineRef = React.useRef(null)
      const [phase, setPhase] = React.useState('glow')
      const [clicking, setClicking] = React.useState(false)
      // Easter egg: 1-in-50 chance the intro TYPOGRAPHY particles render red.
      // Rolled once at mount; when it fires only the ink color changes — every
      // drift/glow/motion rule stays identical. Non-triggered runs look the
      // same as before.
      const [egg] = React.useState(() => Math.random() < 1 / 50)

      /* starfield backdrop behind the intro typography. In egg mode it turns
         red and erupts: a DENSE torrent of particles streaming fast along a
         fixed direction (directed flow), with only a small mouse disturb —
         like a solar electromagnetic storm. Normal mode unchanged. */
      React.useEffect(() => {
        const canvas = bgRef.current
        if (!canvas) return
        const engine = createParticleEngine(canvas, { count: egg ? 5700 : 1400 })
        if (egg) {
          engine.setInk('rgba(229, 83, 75, 0.62)')
          engine.setSize(3.0)
          engine.setAmbientAlpha(0.9)
          // Particle speed ×3: convergence and stream velocity both triple.
          engine.setSpeedScale(10.8)
          engine.setDriftScale(2.2)
          // Directed fast particle current: 45° upward-right stream, ×3.
          engine.setFlow(0.707, -0.707, 21.6)
          // Minimal mouse influence — the storm barely flinches.
          engine.setDisturb(90, 1.0)
          // Red halo on every particle: the torrent reads as searing energy.
          engine.setGlow({ size: 5.5, alpha: 0.4 })
        } else {
          engine.setInkVar('--dsw-alias-label-primary')
          engine.setSize(2.0)
          engine.setAmbientAlpha(0.4)
          engine.setDriftScale(0.5)
        }
        engine.scatter()
        engine.start()
        bgEngineRef.current = engine
        const onResize = () => engine.resize()
        window.addEventListener('resize', onResize)
        return () => {
          window.removeEventListener('resize', onResize)
          engine.stop()
        }
      }, [])

      React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        // Egg mode: much denser typography particles + faster convergence,
        // giving the letterforms a violent, streaming energy.
        const engine = createParticleEngine(canvas, { count: egg ? 15000 : 6800 })
        engineRef.current = engine
        if (egg) {
          engine.setSpeedScale(2.4)
          engine.setDriftScale(1.6)
          engine.setDisturb(90, 1.0)
        }
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
          if (egg) {
            engine.setInk('rgba(229, 83, 75, 0.62)')
          } else {
            engine.setInkVar('--dsw-alias-label-secondary')
          }
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
          if (egg) {
            engine.setInk('rgba(229, 83, 75, 0.62)')
          } else {
            engine.setInkVar('--dsw-alias-label-primary')
          }
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
        React.createElement('canvas', { ref: bgRef, className: 'sid-canvas-bg', 'aria-hidden': true }),
        React.createElement('canvas', { ref: canvasRef, className: 'sid-canvas', 'aria-hidden': true }),
      )
    }

    /* starfield: confirmed ParticleField parameters, viewport-wide with perpetual respawn */
    function Starfield() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const engine = createParticleEngine(canvas, { count: 3000 })
        engine.setInkVar('--dsw-alias-label-primary')
        engine.setSize(2.5)
        engine.setAmbientAlpha(0.48)
        engine.setDriftScale(0.5)
        engine.setDisturb(150, 2.0)
        engine.scatter()
        engine.start()
        // Low-balance tint: swap only the ink color to a soft red while the
        // balance is below a configured threshold; drift/glow/motion rules
        // stay untouched. A red glow blooms the tinted particles (brighter
        // but not glaring); normal white particles keep no glow.
        const applyTint = () => {
          const low = sidBalance.ready && sidBalance.visible && sidBalanceLow()
          if (low) {
            engine.setInk('rgba(229, 83, 75, 0.55)')
            engine.setGlow({ size: 4.5, alpha: 0.4 })
          } else {
            engine.setInkVar('--dsw-alias-label-primary')
            engine.setGlow(null)
          }
        }
        applyTint()
        const unsub = sidBalanceSubscribe(applyTint)
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
          unsub()
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerleave', onLeave)
          window.removeEventListener('resize', onResize)
          engine.stop()
        }
      }, [])
      return React.createElement('canvas', { ref: ref, className: 'sid-starfield', 'aria-hidden': true })
    }

    /* frame overlay: intro first, then the persistent starfield layer */
    function SidorFx() {
      const [phase, setPhase] = React.useState('intro')
      const [brandPos, setBrandPos] = React.useState(null)

      // Track the hero headline so the SIDOR brand mark sits beneath it like
      // the official whale+word: the whole brand row (star + SIDOR丨HARNESS)
      // matches the main-title body width (whale left edge → headline text
      // right edge), ignoring the preview badge. Follows per-frame via rAF so
      // it moves in lockstep with the sidebar animation.
      React.useEffect(() => {
        let raf = 0
        let lastKey = null
        const measure = () => {
          raf = requestAnimationFrame(measure)
          const fish = document.querySelector('[data-phase="hero"] [class*="fish"]')
          const hlText = document.querySelector('[data-phase="hero"] [class*="headlineText"]')
          const hl = document.querySelector('[data-phase="hero"] [class*="headline"]')
          if (hl instanceof HTMLElement) {
            let left = 0
            let width = 0
            if (fish instanceof HTMLElement && hlText instanceof HTMLElement) {
              const fr = fish.getBoundingClientRect()
              const tr = hlText.getBoundingClientRect()
              left = fr.left
              width = tr.right - fr.left
            } else if (hlText instanceof HTMLElement) {
              const tr = hlText.getBoundingClientRect()
              left = tr.left
              width = tr.width
            } else {
              const hr = hl.getBoundingClientRect()
              left = hr.left
              width = hr.width
            }
            const top = hl.getBoundingClientRect().bottom + 18
            const key = left.toFixed(1) + '|' + width.toFixed(1) + '|' + top.toFixed(1)
            if (lastKey !== key) {
              lastKey = key
              setBrandPos({ left, width, top })
            }
          } else if (lastKey !== null) {
            lastKey = null
            setBrandPos(null)
          }
        }
        raf = requestAnimationFrame(measure)
        return () => cancelAnimationFrame(raf)
      }, [])

      // Replace composer placeholders persistently. The observer dies when
      // React rebuilds the textarea (hero ⇄ conversation switch), so every
      // tick re-checks the live node: re-attach the observer to a new node and
      // force a rewrite. Any stock value is corrected in the same tick.
      React.useEffect(() => {
        const PLACEHOLDER_MAP = {
          '给智能体发消息': '控制台已连接',
          '描述你想要构建的内容': 'SIDOR系统已接入，开始构建',
          '选择一个工作区开始': 'SIDOR系统已接入，开始构建',
        }
        const rewrite = () => {
          const ta = document.querySelector('[data-input-scroll] textarea')
          if (!(ta instanceof HTMLTextAreaElement)) return
          const next = PLACEHOLDER_MAP[ta.placeholder]
          if (next !== undefined) ta.placeholder = next
        }
        let observed = null
        const mo = new MutationObserver(() => { rewrite() })
        const tick = () => {
          const ta = document.querySelector('[data-input-scroll] textarea')
          if (ta instanceof HTMLTextAreaElement) {
            if (observed !== ta) {
              mo.disconnect()
              mo.observe(ta, { attributes: true, attributeFilter: ['placeholder'] })
              observed = ta
            }
            rewrite()
          } else {
            observed = null
          }
        }
        tick()
        const iv = ctx.interval(tick, 300)
        return () => { mo.disconnect(); iv() }
      }, [])

      // Settings panel FX: when the official settings panel opens (the
      // .settingsArea [class*="_panel"] container), inject a starfield canvas
      // as its background plus a soft light flowing along its border.
      // Detected live each tick so it works across hero ⇄ conversation and
      // survives panel open/close (the container is unmounted on close).
      React.useEffect(() => {
        const panelSel = '[class*="settingsArea"] [class*="_panel"]'
        // The official settings nav maps known section ids to icons and falls
        // back to the gear for unknown ones. Our "余额" section is unknown, so
        // swap its gear for the wallet icon every tick (React rebuilds it).
        // NOTE: the official navIcon returns the <svg> element itself, so we
        // must insert our wallet before the svg and hide the svg — never
        // append inside it.
        const fixNavIcon = () => {
          const cells = document.querySelectorAll('[class*="settingsArea"] [class*="_nav"] [class*="navCell"]')
          for (const cell of Array.from(cells)) {
            if (!(cell instanceof HTMLElement)) continue
            const label = cell.querySelector('[class*="navLabel"]')
            if (!label || (label.textContent || '').trim() !== '余额') continue
            const svg = cell.querySelector('svg[class*="navIcon"], [class*="navIcon"]')
            if (!svg) continue
            if (cell.querySelector('.sid-nav-wallet')) {
              svg.style.display = 'none'
              continue
            }
            const wrapper = document.createElement('span')
            wrapper.className = 'sid-nav-wallet'
            wrapper.setAttribute('aria-hidden', 'true')
            wrapper.innerHTML = ICON_WALLET
            cell.insertBefore(wrapper, svg)
            svg.style.display = 'none'
          }
        }
        let engine = null
        let canvas = null
        let glow = null
        let panel = null
        let lastSize = null
        let raf = 0
        // ROOT-level observer, armed from the very start (not after a 500ms
        // panel tick): the instant React inserts/updates any nav cell inside
        // the settings area, swap the gear for the wallet synchronously —
        // before the browser paints — so the gear never flashes. A fast
        // closest() check keeps the body-wide observer cheap.
        const rootMo = new MutationObserver((muts) => {
          let hit = false
          for (const m of muts) {
            const t = m.target
            if (t && t.nodeType === 1 && typeof t.closest === 'function') {
              if (t.closest('[class*="settingsArea"]')) { hit = true; break }
            }
          }
          if (hit) fixNavIcon()
        })
        try {
          rootMo.observe(document.body, { childList: true, subtree: true })
        } catch (e) { /* body not ready yet */ }
        // Panel-level observer: belt and braces for rebuilds inside the panel.
        let navMo = null
        const teardown = () => {
          if (navMo) { navMo.disconnect(); navMo = null }
          if (engine) { engine.stop(); engine = null }
          if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas)
          if (glow && glow.parentElement) glow.parentElement.removeChild(glow)
          canvas = null
          glow = null
          panel = null
          lastSize = null
        }
        const tick = () => {
          const el = document.querySelector(panelSel)
          if (!(el instanceof HTMLElement)) {
            if (panel !== null || engine !== null) teardown()
            return
          }
          fixNavIcon()
          const r = el.getBoundingClientRect()
          if (r.width < 60 || r.height < 40) {
            if (panel !== null || engine !== null) teardown()
            return
          }
          if (el !== panel) {
            teardown()
            panel = el
            // Watch the whole panel subtree: whenever React inserts/updates
            // nav cells, swap the gear for the wallet synchronously (same
            // microtask as the DOM insert, before paint).
            navMo = new MutationObserver(() => { fixNavIcon() })
            navMo.observe(el, { childList: true, subtree: true })
            const size = () => {
              const rr = el.getBoundingClientRect()
              return { w: Math.max(1, Math.round(rr.width)), h: Math.max(1, Math.round(rr.height)) }
            }
            canvas = document.createElement('canvas')
            canvas.className = 'sid-settings-star'
            canvas.setAttribute('aria-hidden', 'true')
            el.insertBefore(canvas, el.firstChild)
            engine = createParticleEngine(canvas, { count: 900, getSize: size, rehome: false })
            engine.setInkVar('--dsw-alias-label-primary')
            engine.setSize(2.5)
            engine.setAmbientAlpha(0.48)
            engine.setDriftScale(0.5)
            engine.setDisturb(150, 2.0)
            engine.setGlow({ size: 5, alpha: 0.28 })
            engine.scatter()
            engine.start()
            lastSize = [Math.round(r.width), Math.round(r.height)]
            // Soft light flowing along the border (masked ring, rotating
            // conic-gradient via @property).
            glow = document.createElement('div')
            glow.className = 'sid-settings-glow'
            glow.setAttribute('aria-hidden', 'true')
            el.appendChild(glow)
            const onMove = (e) => {
              const rr = el.getBoundingClientRect()
              engine.onMouse(e.clientX - rr.left, e.clientY - rr.top)
            }
            const onLeave = () => engine.clearMouse()
            const onResize = () => engine.resize()
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerleave', onLeave)
            window.addEventListener('resize', onResize)
            el.__sidFxFns = { onMove, onLeave, onResize }
          } else if (engine) {
            // Only resize when the panel size genuinely changed — with
            // rehome:false a spurious resize is harmless, but this guard
            // avoids the extra canvas resets on every tick.
            const rw = Math.round(r.width)
            const rh = Math.round(r.height)
            if (lastSize === null || lastSize[0] !== rw || lastSize[1] !== rh) {
              lastSize = [rw, rh]
              engine.resize()
            }
          }
        }
        const iv = ctx.interval(tick, 500)
        tick()
        return () => {
          iv()
          rootMo.disconnect()
          if (panel && panel.__sidFxFns) {
            const f = panel.__sidFxFns
            window.removeEventListener('pointermove', f.onMove)
            window.removeEventListener('pointerleave', f.onLeave)
            window.removeEventListener('resize', f.onResize)
            delete panel.__sidFxFns
          }
          teardown()
        }
      }, [])

      const onIntroFinished = () => {
        // Force the hero entrance animation to replay from the start once the
        // intro leaves the screen (removing then re-adding the marker in the
        // next frame re-runs the animation even if the hero was already mounted
        // beneath the overlay).
        const root = document.documentElement
        root.classList.remove('sid-hero-enter')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            root.classList.add('sid-hero-enter')
          })
        })
        setPhase('star')
      }
      // Auto-refresh the DeepSeek balance every 60s while it is visible and an
      // API key is configured (so the sidebar amount stays current).
      React.useEffect(() => {
        const check = () => {
          if (sidBalance.ready && sidBalance.visible && sidBalance.apiKey !== '') {
            sidBalanceQuery()
          }
        }
        const iv = ctx.interval(check, 60000)
        return () => iv()
      }, [])
      // Low-balance alert: when the balance drops to (or below) a configured
      // threshold, paint a soft RED flowing light along BOTH edges of the
      // sidebar column (left = window edge, right = workspace divider), in
      // wide and rail states alike. Toggled live from the store.
      React.useEffect(() => {
        let flows = []
        const teardownFlow = () => {
          for (const f of flows) {
            if (f && f.parentElement) f.parentElement.removeChild(f)
          }
          flows = []
        }
        const tick = () => {
          const low = sidBalance.ready && sidBalance.visible && sidBalanceLow()
          if (!low) {
            if (flows.length) teardownFlow()
            return
          }
          const host = document.querySelector('[class*="sidebarCol"]') ||
            document.querySelector('[class*="sidebar"] [class*="root"]')
          if (!(host instanceof HTMLElement)) {
            if (flows.length) teardownFlow()
            return
          }
          if (flows.length && flows[0].parentElement === host) return
          teardownFlow()
          const make = (cls) => {
            const el = document.createElement('div')
            el.className = cls
            el.setAttribute('aria-hidden', 'true')
            host.appendChild(el)
            flows.push(el)
          }
          make('sid-divider-flow left')
          make('sid-divider-flow right')
        }
        const iv = ctx.interval(tick, 500)
        tick()
        return () => { iv(); teardownFlow() }
      }, [])
      // Session log button (workspace top-right): flowing light border like
      // the settings panel — white normally, RED while balance is low.
      // The button lives in the session header utilities and is rebuilt by
      // React across sessions, so re-check it every tick like the divider flow.
      React.useEffect(() => {
        let glow = null
        const teardownGlow = () => {
          if (glow && glow.parentElement) glow.parentElement.removeChild(glow)
          glow = null
        }
        const tick = () => {
          const btn = document.querySelector('[class*="sessionLogButton"]')
          if (!(btn instanceof HTMLElement)) {
            if (glow !== null) teardownGlow()
            return
          }
          if (glow === null || glow.parentElement !== btn) {
            teardownGlow()
            btn.style.position = 'relative'
            glow = document.createElement('div')
            glow.className = 'sid-sessionlog-glow'
            glow.setAttribute('aria-hidden', 'true')
            btn.appendChild(glow)
          }
          const low = sidBalance.ready && sidBalance.visible && sidBalanceLow()
          glow.classList.toggle('low', !!low)
        }
        const iv = ctx.interval(tick, 500)
        tick()
        return () => { iv(); teardownGlow() }
      }, [])
      const brandVisible = phase === 'star' && brandPos !== null
      return React.createElement('div', { className: 'sid-fx' },
        phase === 'intro'
          ? React.createElement(IntroScene, { onFinished: onIntroFinished })
          : React.createElement(Starfield),
        brandVisible ? React.createElement('div', {
          className: 'sid-hero-brand',
          style: {
            left: Math.round(brandPos.left) + 'px',
            top: Math.round(brandPos.top) + 'px',
            width: Math.round(brandPos.width) + 'px',
          },
          'aria-hidden': true,
        },
          React.createElement('span', { className: 'sid-hero-brand-mark', dangerouslySetInnerHTML: { __html: BRAND_STAR } }),
          React.createElement('span', { className: 'sid-hero-brand-word' },
            React.createElement('span', { className: 'sid-hero-brand-sidor' }, 'SIDOR'),
            React.createElement('span', { className: 'sid-hero-brand-harness' }, '丨HARNESS'),
          ),
        ) : null,
      )
    }

    /* ============ balance widget (sidebar footer action + settings page) ============ */

    // Shared in-memory store; persisted via host RPC to the workspace config.
    const sidBalance = {
      ready: false,
      visible: true,
      apiKey: '',
      balance: null,
      alerts: { usd: 0, cny: 0 },
      error: null,
    }
    const sidBalanceListeners = new Set()
    function sidBalanceNotify() {
      for (const fn of Array.from(sidBalanceListeners)) {
        try { fn() } catch (e) { /* ignore */ }
      }
    }
    function sidBalanceSubscribe(fn) {
      sidBalanceListeners.add(fn)
      return () => sidBalanceListeners.delete(fn)
    }
    function sidBalanceLow() {
      const b = sidBalance.balance
      if (!b) return false
      const a = sidBalance.alerts || { usd: 0, cny: 0 }
      const usd = parseFloat(b.usd)
      const cny = parseFloat(b.cny)
      return (a.usd > 0 && Number.isFinite(usd) && usd <= a.usd) ||
        (a.cny > 0 && Number.isFinite(cny) && cny <= a.cny)
    }
    async function sidBalanceLoad() {
      try {
        const res = await host.call('sidor/balance-get', {})
        if (res && res.ok) {
          sidBalance.visible = !!res.visible
          sidBalance.apiKey = res.apiKey || ''
          sidBalance.balance = res.balance || null
          sidBalance.alerts = res.alerts || { usd: 0, cny: 0 }
        }
      } catch (e) { /* ignore */ }
      sidBalance.ready = true
      sidBalanceNotify()
    }
    async function sidBalanceSave(patch) {
      if (patch && typeof patch.visible === 'boolean') sidBalance.visible = patch.visible
      if (patch && typeof patch.apiKey === 'string') sidBalance.apiKey = patch.apiKey
      if (patch && typeof patch.alertUsd === 'number') sidBalance.alerts.usd = Math.max(0, patch.alertUsd)
      if (patch && typeof patch.alertCny === 'number') sidBalance.alerts.cny = Math.max(0, patch.alertCny)
      try {
        await host.call('sidor/balance-set', {
          visible: sidBalance.visible,
          apiKey: sidBalance.apiKey,
          alertUsd: sidBalance.alerts.usd,
          alertCny: sidBalance.alerts.cny,
        })
      } catch (e) { /* ignore */ }
      sidBalanceNotify()
    }
    async function sidBalanceQuery() {
      sidBalance.error = null
      sidBalanceNotify()
      try {
        const res = await host.call('sidor/balance-query', {})
        if (res && res.ok && res.balance) {
          sidBalance.balance = res.balance
        } else {
          sidBalance.error = res && res.error ? String(res.error) : '查询失败'
        }
      } catch (e) {
        sidBalance.error = String(e && e.message || e)
      }
      sidBalanceNotify()
    }

    // DeepSeek-ish wallet icon, stroke style matching the official icon set.
    const ICON_WALLET = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3.4" width="11.6" height="9.2" rx="1.8" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="6.1" width="11.6" height="2.6" stroke="currentColor" stroke-width="1.3"/><circle cx="11.3" cy="8.3" r="0.9" fill="currentColor"/></svg>'
    const ICON_REFRESH = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.65 4.2C12.3 2.2 10.25 1 8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C10.94 15 13.44 13.24 14.48 10.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13.65 0.9V4.7H9.85" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    const ICON_EXTERNAL = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.5 2.5H13.5V6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.2 2.8L7.2 8.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12.5 9.4V12.5C12.5 12.87 12.35 13.22 12.09 13.48C11.83 13.74 11.48 13.89 11.11 13.89H3.61C3.24 13.89 2.89 13.74 2.63 13.48C2.37 13.22 2.22 12.87 2.22 12.5V5C2.22 4.63 2.37 4.28 2.63 4.02C2.89 3.76 3.24 3.61 3.61 3.61H6.72" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'

    function BalanceFormat({ balance }) {
      const usd = balance && balance.usd ? balance.usd : '0.00'
      const cny = balance && balance.cny ? balance.cny : '0.00'
      return React.createElement('span', { className: 'sid-balance-amt' },
        React.createElement('span', { className: 'sid-balance-usd' }, '$' + usd + 'USD'),
        React.createElement('span', { className: 'sid-balance-sep' }, '+'),
        React.createElement('span', { className: 'sid-balance-cny' }, '¥' + cny + 'CNY'),
      )
    }

    // Sidebar footer action: beside Settings, matching the official cordis
    // plugin badge exactly (42px row / 36px rail circle). wide=false (rail)
    // shows only the icon with a hover tooltip carrying the balance.
    function BalanceFooterAction(props) {
      const wide = props.wide
      const [state, setState] = React.useState({ visible: sidBalance.visible, balance: sidBalance.balance, low: false })
      React.useEffect(() => {
        // Read the current value immediately (the store may already be loaded
        // by the settings page), then keep in sync with later changes.
        setState({ visible: sidBalance.visible, balance: sidBalance.balance, low: sidBalanceLow() })
        return sidBalanceSubscribe(() => setState({
          visible: sidBalance.visible,
          balance: sidBalance.balance,
          low: sidBalanceLow(),
        }))
      }, [])
      React.useEffect(() => { if (!sidBalance.ready) sidBalanceLoad() }, [])
      if (!state || !state.visible) return null
      const title = state.balance
        ? '余额  $' + state.balance.usd + ' USD  ¥' + state.balance.cny + ' CNY'
        : '余额 未查询（设置中配置 API Key）'
      return React.createElement('button', {
        type: 'button',
        className: 'sid-balance-badge' + (wide ? '' : ' rail') + (state.low ? ' low' : ''),
        title,
        'aria-label': title,
        'data-tip': wide ? undefined : (title),
      },
        React.createElement('span', { className: 'sid-balance-badge-ic', dangerouslySetInnerHTML: { __html: ICON_WALLET } }),
        wide
          ? React.createElement('span', { className: 'sid-balance-badge-label' },
              React.createElement(BalanceFormat, { balance: state.balance }),
            )
          : null,
      )
    }

    // Settings page: "余额" section, nav entry + content column.
    function BalanceSettingsPage() {
      const [state, setState] = React.useState({
        visible: sidBalance.visible,
        apiKey: sidBalance.apiKey,
        balance: sidBalance.balance,
        alerts: sidBalance.alerts || { usd: 0, cny: 0 },
        error: sidBalance.error,
      })
      React.useEffect(() => {
        setState({
          visible: sidBalance.visible,
          apiKey: sidBalance.apiKey,
          balance: sidBalance.balance,
          alerts: sidBalance.alerts || { usd: 0, cny: 0 },
          error: sidBalance.error,
        })
        return sidBalanceSubscribe(() => setState({
          visible: sidBalance.visible,
          apiKey: sidBalance.apiKey,
          balance: sidBalance.balance,
          alerts: sidBalance.alerts || { usd: 0, cny: 0 },
          error: sidBalance.error,
        }))
      }, [])
      React.useEffect(() => { if (!sidBalance.ready) sidBalanceLoad() }, [])
      const openDeepseek = () => {
        try {
          window.open('https://platform.deepseek.com/api_keys', '_blank', 'noopener')
        } catch (e) { /* ignore */ }
      }
      const alerts = state.alerts || { usd: 0, cny: 0 }
      return React.createElement('div', { className: 'sid-balance-page' },
        React.createElement('h3', { className: 'sid-balance-page-title' }, '余额监测'),
        React.createElement('p', { className: 'sid-balance-page-desc' },
          '配置 DeepSeek 官方 API Key 后，侧边栏将显示官网账户余额。余额仅保存在本地工作区，不对外发送。'),
        React.createElement('div', { className: 'sid-balance-row' },
          React.createElement('label', { className: 'sid-balance-label-text', htmlFor: 'sid-balance-key' }, 'API Key'),
          React.createElement('input', {
            id: 'sid-balance-key',
            className: 'sid-balance-input',
            type: 'password',
            placeholder: 'sk-…',
            value: state.apiKey,
            spellCheck: false,
            onChange: (e) => sidBalanceSave({ apiKey: e.target.value }),
          }),
        ),
        React.createElement('div', { className: 'sid-balance-row' },
          React.createElement('button', {
            type: 'button',
            className: 'sid-balance-login',
            onClick: openDeepseek,
          },
            React.createElement('span', { className: 'sid-balance-login-ic', dangerouslySetInnerHTML: { __html: ICON_EXTERNAL } }),
            React.createElement('span', null, '登录 DeepSeek 开放平台获取 API Key'),
          ),
        ),
        React.createElement('div', { className: 'sid-balance-row sid-balance-row-toggle' },
          React.createElement('label', { className: 'sid-balance-label-text', htmlFor: 'sid-balance-toggle' }, '显示余额'),
          React.createElement('button', {
            id: 'sid-balance-toggle',
            type: 'button',
            role: 'switch',
            'aria-checked': state.visible,
            className: 'sid-toggle' + (state.visible ? ' on' : ''),
            onClick: () => sidBalanceSave({ visible: !state.visible }),
          },
            React.createElement('span', { className: 'sid-toggle-track', 'aria-hidden': true },
              React.createElement('span', { className: 'sid-toggle-thumb', 'aria-hidden': true }),
            ),
          ),
        ),
        React.createElement('div', { className: 'sid-balance-alerts' },
          React.createElement('div', { className: 'sid-balance-alerts-title' }, '余额不足提醒'),
          React.createElement('p', { className: 'sid-balance-alerts-desc' },
            '设置 USD / CNY 最低额度（0 表示不提醒）。当余额小于等于该额度时，SIDOR控制台会向您发出警告。'),
          React.createElement('div', { className: 'sid-balance-row' },
            React.createElement('label', { className: 'sid-balance-label-text', htmlFor: 'sid-balance-alert-usd' }, 'USD 提醒'),
            React.createElement('input', {
              id: 'sid-balance-alert-usd',
              className: 'sid-balance-input sid-balance-input-num',
              type: 'number',
              min: '0',
              step: '1',
              placeholder: '0 = 不提醒',
              value: alerts.usd > 0 ? String(alerts.usd) : '',
              onChange: (e) => sidBalanceSave({ alertUsd: parseFloat(e.target.value) || 0 }),
            }),
          ),
          React.createElement('div', { className: 'sid-balance-row' },
            React.createElement('label', { className: 'sid-balance-label-text', htmlFor: 'sid-balance-alert-cny' }, 'CNY 提醒'),
            React.createElement('input', {
              id: 'sid-balance-alert-cny',
              className: 'sid-balance-input sid-balance-input-num',
              type: 'number',
              min: '0',
              step: '1',
              placeholder: '0 = 不提醒',
              value: alerts.cny > 0 ? String(alerts.cny) : '',
              onChange: (e) => sidBalanceSave({ alertCny: parseFloat(e.target.value) || 0 }),
            }),
          ),
        ),
        React.createElement('div', { className: 'sid-balance-row' },
          React.createElement('span', { className: 'sid-balance-label-text' }, '当前余额'),
          React.createElement('div', { className: 'sid-balance-current' },
            React.createElement(BalanceFormat, { balance: state.balance }),
            state.error ? React.createElement('span', { className: 'sid-balance-err' }, state.error) : null,
          ),
        ),
        React.createElement('div', { className: 'sid-balance-row' },
          React.createElement('button', {
            type: 'button',
            className: 'sid-balance-refresh',
            onClick: () => sidBalanceQuery(),
          },
            React.createElement('span', { className: 'sid-balance-refresh-ic', dangerouslySetInnerHTML: { __html: ICON_REFRESH } }),
            React.createElement('span', null, '立即检测余额'),
          ),
        ),
      )
    }

    /* ============ composer height drag handle ============ */
    function ComposerResizeHandle() {
      const dragRef = React.useRef(null)
      const stateRef = React.useRef(null)
      const MIN_H = 80
      const MAX_H = () => Math.max(MIN_H + 1, Math.min(560, Math.floor(window.innerHeight * 0.6)))

      const applyHeight = (px) => {
        const clamped = Math.min(MAX_H(), Math.max(MIN_H, px))
        document.documentElement.style.setProperty('--sid-cmp-h', Math.round(clamped) + 'px')
      }
      const clearHeight = () => {
        document.documentElement.style.removeProperty('--sid-cmp-h')
      }
      const currentHeight = () => {
        const el = document.querySelector('[data-input-scroll]')
        if (el instanceof HTMLElement && el.clientHeight > 0) return el.clientHeight
        const root = document.documentElement
        const current = root.style.getPropertyValue('--sid-cmp-h')
        return current && /px$/.test(current) ? parseFloat(current) : NaN
      }

      const onPointerDown = (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        const startH = Number.isFinite(currentHeight()) ? currentHeight() : MIN_H
        stateRef.current = { startY: e.clientY, startH }
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerUp)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
      }
      const onPointerMove = (e) => {
        const st = stateRef.current
        if (st === null) return
        // Pull UP to grow, push DOWN to shrink.
        const next = st.startH - (e.clientY - st.startY)
        applyHeight(next)
      }
      const onPointerUp = () => {
        stateRef.current = null
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
      }
      const onDoubleClick = () => {
        // Restore to the manual minimum (not the tiny auto height).
        applyHeight(MIN_H)
      }
      const onWheel = (e) => {
        e.preventDefault()
        const base = Number.isFinite(currentHeight()) ? currentHeight() : MIN_H
        const step = 24
        applyHeight(base + (e.deltaY < 0 ? step : -step))
      }

      React.useEffect(() => {
        const el = dragRef.current
        if (el !== null) {
          el.addEventListener('wheel', onWheel, { passive: false })
          return () => {
            el.removeEventListener('wheel', onWheel)
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('pointerup', onPointerUp)
            window.removeEventListener('pointercancel', onPointerUp)
          }
        }
        return () => {
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('pointercancel', onPointerUp)
        }
      }, [])

      return React.createElement('div', {
        ref: dragRef,
        className: 'sid-cmp-resize',
        title: '向上拖动/滚轮放大，向下缩小（双击回到最小值）',
        onPointerDown,
        onDoubleClick,
      },
        React.createElement('span', { className: 'sid-cmp-resize-grip', 'aria-hidden': true }),
      )
    }

    /* ============ file picker (documents, next to the permission select) ============ */
    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    function FilePickButton(props) {
      const inputRef = React.useRef(null)
      const [toast, setToast] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const toastSeq = React.useRef(0)
      const openPicker = () => {
        if (inputRef.current !== null) inputRef.current.click()
      }
      const show = (msg) => { setToast(msg); toastSeq.current += 1 }
      const base64FromFile = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || '')
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
      const onPick = async (e) => {
        const files = Array.from(e.target.files || [])
        e.target.value = ''
        if (files.length === 0 || busy) return
        const maxBytes = 8 * 1024 * 1024
        const oversized = files.find((file) => file.size > maxBytes)
        if (oversized) { show('文件超过 8MB 限制：' + (oversized.name || '')); return }
        setBusy(true)
        try {
          for (const file of files) {
            if (IMAGE_TYPES.includes(file.type)) {
              if (conversation === undefined || props.inputActions === undefined) { show('附件服务不可用'); continue }
              try {
                const images = conversation.createDraftImages([file])
                if (!props.inputActions.addImages(images.map((image) => image.id))) {
                  conversation.releaseDraftImages(images)
                }
              } catch (err) {
                show(err && typeof err.message === 'string' ? err.message : String(err))
              }
            } else {
              const dataBase64 = await base64FromFile(file)
              const result = await host.call('sidor/upload-doc', {
                sessionId: props.sessionId,
                name: file.name || 'file',
                dataBase64,
              })
              if (!result || !result.ok) {
                show(result && result.error ? String(result.error) : '上传失败')
                continue
              }
              const rel = String(result.path || '')
              const cur = (props.input && props.input.draft) || ''
              const next = cur.trim() === '' ? rel : cur + '\n' + rel
              props.inputActions.setDraft(next)
              show('已附加文档：' + rel)
            }
          }
        } finally {
          setBusy(false)
        }
      }
      React.useEffect(() => {
        if (toast === null) return
        const d = ctx.timeout(() => { setToast(null) }, 2600)
        return () => d()
      }, [toast])
      return React.createElement('div', { className: 'sid-filepick' },
        React.createElement('button', {
          type: 'button',
          className: 'sid-filepick-btn',
          title: '选择文档',
          'aria-label': '选择文档',
          disabled: props.inputActions === undefined || busy,
          onMouseDown: (e) => e.preventDefault(),
          onClick: openPicker,
        },
          React.createElement('span', { className: 'sid-filepick-ic', dangerouslySetInnerHTML: { __html: ICON_FILE } }),
          React.createElement('span', { className: 'sid-filepick-label' }, busy ? '上传中…' : '文档'),
          React.createElement('span', { className: 'sid-filepick-chevron', dangerouslySetInnerHTML: { __html: ICON_CHEVRON } }),
        ),
        React.createElement('input', {
          ref: inputRef,
          type: 'file',
          multiple: true,
          style: { display: 'none' },
          onChange: onPick,
        }),
        toast !== null ? React.createElement('div', { className: 'sid-filepick-toast', role: 'status' }, toast) : null,
      )
    }

    /* ============ styles ============ */
    styles.insert(`
.sid-fx { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 100000; }
.sid-fx * { box-sizing: border-box; }

.sid-intro {
  position: absolute; inset: 0; overflow: hidden;
  background: var(--dsw-alias-bg-base, #0d0e12);
  pointer-events: auto; cursor: default;
}
.sid-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
.sid-canvas-bg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.sid-marks { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
.sid-mark-ghost { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; }
.sid-ghost-click { display: inline-flex; }
.sid-ghost-click.on { animation: sid-click-pop 0.32s cubic-bezier(0.22, 0.61, 0.36, 1); }
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
  color: var(--dsw-alias-label-primary, #888); display: inline-flex;
  animation: sid-twinkle 3s ease-in-out infinite;
}
@keyframes sid-twinkle { 0%, 100% { opacity: 0.16; } 50% { opacity: 0.8; } }

.sid-starfield { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

/* ---- hero breathing glow: whale + headline, synced to the starfield drift ---- */
[data-phase="hero"] svg[class*="fish"],
[data-phase="hero"] [class*="fish"],
[data-phase="hero"] [class*="headlineText"],
.sid-hero-brand-mark,
.sid-hero-brand-word {
  animation: sid-hero-breathe 9.2s ease-in-out infinite;
  transform-origin: 50% 60%;
}
@keyframes sid-hero-breathe {
  0%, 100% {
    opacity: 0.9;
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent));
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 16px color-mix(in srgb, var(--dsw-alias-brand-primary) 58%, transparent));
  }
}

/* ---- hero entrance: rise in once the intro finishes, synced to the starfield ---- */
.sid-hero-enter [data-phase="hero"] [class*="headline"] {
  animation: sid-hero-rise 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.sid-hero-enter [data-phase="hero"] [data-composer-card] {
  animation: sid-hero-rise 0.9s 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.sid-hero-enter [data-phase="hero"] [class*="heroWorkspaceRow"] {
  animation: sid-hero-rise 0.9s 0.14s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.sid-hero-enter .sid-hero-brand {
  animation: sid-hero-rise 0.9s 0.07s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
@keyframes sid-hero-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

/* ---- hero SIDOR brand mark (star + SIDOR丨HARNESS, width-matches the main title) ---- */
.sid-hero-brand {
  position: fixed;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  z-index: 1;
  color: var(--dsw-alias-label-primary);
}
.sid-hero-brand-mark {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-label-secondary);
  pointer-events: auto;
  cursor: default;
  transform-origin: 50% 60%;
}
/* hover shake, mirroring the official whale's swim */
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .sid-hero-brand-mark:hover {
    animation: sid-hero-breathe 9.2s ease-in-out infinite, sid-brand-shake 0.6s ease-in-out;
  }
}
@keyframes sid-brand-shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  35% { transform: translate(-1px, -1px) rotate(-5deg); }
  70% { transform: translate(1px, 1px) rotate(3deg); }
}
.sid-hero-brand-word {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
}
.sid-hero-brand-sidor {
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.3em;
  margin-right: -0.3em;
  color: var(--dsw-alias-label-secondary);
}
.sid-hero-brand-harness {
  font-family: Georgia, 'Times New Roman', serif;
  font-style: normal;
  font-weight: 400;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.78;
}

/* ---- hero controls (workspace picker + composer) pushed down as ONE block,
       keeping their official relative order/spacing, clear of the brand mark ---- */
[data-phase="hero"] [class*="heroWorkspaceRow"] {
  margin-top: 56px;
}

/* ---- draggable composer height (fixes the official text scroll height) ---- */
[data-input-scroll] {
  height: var(--sid-cmp-h, auto) !important;
  max-height: var(--sid-cmp-h, var(--dsh-composer-text-max-height, 336px)) !important;
}

/* ---- composer height resize handle ---- */
.sid-cmp-resize {
  display: flex; align-items: center; justify-content: center;
  height: 16px; cursor: ns-resize; user-select: none; touch-action: none;
  margin-top: -2px;
}
.sid-cmp-resize-grip {
  width: 48px; height: 4px; border-radius: 999px;
  background: var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.35));
  transition: background 0.15s ease, width 0.15s ease;
}
.sid-cmp-resize:hover .sid-cmp-resize-grip,
.sid-cmp-resize:active .sid-cmp-resize-grip {
  background: var(--dsw-alias-label-secondary, #888);
  width: 64px;
}

/* ---- file picker, styled to match the permission select trigger ---- */
.sid-filepick { display: inline-flex; position: relative; }
.sid-filepick-btn {
  min-width: 0; height: 28px; color: var(--dsw-alias-label-secondary);
  cursor: pointer; background: transparent; border: none; border-radius: 24px;
  outline: none; align-items: center; gap: 4px; padding: 0 6px 0 8px;
  font-size: 13px; font-weight: 500; line-height: 20px; display: inline-flex;
}
.sid-filepick-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.sid-filepick-btn:focus-visible { box-shadow: 0 0 0 2px var(--dsw-alias-border-l3); }
.sid-filepick-btn:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.sid-filepick-ic { flex: none; display: inline-flex; }
.sid-filepick-ic svg { width: 14px; height: 14px; }
.sid-filepick-label { text-overflow: ellipsis; white-space: nowrap; min-width: 0; overflow: hidden; }
.sid-filepick-chevron { color: var(--dsw-alias-label-caption); flex: none; display: inline-flex; transition: transform 0.12s; }
.sid-filepick-toast {
  position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%);
  z-index: 6; padding: 8px 16px; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px; background: var(--dsw-alias-bg-overlay);
  font-size: 12px; letter-spacing: 0.02em; color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  animation: sid-toast-in 0.24s cubic-bezier(0.22, 0.61, 0.36, 1);
  pointer-events: none; white-space: nowrap;
}
@keyframes sid-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ---- settings panel: starfield background + soft border light ---- */
.sid-settings-star {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
  z-index: 0 !important;
  border-radius: inherit;
}
.sid-settings-glow {
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 3 !important;
  border-radius: inherit;
  padding: 1.5px;
  background:
    conic-gradient(
      from var(--sid-glow-angle, 0deg),
      transparent 0deg,
      transparent 240deg,
      color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent) 285deg,
      color-mix(in srgb, var(--dsw-alias-brand-primary) 52%, transparent) 330deg,
      color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent) 375deg,
      transparent 420deg,
      transparent 360deg
    );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
          mask-composite: exclude;
  animation: sid-glow-flow 7s linear infinite;
}
@property --sid-glow-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
@keyframes sid-glow-flow {
  to { --sid-glow-angle: 360deg; }
}

/* ---- session log button: flowing light border, same technique as the
       settings panel glow. White normally; turns red on low balance. ---- */
.sid-sessionlog-glow {
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit;
  padding: 1.5px;
  --sid-glow-color: var(--dsw-alias-label-primary, #eeeeee);
  background:
    conic-gradient(
      from var(--sid-glow-angle, 0deg),
      transparent 0deg,
      transparent 240deg,
      color-mix(in srgb, var(--sid-glow-color) 16%, transparent) 285deg,
      color-mix(in srgb, var(--sid-glow-color) 55%, transparent) 330deg,
      color-mix(in srgb, var(--sid-glow-color) 16%, transparent) 375deg,
      transparent 420deg,
      transparent 360deg
    );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
          mask-composite: exclude;
  animation: sid-glow-flow 7s linear infinite;
  pointer-events: none !important;
  z-index: 2;
}
.sid-sessionlog-glow.low {
  --sid-glow-color: var(--dsw-alias-state-error-primary, #e5534b);
}

/* ---- balance widget: sidebar footer action (official cordis badge spec) ---- */
.sid-balance-badge {
  box-sizing: border-box;
  width: calc(100% + 4px);
  height: 42px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 12px;
  align-items: center;
  gap: 8px;
  margin: 0 -2px;
  padding: 0 10px 0 8px;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  overflow: hidden;
}
.sid-balance-badge:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.sid-balance-badge.rail {
  border-radius: 50%;
  justify-content: center;
  gap: 0;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
}
.sid-balance-badge-ic {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-label-primary);
}
.sid-balance-badge-ic svg { width: 16px; height: 16px; }
.sid-balance-badge.rail .sid-balance-badge-ic svg { width: 18px; height: 18px; }
.sid-balance-badge-label {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  color: var(--dsw-alias-label-primary);
}
.sid-balance-amt { display: inline-flex; align-items: baseline; gap: 4px; }
.sid-balance-usd { color: var(--dsw-alias-label-secondary); }
.sid-balance-sep { color: var(--dsw-alias-label-caption); }
.sid-balance-cny { color: var(--dsw-alias-label-primary); }

/* ---- low-balance alert: divider flow + wallet breathing glow ---- */
/* Soft RED light flowing steadily top→bottom along BOTH edges of the
   sidebar column (left = window edge, right = workspace divider), wide and
   rail alike. A self-contained light blob (::after) travels with a plain
   transform animation: the loop point is off-screen, so there is never a
   visible jump or fade — smooth, constant, cursor-independent. */
.sid-divider-flow {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  pointer-events: none;
  z-index: 5;
  border-radius: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 14%, transparent);
  opacity: 0.9;
}
.sid-divider-flow::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 34%;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 92%, transparent) 50%,
    transparent 100%
  );
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 70%, transparent));
  animation: sid-divider-flow 5s linear infinite;
}
.sid-divider-flow.left { left: 0; }
.sid-divider-flow.right { right: 0; }
@keyframes sid-divider-flow {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(400%); }
}
/* wallet icon breathing red glow on low balance, breathing rhythm matching
   the starfield's 9.2s drift cadence */
.sid-balance-badge.low .sid-balance-badge-ic {
  color: var(--dsw-alias-state-error-primary, #e5534b);
  animation: sid-balance-low-breathe 9.2s ease-in-out infinite;
}
@keyframes sid-balance-low-breathe {
  0%, 100% {
    filter: drop-shadow(0 0 2px color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 30%, transparent));
  }
  50% {
    filter: drop-shadow(0 0 12px color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 85%, transparent));
  }
}
.sid-balance-badge.rail.low .sid-balance-badge-ic svg {
  width: 18px;
  height: 18px;
}

/* settings nav: our section's official gear replaced by the wallet icon */
.sid-nav-wallet {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-label-secondary);
}
.sid-nav-wallet svg { width: 16px; height: 16px; }

/* ---- footer: stack balance / cordis vertically; settings keeps its
       official native seat at the foot (footerActions column above the
       official settingsArea row). ---- */
/* The official settingsArea carries 'justify-content:center; width:auto' —
   leave it intact so the settings trigger renders in its native position. */
[class*="footArea"] [class*="footerActions"] {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  width: 100%;
  display: flex;
}
/* each action row: full width, left-aligned content, no stray margins.
   The rail (.sid-balance-badge.rail) keeps its own 36px round sizing below. */
[class*="footArea"] .sid-balance-badge:not(.rail),
[class*="footArea"] [class*="footerActions"] > [class*="layer"] {
  width: 100% !important;
  margin: 0 !important;
  justify-content: flex-start !important;
  gap: 8px !important;
}
[class*="footArea"] [class*="footerActions"] > [class*="layer"] > [class*="footerButtons"] {
  width: 100%;
  justify-content: flex-start;
}
/* settings trigger keeps its official seat/geometry; just guarantee the
   icon + label stay tightly packed (native gap is 8px). */
[class*="footArea"] [class*="settingsArea"] [class*="trigger"] {
  gap: 8px;
}
/* rail (collapsed): balance + cordis round icons even-spaced and centered;
   the official settingsArea already centers its own 36px round trigger. */
[class*="collapsed"] [class*="footerActions"] {
  justify-content: center;
  align-items: center;
}
[class*="collapsed"] [class*="footerActions"] [class*="layer"],
[class*="footArea"] .sid-balance-badge.rail {
  justify-content: center !important;
  width: 36px !important;
  margin: 0 auto !important;
}
[class*="collapsed"] [class*="footerActions"] > [class*="layer"] > [class*="footerButtons"] {
  justify-content: center;
  align-items: center;
}

/* ---- balance widget: settings page ---- */
.sid-balance-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 560px;
}
.sid-balance-page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.sid-balance-page-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--dsw-alias-label-secondary);
}
.sid-balance-alerts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 2px;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-l1, transparent);
}
.sid-balance-alerts-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.sid-balance-alerts-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}
.sid-balance-input-num {
  flex: 0 1 160px;
}
.sid-balance-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}
.sid-balance-label-text {
  flex: none;
  width: 96px;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}
.sid-balance-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-input-bg, var(--dsw-alias-bg-base));
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  outline: none;
}
.sid-balance-input:focus {
  border-color: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 25%, transparent);
}
.sid-balance-current {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.sid-balance-err {
  color: var(--dsw-alias-danger, #e5534b);
  font-size: 12px;
}
.sid-balance-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  cursor: pointer;
}
.sid-balance-refresh:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.sid-balance-refresh-ic { display: inline-flex; }
.sid-balance-refresh-ic svg { width: 14px; height: 14px; }
.sid-balance-login {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
  color: var(--dsw-alias-brand-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.sid-balance-login:hover {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent);
}
.sid-balance-login-ic { display: inline-flex; }
.sid-balance-login-ic svg { width: 14px; height: 14px; }

/* ---- Toggle switch (horizontal slide), official-style ---- */
.sid-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}
.sid-toggle-track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.4));
  transition: background 0.16s ease;
}
.sid-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform 0.16s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.sid-toggle.on .sid-toggle-track {
  background: var(--dsw-alias-brand-primary);
}
.sid-toggle.on .sid-toggle-thumb {
  transform: translateX(14px);
}
.sid-toggle:focus-visible .sid-toggle-track {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent);
}
`)

    /* ============ slot registrations ============ */
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'sidor-fx', order: 100, label: 'SIDOR' },
      () => React.createElement(SidorFx),
    ))
    slots.inject('conversation.input.left', () => slots.register(
      { name: 'conversation.input.left', id: 'sidor-filepick', order: 10, label: '文档' },
      (props) => React.createElement(FilePickButton, {
        inputActions: props.inputActions,
        sessionId: props.sessionId,
        input: props.input,
      }),
    ))
    slots.inject('conversation.composer.dock', () => slots.register(
      { name: 'conversation.composer.dock', id: 'sidor-cmp-resize', order: 100, label: '输入框拉伸' },
      () => React.createElement(ComposerResizeHandle),
    ))
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'sidor-balance', order: -10, label: '余额' },
      (props) => React.createElement(BalanceFooterAction, { wide: props.wide }),
    ))
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'sidor-balance', order: 25, label: '余额' },
      () => React.createElement(BalanceSettingsPage),
    ))
  },
}
