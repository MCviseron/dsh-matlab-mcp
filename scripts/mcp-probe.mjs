// Phase 0 spike: speak MCP over stdio to the official MATLAB MCP Server and
// list its tools. Not part of the shipped plugin; kept for reproducible evidence.
// Usage: node mcp-probe.mjs <server-exe> [server args...]
import { spawn } from 'node:child_process'

const [exe, ...args] = process.argv.slice(2)
if (!exe) {
  console.error('usage: node mcp-probe.mjs <server-exe> [args...]')
  process.exit(2)
}

const child = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false })
const pending = new Map()
let nextId = 1
let buf = ''
const started = Date.now()

const timer = setTimeout(() => {
  console.error('TIMEOUT after 60s')
  child.kill()
  process.exit(1)
}, 60_000)

function rpc(method, params) {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
}

child.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8')
  let index
  while ((index = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, index).trim()
    buf = buf.slice(index + 1)
    if (!line) continue
    let message
    try {
      message = JSON.parse(line)
    } catch {
      console.log('[non-json]', line.slice(0, 200))
      continue
    }
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    } else {
      console.log('[server-notify]', JSON.stringify(message).slice(0, 300))
    }
  }
})

child.stderr.on('data', (chunk) => console.log('[stderr]', chunk.toString('utf8').trim().slice(0, 400)))
child.on('exit', (code) => console.log('[server-exit]', code))

const init = await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'dsh-spike', version: '0.0.1' },
})
console.log('initialize +' + (Date.now() - started) + 'ms ->', JSON.stringify(init.result?.serverInfo ?? init.error))
notify('notifications/initialized', {})

const tools = await rpc('tools/list', {})
const list = tools.result?.tools ?? []
console.log('tools/list +' + (Date.now() - started) + 'ms -> ' + list.length + ' tools')
for (const tool of list) console.log(' -', tool.name)

clearTimeout(timer)
child.kill()
process.exit(0)
