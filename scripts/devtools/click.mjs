// Dispatches a real mouse click via CDP Input.dispatchMouseEvent, which grants
// user activation, unlike calling element.click() from Runtime.evaluate.
//   node click.mjs '<selector-expression returning an element>' [waitMs]
const finder = process.argv[2]
const waitMs = Number(process.argv[3] || 3000)

const targets = await (await fetch('http://localhost:9222/json')).json()
const page = targets.find(
  (t) => t.type === 'page' && !t.url.startsWith('devtools://')
)

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const events = []

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    events.push(
      `[console.${msg.params.type}] ` +
        msg.params.args
          .map((a) => (a.value !== undefined ? String(a.value) : a.description))
          .join(' ')
          .slice(0, 300)
    )
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    events.push(`[EXCEPTION] ${d.exception?.description || d.text}`.slice(0, 900))
  }
})

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Runtime.enable')

const box = await send('Runtime.evaluate', {
  expression: `(() => {
    const el = ${finder};
    if (!el) return null;
    el.scrollIntoView({block:'center'});
    const r = el.getBoundingClientRect();
    return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2, text:(el.innerText||'').slice(0,40)});
  })()`,
  returnByValue: true
})

if (!box.result.value) {
  console.log('TARGET NOT FOUND')
  process.exit(1)
}

const { x, y, text } = JSON.parse(box.result.value)
console.log(`clicking "${text}" at ${Math.round(x)},${Math.round(y)}`)

await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
await send('Input.dispatchMouseEvent', {
  type: 'mousePressed',
  x,
  y,
  button: 'left',
  clickCount: 1
})
await send('Input.dispatchMouseEvent', {
  type: 'mouseReleased',
  x,
  y,
  button: 'left',
  clickCount: 1
})

await new Promise((resolve) => setTimeout(resolve, waitMs))

if (events.length) {
  console.log(`--- ${events.length} events ---`)
  for (const e of events) console.log(e)
} else {
  console.log('--- no console events ---')
}

ws.close()
