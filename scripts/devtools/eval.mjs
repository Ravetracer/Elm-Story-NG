// Minimal Chrome DevTools Protocol client: evaluates an expression in the
// Elm Story renderer and prints the result. Node 22+ has a global WebSocket.
const expr = process.argv[2]

const targets = await (await fetch('http://localhost:9222/json')).json()
const page = targets.find(
  (t) => t.type === 'page' && !t.url.startsWith('devtools://')
)

if (!page) {
  console.error('no page target found:', targets.map((t) => t.type + ' ' + t.url))
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()

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
  }
})

await new Promise((resolve) => ws.addEventListener('open', resolve))

await send('Runtime.enable')

const result = await send('Runtime.evaluate', {
  expression: expr,
  returnByValue: true,
  awaitPromise: true
})

if (result.exceptionDetails) {
  console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails.exception, null, 2))
  process.exit(1)
}

const value = result.result.value
console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
ws.close()
