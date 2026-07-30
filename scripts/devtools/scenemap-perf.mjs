// Measures what a pan and a stepped zoom actually cost on an open scene map,
// and counts the editor's own graph rebuilds while they happen.
//
// This exists because the scene map's lag was a one-stall-per-gesture problem
// rather than a frame-rate one, and because the cause was a write -> invalidate
// -> rebuild loop that is invisible to a frame counter. See TODO.md, "Why the
// scene map stalls while you move it". Re-measure before and after a change on
// the same scene: numbers from the running app, not from reasoning about the
// render tree.
//
// Usage: open a scene in the Composer, then
//   node scripts/devtools/scenemap-perf.mjs [--pan N] [--zoom N]

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name)

  return at === -1 ? fallback : Number(process.argv[at + 1])
}

const PAN_MOVES = arg('--pan', 60),
  ZOOM_TICKS = arg('--zoom', 20),
  PAN_INTERVAL = 16,
  ZOOM_INTERVAL = 100,
  IDLE_MS = 1000

// The renderer logs one of these per rebuild, so counting them says whether a
// gesture reached the database and came back as a new scene graph.
//
// Note what is *not* here: SCENE_MAP_SELECT_CENTER, the viewport-centre context
// dispatch, logs nothing, so it cannot be counted this way. `log lines` below is
// the proxy for it — the dispatch re-renders every ComposerContext consumer, and
// their effects log, so the total moves with how much of the app reacted.
const COUNTED = {
  'graph rebuilt': 'have scene, events and paths',
  highlight: 'SceneMap->highlightElements'
}

const targets = await (await fetch('http://localhost:9222/json')).json()
const page = targets.find(
  (t) => t.type === 'page' && !t.url.startsWith('devtools://')
)

if (!page) {
  console.error('no page target found. Is `npm run dev:debug` running?')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
let consoleLines = []

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)

  if (msg.method === 'Runtime.consoleAPICalled') {
    consoleLines.push(
      msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
    )
    return
  }

  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error
      ? reject(new Error(JSON.stringify(msg.error)))
      : resolve(msg.result)
  }
})

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Runtime.enable')

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })

  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails.exception))

  return result.result.value
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Frame intervals and long tasks are collected in the page: sampling them from
// here would measure the protocol round trip instead.
await evaluate(`
  window.__scenemapPerf = {
    frames: [],
    longTasks: [],
    start() {
      this.frames = []
      this.longTasks = []

      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          this.longTasks.push(Math.round(entry.duration))
      })

      try { this.observer.observe({ entryTypes: ['longtask'] }) } catch (e) {}

      let last = performance.now()

      const tick = (now) => {
        this.frames.push(now - last)
        last = now
        if (this.running) requestAnimationFrame(tick)
      }

      this.running = true
      requestAnimationFrame(tick)
    },
    stop() {
      this.running = false
      this.observer?.disconnect()

      const sorted = [...this.frames].sort((a, b) => a - b)
      const at = (q) => Math.round(sorted[Math.floor(sorted.length * q)] || 0)

      return {
        frames: sorted.length,
        median: at(0.5),
        p95: at(0.95),
        worst: Math.round(sorted[sorted.length - 1] || 0),
        slow: this.frames.filter((f) => f > 32).length,
        longTasks: this.longTasks.length,
        longTaskMs: this.longTasks.reduce((a, b) => a + b, 0)
      }
    }
  }; 'ready'
`)

const flow = await evaluate(`
  (() => {
    const pane = document.querySelector('.react-flow__renderer') ||
                 document.querySelector('.react-flow')
    if (!pane) return null
    const r = pane.getBoundingClientRect()
    return {
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      nodes: document.querySelectorAll('.react-flow__node').length,
      edges: document.querySelectorAll('.react-flow__edge').length
    }
  })()
`)

if (!flow) {
  console.error('no scene map open. Select a scene in the storyworld outline.')
  process.exit(1)
}

const mouse = (type, params) =>
  send('Input.dispatchMouseEvent', { type, button: 'left', ...params })

const phase = async (name, drive) => {
  consoleLines = []
  await evaluate('window.__scenemapPerf.start()')
  await drive()
  const stats = await evaluate('window.__scenemapPerf.stop()')

  const counts = Object.fromEntries(
    Object.entries(COUNTED).map(([label, needle]) => [
      label,
      consoleLines.filter((line) => line.includes(needle)).length
    ])
  )

  return { name, ...stats, ...counts, logLines: consoleLines.length }
}

const results = []

results.push(await phase('idle', () => sleep(IDLE_MS)))

results.push(
  await phase(`pan, ${PAN_MOVES} moves`, async () => {
    await mouse('mousePressed', { x: flow.x, y: flow.y, clickCount: 1 })

    for (let i = 0; i < PAN_MOVES; i++) {
      await mouse('mouseMoved', {
        x: flow.x + Math.round(Math.sin(i / 6) * 120),
        y: flow.y + Math.round(Math.cos(i / 6) * 60),
        buttons: 1
      })
      await sleep(PAN_INTERVAL)
    }

    await mouse('mouseReleased', { x: flow.x, y: flow.y, clickCount: 1 })
    await sleep(600)
  })
)

results.push(
  await phase(`zoom, ${ZOOM_TICKS} wheel ticks`, async () => {
    for (let i = 0; i < ZOOM_TICKS; i++) {
      await mouse('mouseWheel', {
        x: flow.x,
        y: flow.y,
        deltaX: 0,
        deltaY: i % 2 === 0 ? -120 : 120
      })
      await sleep(ZOOM_INTERVAL)
    }

    await sleep(600)
  })
)

const columns = [
  ['phase', (r) => r.name],
  ['median', (r) => `${r.median}ms`],
  ['p95', (r) => `${r.p95}ms`],
  ['worst', (r) => `${r.worst}ms`],
  ['>32ms', (r) => String(r.slow)],
  ['long tasks', (r) => (r.longTasks ? `${r.longTasks} / ${r.longTaskMs}ms` : 'none')],
  ...Object.keys(COUNTED).map((label) => [label, (r) => String(r[label])]),
  ['log lines', (r) => String(r.logLines)]
]

const rows = [
  columns.map(([header]) => header),
  ...results.map((r) => columns.map(([, read]) => read(r)))
]

const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)))

console.log(`scene: ${flow.nodes} nodes, ${flow.edges} edges\n`)
for (const [index, row] of rows.entries()) {
  console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '))
  if (index === 0) console.log(widths.map((w) => '-'.repeat(w)).join('  '))
}

ws.close()
