/**
 * Minimal MCP stdio client used by the self-test route and the CLI spike.
 *
 * `@deepseek-ai/dsh-mcp-client` owns the real connection; this exists so the
 * settings card can answer "is the bridge actually working?" from the Host
 * process without disturbing the live MCP session (and without starting MATLAB
 * unless the caller asks for a deep probe).
 */
import { spawn } from 'node:child_process'

export interface McpProbeOptions {
  command: string
  args: readonly string[]
  env?: Record<string, string> | undefined
  cwd?: string | undefined
  timeoutMs?: number
}

export interface McpProbeResult {
  ok: boolean
  serverName?: string
  serverVersion?: string
  protocolVersion?: string
  tools?: string[]
  /** Raw text of one `tools/call` when `call` was requested. */
  callText?: string
  elapsedMs: number
  error?: string
  stderr?: string
}

interface JsonRpcMessage {
  id?: number
  method?: string
  result?: unknown
  error?: unknown
  params?: unknown
}

interface McpToolList {
  tools?: Array<{ name?: unknown }>
}

interface McpToolCallResult {
  content?: Array<{ type?: unknown; text?: unknown }>
  isError?: unknown
}

/**
 * Speak MCP over stdio: `initialize`, then `tools/list`, optionally one
 * `tools/call`. Never throws — a failed probe is reported as `ok: false` with
 * the reason, which is what the settings card renders.
 */
export async function probeMcp(options: McpProbeOptions & { call?: { name: string; arguments: Record<string, unknown> } }): Promise<McpProbeResult> {
  const started = Date.now()
  const timeoutMs = options.timeoutMs ?? 60_000
  const child = spawn(options.command, [...options.args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: { ...process.env, ...options.env } }),
  })

  let buffer = ''
  let stderr = ''
  const pending = new Map<number, (message: JsonRpcMessage) => void>()
  let nextId = 1

  const fail = (error: string): McpProbeResult => {
    child.kill()
    return { ok: false, error, elapsedMs: Date.now() - started, ...(stderr === '' ? {} : { stderr: stderr.slice(-2000) }) }
  }

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line === '') continue
      let message: JsonRpcMessage
      try {
        message = JSON.parse(line) as JsonRpcMessage
      } catch {
        continue
      }
      if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id)!(message)
        pending.delete(message.id)
      }
    }
  })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

  const rpc = (method: string, params: unknown): Promise<JsonRpcMessage> => new Promise((resolve, reject) => {
    const id = nextId++
    const timer = setTimeout(() => reject(new Error('timeout waiting for ' + method)), timeoutMs)
    pending.set(id, (message) => { clearTimeout(timer); resolve(message) })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })

  const notify = (method: string, params: unknown): void => {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  try {
    const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'dsh-matlab-mcp', version: '0.1.0' } })
    if (init.error !== undefined) return fail('initialize failed: ' + JSON.stringify(init.error))
    const info = (init.result as { serverInfo?: { name?: string; version?: string }; protocolVersion?: string } | undefined) ?? {}
    notify('notifications/initialized', {})
    const listed = await rpc('tools/list', {})
    if (listed.error !== undefined) return fail('tools/list failed: ' + JSON.stringify(listed.error))
    const tools = ((listed.result as McpToolList | undefined)?.tools ?? [])
      .map(tool => (typeof tool.name === 'string' ? tool.name : undefined))
      .filter((name): name is string => name !== undefined)
    let callText: string | undefined
    if (options.call !== undefined) {
      const called = await rpc('tools/call', { name: options.call.name, arguments: options.call.arguments })
      if (called.error !== undefined) return fail('tools/call failed: ' + JSON.stringify(called.error))
      const result = called.result as McpToolCallResult | undefined
      callText = (result?.content ?? [])
        .map(part => (typeof part.text === 'string' ? part.text : ''))
        .join('\n')
        .trim()
      if (result?.isError === true) return fail('tool returned an error: ' + callText)
    }
    return {
      ok: true,
      ...(info.serverInfo?.name === undefined ? {} : { serverName: info.serverInfo.name }),
      ...(info.serverInfo?.version === undefined ? {} : { serverVersion: info.serverInfo.version }),
      ...(info.protocolVersion === undefined ? {} : { protocolVersion: info.protocolVersion }),
      tools,
      ...(callText === undefined ? {} : { callText }),
      elapsedMs: Date.now() - started,
      ...(stderr === '' ? {} : { stderr: stderr.slice(-2000) }),
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  } finally {
    child.kill()
  }
}
