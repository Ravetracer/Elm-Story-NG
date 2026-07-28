// Captures the Elm Story renderer via CDP Page.captureScreenshot, so the result
// is independent of which desktop window happens to be in front.
import { writeFileSync } from 'node:fs'

const out = process.argv[2]

const targets = await (await fetch('http://localhost:9222/json')).json()
const page = targets.find(
  (t) => t.type === 'page' && !t.url.startsWith('devtools://')
)

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

const { data } = await send('Page.captureScreenshot', { format: 'png' })

writeFileSync(out, Buffer.from(data, 'base64'))
console.log('wrote', out)
ws.close()
