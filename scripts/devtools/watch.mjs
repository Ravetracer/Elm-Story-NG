// Attaches to the Elm Story renderer, records console output and uncaught
// exceptions, optionally evaluates an expression, then prints what arrived.
//   node watch.mjs '<expression>' [waitMs]
const expr = process.argv[2] || 'null'
const waitMs = Number(process.argv[3] || 4000)

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

const describe = (arg) =>
  arg.value !== undefined
    ? String(arg.value)
    : arg.description || arg.unserializableValue || arg.type

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
        msg.params.args.map(describe).join(' ').slice(0, 600)
    )
  }

  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    events.push(
      `[EXCEPTION] ${d.exception?.description || d.text}`.slice(0, 1500)
    )
  }

  if (msg.method === 'Log.entryAdded') {
    events.push(
      `[log.${msg.params.entry.level}] ${msg.params.entry.text}`.slice(0, 400)
    )
  }
})

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Runtime.enable')
await send('Log.enable')

const result = await send('Runtime.evaluate', {
  expression: expr,
  returnByValue: true,
  awaitPromise: true
})

if (result.result?.value !== undefined && result.result.value !== null) {
  console.log(
    'EVAL:',
    typeof result.result.value === 'string'
      ? result.result.value
      : JSON.stringify(result.result.value, null, 1)
  )
}
if (result.exceptionDetails) {
  console.log('EVAL THREW:', result.exceptionDetails.exception?.description)
}

await new Promise((resolve) => setTimeout(resolve, waitMs))

console.log(`\n--- ${events.length} renderer events ---`)
for (const e of events) console.log(e)

ws.close()
