// Phase 0 spike: call one MCP tool on the official MATLAB MCP Server and print
// the full result. Starts MATLAB on the first call, so the timeout is generous.
// Usage: node mcp-call.mjs <server-exe> <tool-name> <json-args> [timeoutMs]
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [exe, toolName, jsonArgs, timeoutArg] = process.argv.slice(2)
const argsText = jsonArgs?.startsWith('@') ? readFileSync(jsonArgs.slice(1), 'utf8') : jsonArgs
if (!exe || !toolName) {
  console.error('usage: node mcp-call.mjs <server-exe> <tool-name> <json-args> [timeoutMs]')
  process.exit(2)
}
const timeoutMs = Number(timeoutArg ?? 600_000)
const serverArgs = (process.env.MCP_SERVER_ARGS ?? '').split(' ').filter(Boolean)

const child = spawn(exe, serverArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
const pending = new Map()
let nextId = 1
let buf = ''
const started = Date.now()

const timer = setTimeout(() => {
  console.error('TIMEOUT after ' + timeoutMs + 'ms')
  child.kill()
  process.exit(1)
}, timeoutMs)

function rpc(method, params) {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
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
      console.log('[server-notify]', JSON.stringify(message).slice(0, 400))
    }
  }
})
child.stderr.on('data', (chunk) => console.log('[stderr]', chunk.toString('utf8').trim().slice(0, 500)))
child.on('exit', (code) => console.log('[server-exit]', code))

await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'dsh-spike', version: '0.0.1' } })
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n')

console.log('calling ' + toolName + ' with ' + argsText + ' ...')
const reply = await rpc('tools/call', { name: toolName, arguments: JSON.parse(argsText) })
console.log('elapsed=' + ((Date.now() - started) / 1000).toFixed(1) + 's')
if (reply.error) console.log('[rpc-error]', JSON.stringify(reply.error))
const content = reply.result?.content ?? []
for (const part of content) console.log(part.type === 'text' ? part.text : '[' + part.type + ' part]')
if (reply.result?.isError) console.log('[isError] true')

clearTimeout(timer)
child.kill()
process.exit(0)
