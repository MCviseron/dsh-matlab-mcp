/**
 * Host-side HTTP routes for the settings card: provisioning, self-test, status,
 * reconnect, and the loopback settings bridge the browser half writes through.
 */
import type { ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SettingsConflictError, type SettingsPathOp } from '@deepseek-ai/dsh-settings'
import type { ResolvedConfig } from './index.ts'
import { isLoopbackRequest } from './loopback.ts'
import type { McpProbeResult } from './selftest.ts'
import type { ProvisionState, SetupResult } from './provision.ts'

export const MATLAB_MCP_API = {
  status: '/api/dsh-matlab-mcp/status',
  setup: '/api/dsh-matlab-mcp/setup',
  test: '/api/dsh-matlab-mcp/test',
  reconnect: '/api/dsh-matlab-mcp/reconnect',
  diagnostics: '/api/dsh-matlab-mcp/diagnostics',
  settingsDescribe: '/api/dsh-matlab-mcp/settings/describe',
  settingsMutate: '/api/dsh-matlab-mcp/settings/mutate',
} as const

const MAX_BODY_BYTES = 64 * 1024

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: Parameters<WebRoute['handler']>[0]): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

/**
 * Whether a settings write was refused as stale. Class check plus the stable
 * machine code, because the throwing host may run a different copy of
 * `@deepseek-ai/dsh-settings` than this plugin's own dependency — a cross-copy
 * `instanceof` is false even when both copies are the same version.
 */
function isSettingsConflict(error: unknown): error is SettingsConflictError {
  if (error instanceof SettingsConflictError) return true
  return (error as { code?: unknown } | null)?.code === 'SETTINGS_CONFLICT'
}

export interface SettingsBridgeView {
  ns: unknown
  schema?: unknown
  value?: unknown
  base?: unknown
  user?: unknown
  revision: number
  secrets?: Array<{ path: readonly string[]; set: boolean }>
}

export interface SettingsBridge {
  readonly writable?: boolean
  describe: (options?: { redactSecrets?: boolean }) => SettingsBridgeView[]
  mutate: (ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number) => Promise<void>
}

function toView(descriptor: SettingsBridgeView): unknown {
  return {
    ns: String(descriptor.ns),
    schema: descriptor.schema,
    value: descriptor.value,
    ...(descriptor.base === undefined ? {} : { base: descriptor.base }),
    ...(descriptor.user === undefined ? {} : { user: descriptor.user }),
    ...(descriptor.secrets === undefined ? {} : { secrets: descriptor.secrets.map(secret => ({ path: [...secret.path], set: secret.set })) }),
    revision: descriptor.revision,
  }
}

export interface MatlabMcpRouteDeps {
  getConfig: () => ResolvedConfig
  /** Current on-disk provisioning state (binary/toolbox/toolkits/MATLAB). */
  getState: () => Promise<ProvisionState>
  /** The exact MCP-client config this plugin would mount (diagnostics). */
  launchConfig: () => unknown
  /** Run the one-click install/repair; log lines stream into the response. */
  setup: (log: (message: string) => void) => Promise<SetupResult>
  /** Speak MCP to the provisioned binary; `deep` also runs one MATLAB call. */
  probe: (deep: boolean) => Promise<McpProbeResult>
  /** Dispose and recreate the MCP client mount. */
  reconnect: () => void
  diagnostics?: () => unknown
}

export function makeMatlabMcpRoutes(deps: MatlabMcpRouteDeps): WebRoute[] {
  const status: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.status,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      try {
        const state = await deps.getState()
        json(res, 200, { ok: true, state, config: deps.getConfig(), launch: deps.launchConfig(), diagnostics: deps.diagnostics?.() ?? null })
      } catch (error) {
        json(res, 500, { ok: false, error: 'status-failed', message: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  const setup: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.setup,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      const logs: string[] = []
      const log = (message: string): void => { logs.push(new Date().toISOString() + ' ' + message) }
      try {
        const result = await deps.setup(log)
        deps.reconnect()
        json(res, 200, { ok: true, logs, result })
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code
        json(res, 500, {
          ok: false,
          error: typeof code === 'string' ? code : 'setup-failed',
          message: error instanceof Error ? error.message : String(error),
          logs,
        })
      }
    },
  }

  const test: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.test,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      const body = await readJsonBody(req)
      const deep = typeof body === 'object' && body !== null && (body as { deep?: unknown }).deep === true
      try {
        const result = await deps.probe(deep)
        json(res, result.ok ? 200 : 502, result.ok ? { ok: true, result } : { ok: false, error: result.error, result })
      } catch (error) {
        json(res, 500, { ok: false, error: 'probe-failed', message: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  const diagnostics: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.diagnostics,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      json(res, 200, { ok: true, config: deps.getConfig(), launchConfig: deps.launchConfig(), diagnostics: deps.diagnostics?.() ?? null })
    },
  }

  const reconnect: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.reconnect,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      try {
        deps.reconnect()
      } catch (error) {
        return json(res, 500, { ok: false, error: 'reconnect-failed', message: error instanceof Error ? error.message : String(error) })
      }
      await new Promise(resolve => setTimeout(resolve, 500))
      const result = await deps.probe(false)
      json(res, result.ok ? 200 : 502, { ok: result.ok, launch: deps.launchConfig(), result })
    },
  }

  return [status, setup, test, reconnect, diagnostics]
}

export function makeMatlabMcpSettingsRoutes(settings: SettingsBridge): WebRoute[] {
  const ns = 'matlab-mcp'
  const view = (): SettingsBridgeView | undefined => {
    const descriptors = settings.describe({ redactSecrets: true })
    return descriptors.find(descriptor => String(descriptor.ns) === ns)
  }

  const describe: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.settingsDescribe,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      const descriptor = view()
      json(res, 200, {
        ok: true,
        value: {
          namespaces: descriptor === undefined ? [] : [toView(descriptor)],
          writable: settings.writable !== false,
        },
      })
    },
  }

  const mutate: WebRoute = {
    kind: 'exact',
    path: MATLAB_MCP_API.settingsMutate,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      const body = await readJsonBody(req)
      if (body === undefined || typeof body !== 'object' || body === null) {
        return json(res, 400, { ok: false, code: 'settings-rejected', message: 'unreadable JSON body' })
      }
      const record = body as { ns?: unknown; ops?: unknown; expectedRevision?: unknown }
      if (record.ns !== ns || !Array.isArray(record.ops)) {
        return json(res, 400, { ok: false, code: 'settings-rejected', message: 'bad settings mutation' })
      }
      try {
        await settings.mutate(ns, record.ops as SettingsPathOp[], typeof record.expectedRevision === 'number' ? record.expectedRevision : undefined)
        const descriptor = view()
        json(res, 200, { ok: true, value: descriptor === undefined ? undefined : toView(descriptor) })
      } catch (error) {
        if (isSettingsConflict(error)) {
          return json(res, 409, { ok: false, code: error.code, message: error.message, expected: error.expected, actual: error.actual })
        }
        json(res, 400, { ok: false, code: 'settings-rejected', message: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  return [describe, mutate]
}
