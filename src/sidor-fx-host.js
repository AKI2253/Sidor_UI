return {
  apply(ctx) {
    const sessions = ctx.get('sessions')
    const fs = ctx.get('fs')
    if (sessions === undefined || fs === undefined) return

    /**
     * Save a client-uploaded document (non-image) into the target session's
     * workspace under `.sidor-uploads/`, so the agent can read it by path.
     *
     * - UTF-8 text documents are stored verbatim (agent reads them directly).
     * - Binary documents are stored as base64 text with a `.b64` suffix
     *   (the agent can decode them; fs cannot write raw bytes).
     *
     * Accepts lossless JSON: sessionId, name, dataBase64.
     */
    /**
     * Balance widget state + DeepSeek balance API.
     *
     * - 'sidor/balance-get': read { visible, apiKey, balance } persisted in
     *   the session workspace (.sidor-balance.json). No key => defaults.
     * - 'sidor/balance-set': persist { visible?, apiKey? }.
     * - 'sidor/balance-query': call the DeepSeek balance API with the stored
     *   API key via a spawned curl (subprocess) and return parsed balances.
     */
    harness.handle('sidor/balance-get', async () => {
      try {
        const cwd = firstCwd()
        if (cwd === null) return { ok: true, visible: true, apiKey: '', balance: null, alerts: { usd: 0, cny: 0 }, error: null }
        const file = await fs.resolve(cwd + '/.sidor-balance.json')
        const info = await fs.stat(file)
        if (!info) return { ok: true, visible: true, apiKey: '', balance: null, alerts: { usd: 0, cny: 0 }, error: null }
        const text = await fs.readText(file)
        const data = JSON.parse(text)
        const alerts = data.alerts && typeof data.alerts === 'object' ? data.alerts : {}
        return {
          ok: true,
          visible: data.visible !== false,
          apiKey: typeof data.apiKey === 'string' ? data.apiKey : '',
          balance: data.balance && typeof data.balance === 'object' ? data.balance : null,
          alerts: {
            usd: Number.isFinite(Number(alerts.usd)) ? Number(alerts.usd) : 0,
            cny: Number.isFinite(Number(alerts.cny)) ? Number(alerts.cny) : 0,
          },
          error: null,
        }
      } catch (error) {
        return { ok: false, error: error && typeof error.message === 'string' ? error.message : String(error) }
      }
    })
    harness.handle('sidor/balance-set', async (args) => {
      try {
        const cwd = firstCwd()
        if (cwd === null) return { ok: false, error: 'no session cwd' }
        const file = await fs.resolve(cwd + '/.sidor-balance.json')
        let data = {}
        try {
          const info = await fs.stat(file)
          if (info) data = JSON.parse(await fs.readText(file))
        } catch (e) { data = {} }
        if (args && typeof args.visible === 'boolean') data.visible = args.visible
        if (args && typeof args.apiKey === 'string') data.apiKey = args.apiKey
        if (args && typeof args.alertUsd === 'number' && Number.isFinite(args.alertUsd)) {
          if (!data.alerts || typeof data.alerts !== 'object') data.alerts = {}
          data.alerts.usd = Math.max(0, args.alertUsd)
        }
        if (args && typeof args.alertCny === 'number' && Number.isFinite(args.alertCny)) {
          if (!data.alerts || typeof data.alerts !== 'object') data.alerts = {}
          data.alerts.cny = Math.max(0, args.alertCny)
        }
        await fs.writeText(file, JSON.stringify(data, null, 2))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error && typeof error.message === 'string' ? error.message : String(error) }
      }
    })
    harness.handle('sidor/balance-query', async () => {
      try {
        const cwd = firstCwd()
        if (cwd === null) return { ok: false, error: 'no session cwd' }
        const file = await fs.resolve(cwd + '/.sidor-balance.json')
        let apiKey = ''
        try {
          const info = await fs.stat(file)
          if (info) {
            const data = JSON.parse(await fs.readText(file))
            apiKey = typeof data.apiKey === 'string' ? data.apiKey : ''
          }
        } catch (e) { apiKey = '' }
        if (apiKey === '') return { ok: false, error: '未配置 API Key' }

        const subprocess = ctx.get('subprocess')
        if (subprocess === undefined) return { ok: false, error: 'subprocess unavailable' }
        const curlPath = await subprocess.resolveExecutable('curl')
        const handle = subprocess.spawn({
          argv: [curlPath, '-s', '-X', 'GET', 'https://api.deepseek.com/user/balance', '-H', 'Authorization: Bearer ' + apiKey],
          cwd: cwd,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: 64 * 1024 },
            stderr: { maxBytes: 64 * 1024 },
          },
          graceMs: 15000,
        })
        await handle.done
        let body = ''
        try {
          if (handle.collected && handle.collected.stdout) {
            const read = handle.collected.stdout.readFrom(0)
            if (read) body = read.text || ''
          }
        } catch (e) { body = '' }
        let parsed = null
        try { parsed = JSON.parse(body) } catch (e) { parsed = null }
        if (!parsed) return { ok: false, error: '响应解析失败' }
        if (parsed.is_available === false) return { ok: false, error: '账户不可用' }
        const infos = Array.isArray(parsed.balance_infos) ? parsed.balance_infos : []
        const pick = (cur) => {
          const f = infos.find((b) => b && b.currency === cur)
          if (!f) return '0.00'
          const v = parseFloat(f.total_balance)
          return Number.isFinite(v) ? v.toFixed(2) : '0.00'
        }
        const balance = { usd: pick('USD'), cny: pick('CNY') }
        // persist the latest balance alongside the config
        try {
          const info = await fs.stat(file)
          const data = info ? JSON.parse(await fs.readText(file)) : {}
          data.balance = balance
          await fs.writeText(file, JSON.stringify(data, null, 2))
        } catch (e) { /* non-fatal */ }
        return { ok: true, balance }
      } catch (error) {
        return { ok: false, error: error && typeof error.message === 'string' ? error.message : String(error) }
      }
    })

    function firstCwd() {
      try {
        const list = sessions.list()
        for (const s of list) {
          if (s && s.header && typeof s.header.cwd === 'string' && s.header.cwd) {
            return s.header.cwd.replace(/\\+$/, '')
          }
        }
      } catch (e) { /* ignore */ }
      return null
    }

    harness.handle('sidor/upload-doc', async (args) => {
      try {
        const sessionId = args && typeof args.sessionId === 'string' ? args.sessionId : ''
        const name = args && typeof args.name === 'string' ? args.name : 'file'
        const dataBase64 = args && typeof args.dataBase64 === 'string' ? args.dataBase64 : ''
        if (sessionId === '' || dataBase64 === '') return { ok: false, error: 'missing sessionId or content' }

        const session = sessions.get(sessionId)
        const cwd = session && session.header ? session.header.cwd : undefined
        if (cwd === undefined || typeof cwd !== 'string') return { ok: false, error: 'session has no workspace cwd' }

        // Sanitize the filename: strip path separators, drive letters, and leading dots.
        const safeName = name.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim()
        if (safeName === '') return { ok: false, error: 'invalid file name' }

        // Decode the client base64 into raw bytes.
        let raw = ''
        try { raw = atob(dataBase64) } catch (e) { return { ok: false, error: 'invalid base64 content' } }
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

        // Try strict UTF-8 decode; NUL in the sample means binary.
        let text = null
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch (e) { text = null }
        const binary = text === null || bytes.subarray(0, 8192).includes(0)

        const uploadDir = cwd.replace(/\\+$/, '') + '/.sidor-uploads'
        const storedName = binary ? safeName + '.b64' : safeName
        const fileTarget = await fs.resolve(uploadDir + '/' + storedName)
        // fs.writeText atomically creates parent directories.
        await fs.writeText(fileTarget, binary ? dataBase64 : text)
        return {
          ok: true,
          path: '.sidor-uploads/' + storedName,
          binary,
        }
      } catch (error) {
        return { ok: false, error: error && typeof error.message === 'string' ? error.message : String(error) }
      }
    })
  },
}
