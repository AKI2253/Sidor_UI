return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const sessionsSvc = ctx.get('sessions')
    const workspacesSvc = ctx.get('workspaces')
    const conversation = ctx.get('conversation')

    /* ============ package-scoped open state ============ */
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

    /* ============ toast ============ */
    let toastMsg = null
    const toastSubs = new Set()
    const timers = new Set()
    ctx.effect(() => () => { for (const d of timers) d(); timers.clear() })
    function toast(msg) {
      toastMsg = msg
      for (const l of Array.from(toastSubs)) l()
      const d = ctx.timeout(() => { timers.delete(d); toastMsg = null; for (const l of Array.from(toastSubs)) l() }, 2600)
      timers.add(d)
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

    /* ============ i18n (zh/en) ============ */
    const zh = typeof navigator !== 'undefined' && /^zh/i.test(String(navigator.language || ''))
    const T = {
      caption: 'DeepSeek harness',
      greeting: zh ? '欢迎回来，领航员。' : 'Welcome back.',
      sub: zh ? '选择工作区与会话开始工作，或新建一个会话。' : 'Pick a workspace and session, or start a new one.',
      close: zh ? '关闭' : 'Close',
      collapse: zh ? '收起侧边栏' : 'Collapse sidebar',
      expand: zh ? '展开侧边栏' : 'Expand sidebar',
      newSession: zh ? '新会话' : 'New Session',
      search: zh ? '搜索会话…' : 'Search sessions…',
      wsNone: zh ? '暂无工作区' : 'No workspaces yet',
      ssNone: zh ? '暂无会话' : 'No sessions yet',
      loading: zh ? '加载中…' : 'Loading…',
      coming: zh ? '该模块将在后续迭代中实现' : 'Module arrives in a later iteration',
      composer: zh ? '给控制中心输入指令…' : 'Send a command to the control center…',
      core: zh ? '核心链路' : 'CORE LINK',
      online: zh ? '在线' : 'ONLINE',
      offline: zh ? '离线' : 'OFFLINE',
      send: zh ? '发送' : 'Send',
      stop: zh ? '停止' : 'Stop',
      attach: zh ? '添加图片' : 'Add images',
      model: zh ? '模型' : 'Model',
      noModel: zh ? '未选择模型' : 'No model',
      loadingModel: zh ? '加载模型…' : 'Loading models…',
      noTarget: zh ? '请先选择或新建会话' : 'Pick or create a session first',
      sent: zh ? '已发送' : 'Sent',
      sending: zh ? '发送中…' : 'Sending…',
      stopped: zh ? '已停止' : 'Stopped',
      steer: zh ? '立即执行' : 'Run now',
      queue: zh ? '排队' : 'queued',
      running: zh ? '运行中' : 'RUNNING',
      idle: zh ? '空闲' : 'IDLE',
      removed: zh ? '会话已移除' : 'Session removed',
      dragHint: zh ? '拖拽图片到此处' : 'Drop images here',
      nav: [
        { id: 'git', label: 'Git', icon: 'git' },
        { id: 'skill', label: 'Skill', icon: 'skill' },
        { id: 'market', label: zh ? '市场' : 'Market', icon: 'market' },
        { id: 'details', label: zh ? '详情' : 'Details', icon: 'details' },
        { id: 'settings', label: zh ? '设置' : 'Settings', icon: 'settings' },
      ],
    }

    /* ============ typography — the custom-font injection point ============ */
    const FONT_LATIN = "'Georgia', 'Times New Roman', 'Noto Serif SC', serif"
    const FONT_CJK = "'Noto Serif SC', 'Songti SC', 'SimSun', 'Microsoft YaHei', serif"

    /* ============ icon set ============ */
    const STAR_14 = 'M7 0.8 8.6 5.4 13.2 7 8.6 8.6 7 13.2 5.4 8.6 0.8 7 5.4 5.4 Z'
    const STAR_96 = 'M48 5.5 59 37 90.5 48 59 59 48 90.5 37 59 5.5 48 37 37 Z'
    const STAR_12 = 'M6 0.7 7.4 4.6 11.3 6 7.4 7.4 6 11.3 4.6 7.4 0.7 6 4.6 4.6 Z'
    const PANEL_LEFT_D = 'M9.67272 0.522841C10.8339 0.522841 11.76 0.522714 12.4963 0.602493C13.2453 0.683657 13.8789 0.854248 14.4264 1.25197C14.7504 1.48739 15.0355 1.77247 15.2709 2.0965C15.6686 2.64394 15.8392 3.27758 15.9204 4.02655C16.0002 4.7629 16 5.68895 16 6.85014V9.14986C16 10.3111 16.0002 11.2371 15.9204 11.9735C15.8392 12.7224 15.6686 13.3561 15.2709 13.9035C15.0355 14.2275 14.7504 14.5126 14.4264 14.748C13.8789 15.1458 13.2453 15.3163 12.4963 15.3975C11.76 15.4773 10.8339 15.4772 9.67272 15.4772H6.3273C5.16611 15.4772 4.24006 15.4773 3.50371 15.3975C2.75474 15.3163 2.1211 15.1458 1.57366 14.748C1.24963 14.5126 0.964549 14.2275 0.729131 13.9035C0.331407 13.3561 0.160817 12.7224 0.0796529 11.9735C-0.000126137 11.2371 1.25338e-09 10.3111 1.25338e-09 9.14986V6.85014C1.25329e-09 5.68895 -0.000126137 4.7629 0.0796529 4.02655C0.160817 3.27758 0.331407 2.64394 0.729131 2.0965C0.964549 1.77247 1.24963 1.48739 1.57366 1.25197C2.1211 0.854248 2.75474 0.683657 3.50371 0.602493C4.24006 0.522714 5.16611 0.522841 6.3273 0.522841H9.67272ZM5.54303 1.88715V14.1118C5.78636 14.1128 6.04709 14.1169 6.3273 14.1169H9.67272C10.8639 14.1169 11.7032 14.1164 12.3493 14.0465C12.9824 13.9779 13.3497 13.8494 13.6268 13.6482C13.8354 13.4966 14.0195 13.3125 14.1711 13.1039C14.3723 12.8268 14.5007 12.4595 14.5693 11.8264C14.6393 11.1803 14.6398 10.341 14.6398 9.14986V6.85014C14.6398 5.65896 14.6393 4.81967 14.5693 4.1736C14.5007 3.54048 14.3723 3.17318 14.1711 2.89609C14.0195 2.68747 13.8354 2.50337 13.6268 2.35179C13.3497 2.1506 12.9824 2.02212 12.3493 1.95353C11.7032 1.88358 10.8639 1.88307 9.67272 1.88307H6.3273C6.04709 1.88307 5.78636 1.8862 5.54303 1.88715ZM4.1828 1.91166C3.99125 1.9216 3.8148 1.93577 3.65076 1.95353C3.01764 2.02212 2.65034 2.1506 2.37325 2.35179C2.16463 2.50337 1.98052 2.68747 1.82895 2.89609C1.62776 3.17318 1.49928 3.54048 1.43069 4.1736C1.36074 4.81967 1.36023 5.65896 1.36023 6.85014V9.14986C1.36023 10.341 1.36074 11.1803 1.43069 11.8264C1.49928 12.4595 1.62776 12.8268 1.82895 13.1039C1.98052 13.3125 2.16463 13.4966 2.37325 13.6482C2.65034 13.8494 3.01764 13.9779 3.65076 14.0465C3.81478 14.0642 3.99127 14.0774 4.1828 14.0873V1.91166Z'
    const NEWCHAT_D = 'M8.00003 0.3237C3.76075 0.3237 0.32373 3.76072 0.32373 8C0.32373 9.17603 0.589121 10.2922 1.0632 11.2901L1.35291 11.8989L2.5705 11.3205L2.28079 10.7117C1.89079 9.89074 1.67301 8.97167 1.67301 8C1.67301 4.50546 4.50549 1.67298 8.00003 1.67298C11.4946 1.67298 14.3271 4.50546 14.3271 8C14.3271 11.4945 11.4946 14.327 8.00003 14.327C7.28473 14.327 6.76077 14.277 6.29621 14.1487C5.83857 14.0224 5.40441 13.8109 4.88514 13.4488C4.12569 12.919 3.03778 12.7316 2.141 13.2978L2.12682 13.307L2.11264 13.3171L1.34886 13.854L1.79659 15.188L2.86122 14.4384C3.19068 14.2305 3.68325 14.2542 4.11326 14.5539C4.72789 14.9826 5.30042 15.2724 5.93762 15.4484C6.56803 15.6224 7.22776 15.6763 8.00003 15.6763C12.2393 15.6763 15.6763 12.2393 15.6763 8C15.6763 3.76072 12.2393 0.3237 8.00003 0.3237ZM7.32033 4.82535V7.32536H4.82538V8.67464H7.32033V11.1747H8.6696V8.67464H11.1747V7.32536H8.6696V4.82535H7.32033Z'
    const WHALE_D = 'M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z'
    const svg = (inner, size) =>
      '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 14 14" fill="none" aria-hidden="true">' + inner + '</svg>'
    const IC = {
      mark: svg('<path d="' + STAR_14 + '" fill="currentColor"/>'),
      markBig: '<svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true"><path d="' + STAR_96 + '" fill="currentColor"/></svg>',
      markGhost: '<svg width="460" height="460" viewBox="0 0 96 96" fill="none" aria-hidden="true"><defs><filter id="sid-ghost-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.8"/></filter></defs><path d="' + STAR_96 + '" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" filter="url(#sid-ghost-glow)" opacity="0.55"/><path d="' + STAR_96 + '" fill="currentColor" opacity="0.07"/><path d="' + STAR_96 + '" stroke="currentColor" stroke-width="0.9" stroke-linejoin="round" opacity="0.65"/></svg>',
      panelLeft: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="' + PANEL_LEFT_D + '" fill="currentColor"/></svg>',
      newChat: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="' + NEWCHAT_D + '" fill="currentColor"/></svg>',
      whale: '<svg width="15" height="11" viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="' + WHALE_D + '" fill="currentColor"/></svg>',
      whaleBig: '<svg width="40" height="29" viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="' + WHALE_D + '" fill="currentColor"/></svg>',
      close: svg('<path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'),
      git: svg('<path d="M7 1.8v10.4M7 1.8 3.6 5.2M7 1.8l3.4 3.4M7 6.2 4.6 8.6M7 6.2l2.4 2.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'),
      skill: svg('<path d="M2.6 4.8 7 2.4l4.4 2.4L7 7.2Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M2.6 7.4 7 5l4.4 2.4L7 9.8Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M2.6 10 7 7.6l4.4 2.4L7 12.4Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>'),
      market: svg('<path d="M3 5.2h8l-.8 6.4a.9.9 0 0 1-.9.8H4.7a.9.9 0 0 1-.9-.8Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M5.2 5.2V4a1.8 1.8 0 0 1 3.6 0v1.2" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>'),
      details: svg('<path d="M3.4 2.4h7.2a.8.8 0 0 1 .8.8v7.6a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8-.8V3.2a.8.8 0 0 1 .8-.8Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M5 5.4h4M5 7.4h4M5 9.4h2.4" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>'),
      settings: svg('<path d="M2.4 4.4h9.2M2.4 7.4h9.2M2.4 10.4h9.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><circle cx="5" cy="4.4" r="1.3" fill="currentColor"/><circle cx="9" cy="7.4" r="1.3" fill="currentColor"/><circle cx="6.2" cy="10.4" r="1.3" fill="currentColor"/>'),
      send: svg('<path d="M2.2 7 12 2.6 8.6 12 6.9 8.1Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M12 2.6 6.9 8.1" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>'),
      stop: svg('<rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.4" fill="currentColor"/>'),
      attach: svg('<path d="M8 2.2v9.6M3.2 7h9.6" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>'),
      caret: svg('<path d="M3.2 5.2 7 9l3.8-3.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'),
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
        setOpen(!isOpen)
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

    /* ambient dust field: visible starfield, slightly bigger grains */
    function ParticleField() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const engine = createParticleEngine(canvas, { count: 2600 })
        engine.setInkVar('--dsw-alias-label-primary')
        engine.setSize(2.2)
        engine.setAmbientAlpha(0.35)
        engine.setDriftScale(1.1)
        engine.setDisturb(150, 2.0)
        engine.scatter()
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
      return React.createElement('canvas', { ref: ref, className: 'sid-main-canvas', 'aria-hidden': true })
    }

    /* ============ composer ============ */
    function useSessionFace(sessionId) {
      const [face, setFace] = React.useState(null)
      React.useEffect(() => {
        let f = null
        if (sessionId && sessionsSvc) {
          try { const b = sessionsSvc.binding(sessionId); if (b && b.session) f = b.session } catch (e) { /* ignore */ }
        }
        setFace(f || null)
      }, [sessionId])
      return face
    }

    function useSessionSnap(face) {
      const [snap, setSnap] = React.useState(null)
      React.useEffect(() => {
        if (!face) { setSnap(null); return }
        let alive = true
        const sync = () => { if (alive) { try { setSnap(face.getSnapshot()) } catch (e) { /* ignore */ } } }
        sync()
        let off = null
        try { off = face.subscribe(sync) } catch (e) { /* ignore */ }
        return () => { alive = false; if (off) { try { off() } catch (e) { /* ignore */ } } }
      }, [face])
      return snap
    }

    function Composer(props) {
      const { sessionId, sessionTitle, onToast } = props
      const face = useSessionFace(sessionId)
      const snap = useSessionSnap(face)
      const [draft, setDraft] = React.useState('')
      const [images, setImages] = React.useState([])
      const imagesRef = React.useRef([])
      React.useEffect(() => { imagesRef.current = images }, [images])
      const [sending, setSending] = React.useState(false)
      const [modelOpen, setModelOpen] = React.useState(false)
      const [models, setModels] = React.useState(null)
      const [modelsLoading, setModelsLoading] = React.useState(false)
      const [dragOver, setDragOver] = React.useState(false)
      const taRef = React.useRef(null)
      const fileRef = React.useRef(null)
      const composingRef = React.useRef(false)
      const modelLoadSeq = React.useRef(0)

      const running = !!(snap && snap.running)
      const removed = !!(snap && snap.removed)
      const queued = snap && snap.queue ? snap.queue.filter((q) => q.placement === 'queued') : []
      const empty = draft.trim() === '' && images.length === 0
      const disabled = !face || removed || sending

      /* load models for the target session */
      React.useEffect(() => {
        setModels(null)
        setModelOpen(false)
        if (!sessionId) return
        const seq = ++modelLoadSeq.current
        setModelsLoading(true)
        host.call('sidor/models', { sessionId: sessionId }).then((r) => {
          if (seq !== modelLoadSeq.current) return
          setModelsLoading(false)
          if (r && r.ok && r.data) setModels(r.data)
        }).catch(() => {
          if (seq === modelLoadSeq.current) setModelsLoading(false)
        })
      }, [sessionId])

      /* surfacing promptError */
      React.useEffect(() => {
        if (!snap || !snap.promptError) return
        const pe = snap.promptError
        const code = pe.error && pe.error.code ? pe.error.code : 'error'
        onToast((pe.op === 'stop' ? T.stop + ' ' : T.send + ' ') + ': ' + (pe.error && pe.error.message ? pe.error.message : code))
      }, [snap && snap.promptError])

      /* release draft image previews on unmount */
      React.useEffect(() => () => {
        if (!conversation || imagesRef.current.length === 0) return
        try { conversation.releaseDraftImages(imagesRef.current) } catch (e) { /* ignore */ }
      }, [])

      const grow = () => {
        const el = taRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(120, el.scrollHeight) + 'px'
      }

      const clearDraft = () => {
        setDraft('')
        requestAnimationFrame(() => { const el = taRef.current; if (el) { el.value = ''; el.style.height = 'auto'; el.style.height = '22px' } })
      }

      const intakeFiles = (files) => {
        if (!conversation || !files || files.length === 0) return
        const list = Array.from(files).filter((f) => /^image\/(png|jpe?g|webp|gif)$/i.test(f.type || ''))
        if (list.length === 0) { onToast(T.attach + ': ' + (zh ? '仅支持 PNG/JPEG/WebP/GIF' : 'PNG/JPEG/WebP/GIF only')); return }
        try {
          const atts = conversation.createDraftImages(list)
          setImages((prev) => prev.concat(atts))
        } catch (e) { onToast(String(e && e.message || e)) }
      }

      const removeImage = (id) => {
        setImages((prev) => prev.filter((a) => a.id !== id))
        if (conversation) { try { conversation.releaseDraftImage(id) } catch (e) { /* ignore */ } }
      }

      const doSend = (mode) => {
        if (disabled || empty) return
        const text = draft.trim()
        setSending(true)
        const p = (conversation && images.length > 0)
          ? conversation.sendSession(face, text, images.map((a) => a.id), mode || 'queue')
          : face.prompt(text === '' ? [] : [{ type: 'text', text: text }], mode || 'queue')
        p.then((r) => {
          if (r && r.ok === false) {
            const code = r.error && r.error.code ? r.error.code : 'error'
            onToast((zh ? '发送失败' : 'Send failed') + ': ' + (r.error && r.error.message ? r.error.message : code))
            return
          }
          setImages((prev) => { if (conversation) { try { conversation.releaseDraftImages(prev) } catch (e) { /* ignore */ } } return [] })
          clearDraft()
          onToast(T.sent + (sessionTitle ? ' → ' + sessionTitle : ''))
        }).catch((err) => {
          onToast((zh ? '发送失败' : 'Send failed') + ': ' + String(err && err.message || err))
        }).finally(() => setSending(false))
      }

      const doStop = () => {
        if (!face) return
        try {
          const p = face.cancel()
          if (p && typeof p.then === 'function') p.catch(() => {})
        } catch (e) { /* ignore */ }
        onToast(T.stopped)
      }

      const pickModel = (provider, model, reasoningEffort) => {
        if (!sessionId) return
        host.call('sidor/selectModel', { sessionId: sessionId, provider: provider, model: model, reasoningEffort: reasoningEffort }).then((r) => {
          if (r && r.ok) {
            setModels((m) => m ? Object.assign({}, m, { current: r.data && r.data.selected ? r.data.selected : m.current }) : m)
            setModelOpen(false)
            onToast(zh ? '模型已切换' : 'Model switched')
          } else {
            onToast((zh ? '切换失败' : 'Switch failed') + (r && r.error && r.error.message ? ': ' + r.error.message : ''))
          }
        }).catch((e) => onToast(String(e && e.message || e)))
      }

      const onKeyDown = (e) => {
        if (e.key !== 'Enter') return
        if (e.shiftKey) return
        if (composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
        e.preventDefault()
        if (e.repeat) return
        if (disabled) { if (!face) onToast(T.noTarget); return }
        const accelerated = e.ctrlKey || e.metaKey
        doSend(accelerated ? 'steer' : 'queue')
      }
      const onCompositionStart = () => { composingRef.current = true }
      const onCompositionEnd = () => {
        ctx.timeout(() => { composingRef.current = false }, 30)
      }

      const currentModel = models && models.current
      const currentLabel = currentModel ? currentModel.model : null
      const groups = models && models.groups ? models.groups : []
      const failures = models && models.failures ? models.failures : []

      const sendBtn = running
        ? React.createElement('button', {
            type: 'button',
            className: 'sid-cmp-send stop',
            title: T.stop,
            'aria-label': T.stop,
            disabled: !face || sending,
            onClick: doStop,
          }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.stop } }))
        : React.createElement('button', {
            type: 'button',
            className: 'sid-cmp-send' + (empty || disabled ? ' off' : ''),
            title: T.send,
            'aria-label': T.send,
            disabled: empty || disabled,
            onClick: () => doSend('queue'),
          }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.send } }))

      const modelBtn = React.createElement('button', {
        type: 'button',
        className: 'sid-cmp-model' + (modelOpen ? ' on' : ''),
        title: T.model,
        'aria-label': T.model,
        disabled: !sessionId,
        onClick: () => setModelOpen(!modelOpen),
      },
        React.createElement('span', { className: 'sid-cmp-model-label' }, modelsLoading ? T.loadingModel : (currentLabel || T.noModel)),
        React.createElement('span', { className: 'sid-cmp-model-caret', dangerouslySetInnerHTML: { __html: IC.caret } }),
      )

      const modelPanel = modelOpen
        ? React.createElement('div', { className: 'sid-cmp-model-panel' },
            groups.length === 0 && !modelsLoading ? React.createElement('div', { className: 'sid-cmp-model-empty' }, T.noModel)
              : groups.map((g) => React.createElement('div', { key: g.id, className: 'sid-cmp-model-group' },
                  React.createElement('div', { className: 'sid-cmp-model-group-name' }, g.name),
                  g.models.map((m) => {
                    const on = currentModel && currentModel.provider === g.id && currentModel.model === m.id
                    return React.createElement('button', {
                      key: m.id,
                      type: 'button',
                      className: 'sid-cmp-model-opt' + (on ? ' on' : ''),
                      onClick: () => pickModel(g.id, m.id, m.reasoning && m.reasoning.defaultEffort),
                    }, m.name)
                  }),
                )),
            failures.length > 0 ? React.createElement('div', { className: 'sid-cmp-model-fail' },
              failures.map((f) => React.createElement('div', { key: f.id }, f.name + ': ' + f.message)),
            ) : null,
          )
        : null

      const previewRow = images.length > 0
        ? React.createElement('div', { className: 'sid-cmp-imgs' },
            images.map((a) => React.createElement('span', { key: a.id, className: 'sid-cmp-img' },
              React.createElement('img', { src: a.previewUrl, alt: '', className: 'sid-cmp-img-thumb' }),
              React.createElement('button', {
                type: 'button',
                className: 'sid-cmp-img-x',
                title: zh ? '移除' : 'Remove',
                'aria-label': zh ? '移除' : 'Remove',
                onClick: () => removeImage(a.id),
              }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.close } })),
            )),
          )
        : null

      const queueDock = queued.length > 0
        ? React.createElement('div', { className: 'sid-cmp-queue' },
            React.createElement('span', { className: 'sid-cmp-queue-count' }, T.queue + ' ' + queued.length),
            React.createElement('span', { className: 'sid-cmp-queue-preview' },
              queued[0].preview || queued[0].text || (queued[0].content && queued[0].content.length ? (queued[0].content[0].text || '…') : '…'),
            ),
            React.createElement('button', {
              type: 'button',
              className: 'sid-cmp-queue-run',
              onClick: () => {
                if (!face || queued.length === 0) return
                try {
                  const p = face.updateQueue(queued[0].id, { kind: 'steer' })
                  if (p && typeof p.then === 'function') p.catch(() => {})
                } catch (e) { /* ignore */ }
              },
            }, T.steer),
          )
        : null

      const statLine = React.createElement('div', { className: 'sid-cmp-dock' },
        React.createElement('span', { className: 'sid-cmp-dock-item' }, sessionTitle || (sessionId ? String(sessionId) : T.noTarget)),
        React.createElement('span', { className: 'sid-cmp-dock-sep' }, '·'),
        React.createElement('span', { className: 'sid-cmp-dock-item' + (running ? ' run' : '') },
          removed ? T.removed : (running ? T.running : T.idle)),
        currentLabel ? React.createElement(React.Fragment, null,
          React.createElement('span', { className: 'sid-cmp-dock-sep' }, '·'),
          React.createElement('span', { className: 'sid-cmp-dock-item' }, currentLabel),
        ) : null,
      )

      return React.createElement('div', { className: 'sid-cmp' + (dragOver ? ' drag' : '') },
        queueDock,
        previewRow,
        React.createElement('div', { className: 'sid-cmp-card' },
          modelPanel,
          React.createElement('textarea', {
            ref: taRef,
            className: 'sid-cmp-ta',
            rows: 1,
            placeholder: disabled ? (removed ? T.removed : (!face ? T.noTarget : T.composer)) : T.composer,
            value: draft,
            disabled: !!removed || !face,
            onKeyDown: onKeyDown,
            onCompositionStart: onCompositionStart,
            onCompositionEnd: onCompositionEnd,
            onChange: (e) => { setDraft(e.target.value); grow() },
            onPaste: (e) => {
              const files = Array.from(e.clipboardData && e.clipboardData.items ? e.clipboardData.items : [])
                .filter((it) => it.kind === 'file' && it.getAsFile)
                .map((it) => it.getAsFile()).filter(Boolean)
              if (files.length > 0) { e.preventDefault(); intakeFiles(files) }
            },
            onDragOver: (e) => { e.preventDefault(); setDragOver(true) },
            onDragLeave: () => setDragOver(false),
            onDrop: (e) => { e.preventDefault(); setDragOver(false); intakeFiles(e.dataTransfer && e.dataTransfer.files) },
          }),
          React.createElement('div', { className: 'sid-cmp-tools' },
            React.createElement('button', {
              type: 'button',
              className: 'sid-cmp-tool',
              title: T.attach,
              'aria-label': T.attach,
              disabled: !face || !!removed,
              onClick: () => { if (fileRef.current) fileRef.current.click() },
            }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.attach } })),
            React.createElement('input', {
              ref: fileRef,
              type: 'file',
              accept: 'image/png,image/jpeg,image/webp,image/gif',
              multiple: true,
              style: { display: 'none' },
              onChange: (e) => { if (e.target.files) intakeFiles(e.target.files); e.target.value = '' },
            }),
            modelBtn,
            React.createElement('div', { className: 'sid-cmp-spacer' }),
            sendBtn,
          ),
        ),
        statLine,
      )
    }

    function MainUI(props) {
      const wsState = props.useWorkspaces(function (s) { return s })
      const ssState = props.useSessions(function (s) { return s })
      const workspaces = wsState && wsState.items ? wsState.items : []
      const [selWs, setSelWs] = React.useState(null)
      const [q, setQ] = React.useState('')
      const [collapsed, setCollapsed] = React.useState(false)
      const activeWsId = selWs || (wsState && wsState.recentWorkspaceId) || (workspaces[0] && workspaces[0].workspaceId)
      const activeWs = workspaces.find(function (w) { return w.workspaceId === activeWsId })
      const wsSessions = activeWs ? activeWs.sessionIds.map(function (id) { return ssState.byId[id] }).filter(Boolean) : []
      const query = q.trim().toLowerCase()
      const sessions = query ? wsSessions.filter(function (s) { return (s.displayTitle || s.id).toLowerCase().indexOf(query) >= 0 }) : wsSessions
      const loading = wsState && wsState.phase === 'loading'
      const targetId = (ssState && ssState.current) || (wsSessions[0] && wsSessions[0].id)
      const targetTitle = (ssState && targetId && ssState.byId[targetId]) ? ssState.byId[targetId].displayTitle : null

      const openSession = (sid) => {
        if (sessionsSvc) { try { sessionsSvc.open(sid) } catch (e) { /* ignore */ } }
        props.onClose()
      }
      const newSession = () => {
        if (workspacesSvc) { try { workspacesSvc.startSession() } catch (e) { /* ignore */ } }
        props.onClose()
      }
      const toggleCollapse = () => setCollapsed(!collapsed)
      const toggleBtn = (cls) => React.createElement('button', {
        type: 'button',
        className: cls,
        title: collapsed ? T.expand : T.collapse,
        'aria-label': collapsed ? T.expand : T.collapse,
        onClick: toggleCollapse,
      }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.panelLeft } }))
      const railNew = React.createElement('button', {
        type: 'button',
        className: 'sid-rail-btn sid-rail-new',
        title: T.newSession,
        'aria-label': T.newSession,
        onClick: newSession,
      }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.newChat } }))
      const railModules = T.nav.map((item) => React.createElement('button', {
        type: 'button',
        key: item.id,
        className: 'sid-rail-btn',
        title: item.label,
        'aria-label': item.label,
        onClick: () => toast(item.label + ' — ' + T.coming),
      }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC[item.icon] } })))

      return React.createElement('div', { className: 'sid-main-ui' },
        React.createElement(ParticleField),
        React.createElement('header', { className: 'sid-top' },
          React.createElement('div', { className: 'sid-brand' },
            React.createElement('span', { className: 'sid-brand-mark', dangerouslySetInnerHTML: { __html: IC.mark } }),
            React.createElement('span', { className: 'sid-brand-word' }, 'SIDOR'),
            React.createElement('span', { className: 'sid-brand-caption' },
              React.createElement('span', { className: 'sid-caption-whale', dangerouslySetInnerHTML: { __html: IC.whale } }),
              React.createElement('span', null, T.caption),
            ),
          ),
          React.createElement('button', {
            type: 'button',
            className: 'sid-icon-btn',
            title: T.close,
            'aria-label': T.close,
            onClick: props.onClose,
          }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC.close } })),
        ),
        React.createElement('div', { className: 'sid-body' },
          React.createElement('aside', { className: 'sid-sidebar' + (collapsed ? ' collapsed' : '') },
            collapsed ? React.createElement('div', { className: 'sid-rail' }, railNew, railModules, toggleBtn('sid-rail-btn sid-rail-toggle'))
              : React.createElement('div', { className: 'sid-sb-inner' },
                  React.createElement('button', {
                    type: 'button',
                    className: 'sid-sb-new',
                    onClick: newSession,
                  }, React.createElement('span', null, '+'), React.createElement('span', null, T.newSession)),
                  React.createElement('div', { className: 'sid-sb-ws' },
                    loading ? React.createElement('div', { className: 'sid-empty' }, T.loading)
                      : workspaces.length === 0 ? React.createElement('div', { className: 'sid-empty' }, T.wsNone)
                      : workspaces.map((w) => React.createElement('button', {
                          key: w.workspaceId,
                          type: 'button',
                          className: 'sid-chip' + (w.workspaceId === activeWsId ? ' on' : ''),
                          title: w.path || w.workspaceId,
                          onClick: () => setSelWs(w.workspaceId),
                        }, w.title || w.workspaceId)),
                  ),
                  React.createElement('div', { className: 'sid-sb-search' },
                    React.createElement('input', {
                      type: 'text',
                      value: q,
                      placeholder: T.search,
                      onChange: (e) => setQ(e.target.value),
                    }),
                  ),
                  React.createElement('div', { className: 'sid-sb-list' },
                    loading ? React.createElement('div', { className: 'sid-empty' }, T.loading)
                      : sessions.length === 0 ? React.createElement('div', { className: 'sid-empty' }, T.ssNone)
                      : sessions.map((s) => React.createElement('div', {
                          key: s.id,
                          className: 'sid-row' + (ssState.current === s.id ? ' active' : ''),
                          role: 'button',
                          tabIndex: 0,
                          onClick: () => openSession(s.id),
                          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(s.id) } },
                        },
                          React.createElement('span', { className: 'sid-row-name' }, s.displayTitle || s.id),
                          s.running ? React.createElement('span', { className: 'sid-row-meta' }, '…') : null,
                        )),
                  ),
                  React.createElement('div', { className: 'sid-sb-foot' },
                    toggleBtn('sid-sb-foot-btn'),
                    T.nav.map((item) => React.createElement('button', {
                      type: 'button',
                      key: item.id,
                      className: 'sid-sb-foot-btn',
                      title: item.label,
                      'aria-label': item.label,
                      onClick: () => toast(item.label + ' — ' + T.coming),
                    }, React.createElement('span', { dangerouslySetInnerHTML: { __html: IC[item.icon] } }))),
                  ),
                ),
          ),
          React.createElement('div', { className: 'sid-stage' },
            React.createElement('div', { className: 'sid-hero' },
              React.createElement('div', { className: 'sid-hero-whale', dangerouslySetInnerHTML: { __html: IC.whaleBig } }),
              React.createElement('div', { className: 'sid-hero-word' }, 'SIDOR'),
              React.createElement('div', { className: 'sid-hero-tag' }, T.greeting),
              React.createElement('div', { className: 'sid-hero-sub' }, T.sub),
            ),
            React.createElement('div', { className: 'sid-hero-chips' },
              workspaces.map((w) => React.createElement('button', {
                key: w.workspaceId,
                type: 'button',
                className: 'sid-chip' + (w.workspaceId === activeWsId ? ' on' : ''),
                onClick: () => setSelWs(w.workspaceId),
              }, w.title || w.workspaceId)),
            ),
            React.createElement(Composer, {
              sessionId: targetId,
              sessionTitle: targetTitle,
              onToast: toast,
            }),
          ),
        ),
        React.createElement(StatusStrip),
      )
    }

    function StatusStrip() {
      const [state, setState] = React.useState('pending')
      React.useEffect(() => {
        let alive = true
        host.call('sidor/ping', {}).then((r) => {
          if (!alive) return
          setState(r && r.ok ? 'online' : 'offline')
        }).catch(() => {
          if (alive) setState('offline')
        })
        return () => { alive = false }
      }, [])
      const time = new Date().toLocaleTimeString([], { hour12: false })
      const statusText = state === 'online' ? T.online : state === 'offline' ? T.offline : '…'
      return React.createElement('footer', { className: 'sid-strip' },
        React.createElement('span', { className: 'sid-dot ' + state }),
        React.createElement('span', null, T.core + ' · ' + statusText),
        React.createElement('span', { className: 'sid-strip-sep' }, '·'),
        React.createElement('span', null, 'sidor-shell'),
        React.createElement('span', { className: 'sid-strip-sep' }, '·'),
        React.createElement('span', null, time),
      )
    }

    function Toast() {
      const msg = useToast()
      if (!msg) return null
      return React.createElement('div', { className: 'sid-toast', role: 'status' }, msg)
    }

    function OverlayShell(props) {
      const isOpen = useOpen()
      const [view, setView] = React.useState('intro')
      React.useEffect(() => {
        if (!isOpen) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => {
          document.body.style.overflow = prev
          window.removeEventListener('keydown', onKey)
        }
      }, [isOpen])
      React.useEffect(() => { if (!isOpen) setView('intro') }, [isOpen])
      if (!isOpen) return null
      if (view === 'main') {
        return React.createElement('div', { className: 'sid-shell' },
          React.createElement(MainUI, {
            useSessions: props.useSessions,
            useWorkspaces: props.useWorkspaces,
            onClose: () => setOpen(false),
          }),
          React.createElement(Toast),
        )
      }
      return React.createElement('div', { className: 'sid-shell' },
        React.createElement(IntroScene, { onFinished: () => setView('main') }),
        React.createElement(Toast),
      )
    }

    /* ============ styles ============ */
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
  inset: 0;
  overflow: hidden;
  pointer-events: auto;
  color: var(--sid-ink);
  background: color-mix(in srgb, var(--sid-bg) 82%, transparent);
  backdrop-filter: blur(18px) saturate(1.05);
  -webkit-backdrop-filter: blur(18px) saturate(1.05);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  animation: sid-in 0.32s var(--sid-ease);
  z-index: 0;
}
.sid-shell * { box-sizing: border-box; }
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

/* ---- main interface ---- */
.sid-main-ui {
  position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0;
  animation: sid-main-in 0.45s var(--sid-ease); z-index: 2;
}
@keyframes sid-main-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.sid-main-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.sid-top {
  display: flex; align-items: center; justify-content: space-between; height: 54px; padding: 0 18px 0 20px;
  border-bottom: 1px solid var(--sid-hairline); flex: none; position: relative; z-index: 2;
  background: color-mix(in srgb, var(--sid-surface) 72%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.sid-brand { display: flex; align-items: center; gap: 10px; }
.sid-brand-mark { display: inline-flex; color: var(--dsw-alias-brand-primary); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent)); }
.sid-brand-word { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; font-size: 16px; letter-spacing: 0.24em; text-indent: 0.24em; color: var(--sid-ink); }
.sid-brand-caption { display: inline-flex; align-items: center; gap: 6px; padding-left: 10px; border-left: 1px solid var(--sid-hairline-strong); font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--sid-ink-dim); }
.sid-caption-whale { display: inline-flex; color: var(--sid-ink-dim); }
.sid-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
  border: none; border-radius: 8px; background: transparent; color: var(--sid-ink-dim); cursor: pointer;
  transition: background 0.15s var(--sid-ease), color 0.15s var(--sid-ease);
}
.sid-icon-btn:hover { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-body { flex: 1; min-height: 0; display: flex; position: relative; z-index: 1; }
.sid-sidebar {
  width: 280px; flex: none; display: flex; flex-direction: column; padding: 12px;
  border-right: 1px solid var(--sid-hairline); min-height: 0; overflow: hidden;
  background: color-mix(in srgb, var(--sid-surface) 55%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  transition: width 0.28s var(--sid-ease), padding 0.28s var(--sid-ease);
}
.sid-sidebar.collapsed { width: 56px; padding: 12px 8px; }
.sid-rail { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sid-rail-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px;
  border: none; border-radius: 9px; background: transparent; color: var(--sid-ink-dim); cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-rail-btn:hover { background: var(--sid-surface-2); color: var(--sid-ink); box-shadow: inset 0 0 0 1px var(--sid-hairline-strong); }
.sid-rail-new { margin-bottom: 4px; border-bottom: 1px solid var(--sid-hairline); border-radius: 0 0 9px 9px; padding-bottom: 10px; }
.sid-rail-toggle { margin-top: auto; }
.sid-sb-inner { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.sid-sb-new {
  display: flex; align-items: center; justify-content: center; gap: 6px; height: 34px;
  border: 1px solid var(--sid-hairline-strong); border-radius: 9px; background: transparent;
  color: var(--sid-ink); font-size: 13px; cursor: pointer; margin-bottom: 10px; flex: none;
  transition: background 0.15s var(--sid-ease), box-shadow 0.15s var(--sid-ease);
}
.sid-sb-new:hover { background: var(--sid-surface-2); box-shadow: inset 0 0 0 1px var(--sid-hairline-strong); }
.sid-sb-ws { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; max-height: 88px; overflow-y: auto; flex: none; }
.sid-chip {
  display: inline-flex; align-items: center; max-width: 100%; padding: 4px 10px;
  border: 1px solid var(--sid-hairline); border-radius: 999px; background: transparent;
  color: var(--sid-ink-dim); font-size: 12px; cursor: pointer; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
  transition: all 0.15s var(--sid-ease);
}
.sid-chip:hover { color: var(--sid-ink); border-color: var(--sid-hairline-strong); }
.sid-chip.on { color: var(--sid-ink); border-color: var(--sid-ink); background: var(--sid-surface-2); }
.sid-sb-search { margin-bottom: 8px; flex: none; }
.sid-sb-search input {
  width: 100%; height: 30px; padding: 0 10px; border: 1px solid var(--sid-hairline); border-radius: 8px;
  background: color-mix(in srgb, var(--sid-surface) 72%, transparent); color: var(--sid-ink);
  font-size: 12px; outline: none;
}
.sid-sb-search input:focus { border-color: var(--sid-hairline-strong); }
.sid-sb-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 0; }
.sid-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px;
  cursor: pointer; color: var(--sid-ink-dim); font-size: 13px; line-height: 18px;
}
.sid-row:hover { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-row.active { color: var(--sid-ink); box-shadow: inset 2px 0 0 var(--sid-ink); }
.sid-row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sid-row-meta { margin-left: auto; flex: none; font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: var(--sid-ink-dim); }
.sid-sb-foot {
  display: flex; align-items: center; gap: 4px; padding-top: 10px; margin-top: 8px;
  border-top: 1px solid var(--sid-hairline); flex: none;
}
.sid-sb-foot-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
  border: none; border-radius: 8px; background: transparent; color: var(--sid-ink-dim); cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-sb-foot-btn:hover { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-empty { padding: 16px 8px; text-align: center; font-size: 12px; color: var(--sid-ink-dim); }
.sid-sb-list::-webkit-scrollbar, .sid-sb-ws::-webkit-scrollbar { width: 8px; }
.sid-sb-list::-webkit-scrollbar-thumb, .sid-sb-ws::-webkit-scrollbar-thumb { background: var(--sid-hairline-strong); border-radius: 4px; }
.sid-stage {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px;
}
.sid-hero { display: flex; flex-direction: column; align-items: center; text-align: center; user-select: none; }
.sid-hero-whale { display: inline-flex; color: var(--sid-ink); opacity: 0.9; margin-bottom: 4px; }
.sid-hero-word { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; font-size: 44px; letter-spacing: 0.2em; text-indent: 0.2em; color: var(--sid-ink); margin-top: 10px; }
.sid-hero-tag { margin-top: 12px; font-size: 13px; letter-spacing: 0.3em; text-indent: 0.3em; color: var(--sid-ink-dim); }
.sid-hero-sub { margin-top: 8px; font-size: 12px; letter-spacing: 0.06em; color: var(--sid-ink-dim); opacity: 0.85; }
.sid-hero-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 640px; }

/* ---- composer (official-featured first version) ---- */
.sid-cmp { width: min(640px, 100%); display: flex; flex-direction: column; gap: 6px; }
.sid-cmp.drag .sid-cmp-card { box-shadow: inset 0 0 0 1px var(--sid-ink); }
.sid-cmp-card {
  border: 1px solid var(--sid-hairline-strong); border-radius: 14px;
  background: color-mix(in srgb, var(--sid-surface) 74%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  padding: 8px 10px 6px; position: relative;
  transition: box-shadow 0.15s var(--sid-ease), border-color 0.15s var(--sid-ease);
}
.sid-cmp-card:focus-within { box-shadow: 0 0 0 1px var(--sid-ink); }
.sid-cmp-ta {
  width: 100%; display: block; border: none; outline: none; resize: none;
  background: transparent; color: var(--sid-ink);
  font-size: 14px; line-height: 22px; min-height: 22px; max-height: 120px;
  padding: 2px 2px 4px; overflow-y: auto;
  font-family: inherit;
}
.sid-cmp-ta::placeholder { color: var(--sid-ink-dim); opacity: 0.7; }
.sid-cmp-ta:disabled { opacity: 0.55; cursor: not-allowed; }
.sid-cmp-tools { display: flex; align-items: center; gap: 4px; }
.sid-cmp-tool {
  display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: none; border-radius: 8px; background: transparent; color: var(--sid-ink-dim); cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-cmp-tool:hover:not(:disabled) { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-cmp-tool:disabled { opacity: 0.4; cursor: not-allowed; }
.sid-cmp-spacer { flex: 1; }
.sid-cmp-send {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border: none; border-radius: 9px; background: var(--sid-surface-2); color: var(--sid-ink); cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-cmp-send:hover:not(:disabled) { box-shadow: inset 0 0 0 1px var(--sid-hairline-strong); }
.sid-cmp-send.off { opacity: 0.4; cursor: not-allowed; }
.sid-cmp-send.stop { color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); }
.sid-cmp-model {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px;
  border: none; border-radius: 8px; background: transparent; color: var(--sid-ink-dim); cursor: pointer;
  font-size: 12px; max-width: 220px; transition: all 0.15s var(--sid-ease);
}
.sid-cmp-model:hover:not(:disabled) { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-cmp-model.on { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-cmp-model:disabled { opacity: 0.4; cursor: not-allowed; }
.sid-cmp-model-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sid-cmp-model-caret { display: inline-flex; flex: none; transition: transform 0.18s var(--sid-ease); }
.sid-cmp-model.on .sid-cmp-model-caret { transform: rotate(180deg); }
.sid-cmp-model-panel {
  position: absolute; z-index: 6; left: 8px; right: 8px; top: 100%; margin-top: 4px;
  max-height: 260px; overflow-y: auto;
  border: 1px solid var(--sid-hairline-strong); border-radius: 12px;
  background: color-mix(in srgb, var(--sid-surface) 92%, transparent);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.22);
  padding: 8px; animation: sid-toast-in 0.18s var(--sid-ease);
}
.sid-cmp-model-group { margin-bottom: 6px; }
.sid-cmp-model-group:last-child { margin-bottom: 0; }
.sid-cmp-model-group-name {
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--sid-ink-dim); opacity: 0.8; padding: 4px 8px 2px;
}
.sid-cmp-model-opt {
  display: block; width: 100%; text-align: left; padding: 7px 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--sid-ink-dim); font-size: 13px; cursor: pointer;
  transition: all 0.12s var(--sid-ease);
}
.sid-cmp-model-opt:hover { background: var(--sid-surface-2); color: var(--sid-ink); }
.sid-cmp-model-opt.on { color: var(--sid-ink); background: var(--sid-surface-2); box-shadow: inset 2px 0 0 var(--sid-ink); }
.sid-cmp-model-empty { padding: 12px; text-align: center; font-size: 12px; color: var(--sid-ink-dim); }
.sid-cmp-model-fail { margin-top: 6px; padding: 6px 8px; border-top: 1px solid var(--sid-hairline); font-size: 11px; color: var(--dsw-alias-state-error-primary); }
.sid-cmp-imgs { display: flex; flex-wrap: wrap; gap: 6px; }
.sid-cmp-img { position: relative; display: inline-flex; }
.sid-cmp-img-thumb {
  width: 44px; height: 44px; object-fit: cover; border-radius: 8px;
  border: 1px solid var(--sid-hairline-strong);
}
.sid-cmp-img-x {
  position: absolute; top: -6px; right: -6px; width: 18px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--sid-hairline-strong); border-radius: 50%;
  background: var(--sid-surface); color: var(--sid-ink); cursor: pointer; padding: 0;
  font-size: 10px;
}
.sid-cmp-queue {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border: 1px dashed var(--sid-hairline-strong); border-radius: 10px;
  background: color-mix(in srgb, var(--sid-surface) 55%, transparent);
  font-size: 12px; color: var(--sid-ink-dim);
}
.sid-cmp-queue-count { flex: none; font-family: ui-monospace, Consolas, monospace; }
.sid-cmp-queue-preview { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sid-cmp-queue-run {
  flex: none; padding: 3px 10px; border: 1px solid var(--sid-hairline-strong); border-radius: 7px;
  background: transparent; color: var(--sid-ink); font-size: 12px; cursor: pointer;
  transition: all 0.15s var(--sid-ease);
}
.sid-cmp-queue-run:hover { background: var(--sid-surface-2); box-shadow: inset 0 0 0 1px var(--sid-hairline-strong); }
.sid-cmp-dock {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 11px;
  letter-spacing: 0.08em; color: var(--sid-ink-dim);
}
.sid-cmp-dock-item { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.sid-cmp-dock-item.run { color: var(--dsw-alias-state-success-primary); }
.sid-cmp-dock-sep { opacity: 0.5; }

.sid-strip {
  display: flex; align-items: center; justify-content: center; gap: 10px; height: 32px; padding: 0 16px;
  border-top: 1px solid var(--sid-hairline); flex: none; position: relative; z-index: 2;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 11px; letter-spacing: 0.08em;
  color: var(--sid-ink-dim);
  background: color-mix(in srgb, var(--sid-surface) 72%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.sid-strip-sep { opacity: 0.5; }
.sid-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sid-ink-dim); flex: none; }
.sid-dot.pending { animation: sid-dot-pulse 1.2s ease-in-out infinite; }
.sid-dot.online { background: var(--dsw-alias-state-success-primary); box-shadow: 0 0 8px color-mix(in srgb, var(--dsw-alias-state-success-primary) 70%, transparent); }
.sid-dot.offline { background: var(--dsw-alias-state-error-primary); box-shadow: 0 0 8px color-mix(in srgb, var(--dsw-alias-state-error-primary) 70%, transparent); }
@keyframes sid-dot-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.sid-toast {
  position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); z-index: 6;
  padding: 8px 16px; border: 1px solid var(--sid-hairline-strong); border-radius: 10px;
  background: color-mix(in srgb, var(--sid-surface) 82%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-size: 12px; letter-spacing: 0.06em; color: var(--sid-ink);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  animation: sid-toast-in 0.24s var(--sid-ease); pointer-events: none;
}
@keyframes sid-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
      { name: 'shell.overlay', id: 'sidor-shell', order: 100, label: 'SIDOR' },
      (props) => React.createElement(OverlayShell, {
        useSessions: props.useSessions,
        useWorkspaces: props.useWorkspaces,
      }),
    ))
  },
}
