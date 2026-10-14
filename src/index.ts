/**
 * dsh-matlab-mcp — Host half.
 *
 * Mounts the official MathWorks MATLAB MCP Server as a DSH MCP client (tools
 * appear as `mcp__matlab__*`), provisions the vendor artifacts on demand, and
 * announces how the agent should behave around MATLAB.
 */
import { existsSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-skill'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import z from '@deepseek-ai/schemastery'
import { MATLAB_MCP_GUIDANCE, SECTION_ORDER } from './guidance.ts'
import { makeMatlabMcpRoutes, makeMatlabMcpSettingsRoutes, type SettingsBridge } from './routes.ts'
import { booleanField, enumField, numberField, stringField, unwrapConfig } from './config-values.ts'
import { DEFAULT_MIRROR } from './download.ts'
import { binaryPath, pickMatlabRoot } from './paths.ts'
import {
  inspectState,
  resolvedWorkspace,
  runSetup,
  serverLogFolder,
  simulinkExtensionFile,
  type ProvisionLogger,
  type SetupResult,
} from './provision.ts'
import { probeMcp, type McpProbeResult } from './selftest.ts'
import { buildServerArgs, buildServerEnv, DISPLAY_MODES, SESSION_MODES, type DisplayMode, type SessionMode } from './server-args.ts'
import { releaseOwnedMatlab, rememberSpawnBaseline } from './matlab-processes.ts'
import { resolveSkillGroups } from './skills-catalog.ts'
import { createToolkitSkillProvider } from './skills-provider.ts'
import type { SkillProviderControl } from '@deepseek-ai/dsh-skill'

/** Settings namespace owned by this plugin (a lowercase hyphenated id). */
export const MATLAB_MCP_SETTINGS_NAMESPACE = 'matlab-mcp'

/** Raw config as the profile entry hands it over (values may be live handles). */
export interface MatlabMcpConfig {
  enabled?: boolean
  announceToAgent?: boolean
  matlabRoot?: string
  sessionMode?: string
  displayMode?: string
  initialWorkingFolder?: string
  simulinkTools?: boolean
  skillsEnabled?: boolean
  skillGroups?: string
  toolCallTimeoutMs?: number
  allowMirrorDownload?: boolean
  downloadMirror?: string
  telemetry?: boolean
  shutdownMatlabOnUnload?: boolean
}

/** Config resolved to plain, validated values. */
export interface ResolvedConfig {
  enabled: boolean
  announceToAgent: boolean
  matlabRoot: string
  sessionMode: SessionMode
  displayMode: DisplayMode
  initialWorkingFolder: string
  simulinkTools: boolean
  skillsEnabled: boolean
  skillGroups: string[]
  toolCallTimeoutMs: number
  allowMirrorDownload: boolean
  downloadMirror: string
  telemetry: boolean
  shutdownMatlabOnUnload: boolean
}

/**
 * Schema of this plugin's profile entry Config — which IS its settings namespace
 * on DSH >= 0.2, where only `volatile` fields become live-editable form fields.
 */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  announceToAgent: z.boolean().default(true).volatile(),
  matlabRoot: z.string().default('').volatile(),
  sessionMode: z.string().default('new').volatile(),
  displayMode: z.string().default('desktop').volatile(),
  initialWorkingFolder: z.string().default('').volatile(),
  simulinkTools: z.boolean().default(true).volatile(),
  skillsEnabled: z.boolean().default(true).volatile(),
  skillGroups: z.string().default('').volatile(),
  toolCallTimeoutMs: z.number().min(1000).max(1_800_000).default(600_000).volatile(),
  allowMirrorDownload: z.boolean().default(false).volatile(),
  downloadMirror: z.string().default(DEFAULT_MIRROR).volatile(),
  telemetry: z.boolean().default(false).volatile(),
  shutdownMatlabOnUnload: z.boolean().default(true).volatile(),
})

/** Resolve every field with a safe default (a live handle can never leak through). */
export function resolveConfig(config: MatlabMcpConfig | undefined): ResolvedConfig {
  const source = config ?? {}
  return {
    enabled: booleanField(source.enabled, true),
    announceToAgent: booleanField(source.announceToAgent, true),
    matlabRoot: stringField(source.matlabRoot, '').trim(),
    sessionMode: enumField(source.sessionMode, SESSION_MODES, 'new'),
    displayMode: enumField(source.displayMode, DISPLAY_MODES, 'desktop'),
    initialWorkingFolder: stringField(source.initialWorkingFolder, '').trim(),
    simulinkTools: booleanField(source.simulinkTools, true),
    skillsEnabled: booleanField(source.skillsEnabled, true),
    skillGroups: stringField(source.skillGroups, '').split(',').map(part => part.trim()).filter(part => part !== ''),
    toolCallTimeoutMs: numberField(source.toolCallTimeoutMs, 600_000),
    allowMirrorDownload: booleanField(source.allowMirrorDownload, false),
    downloadMirror: stringField(source.downloadMirror, DEFAULT_MIRROR).trim() || DEFAULT_MIRROR,
    telemetry: booleanField(source.telemetry, false),
    shutdownMatlabOnUnload: booleanField(source.shutdownMatlabOnUnload, true),
  }
}

/** Hooks a settings registration hands to the DSH settings seam. */
interface SettingsSectionHooks<T> {
  setSource: (source: () => T) => void
  onChange: () => void
}

/** Owner handle of one registered namespace, as both settings generations expose it. */
interface SettingsScopeHandle<T> {
  get: () => T
  watch: (callback: () => void) => () => void
}

/** The provider faces this registration probes at runtime, newest first. */
interface SettingsProviderFaces<T> {
  configure?: (presentation: { auto?: boolean }) => () => void
  installSection?: (owner: Context, ns: string, schema: unknown, entry: T, hooks: SettingsSectionHooks<T>) => void
  register?: (ns: string, schema: unknown, options: { base: T }) => SettingsScopeHandle<T>
}

/** Fiber states meaning "this plugin is tearing down" (value mirror of FiberState). */
const FIBER_DISPOSED = 4
const FIBER_UNLOADING = 5

/** Whether the owning plugin's fiber is unloading or already disposed. */
function isUnloading(ctx: Context): boolean {
  const state = (ctx as unknown as { fiber?: { state?: number } }).fiber?.state
  return state === FIBER_UNLOADING || state === FIBER_DISPOSED
}

/**
 * Register this plugin's settings namespace on whichever settings seam the
 * running DSH exposes, so one build serves every generation:
 *
 * - DSH >= 0.2: nothing to register (the entry Config is the namespace); the
 *   automatic settings page is switched off so the shipped card is the only page.
 * - DSH >= 0.1.5: `installSection` on the provider.
 * - DSH <= 0.1.1: `settings.register(ns, schema, { base })`.
 */
function installSettingsSection<T>(ctx: Context, scoped: Context, ns: string, schema: unknown, entry: T, hooks: SettingsSectionHooks<T>): void {
  const provider = scoped.settings as unknown as SettingsProviderFaces<T>
  if (typeof provider.configure === 'function') {
    ctx.effect(() => provider.configure!({ auto: false }), 'dsh-matlab-mcp: settings page policy')
    hooks.onChange()
    return
  }
  if (typeof provider.installSection === 'function') {
    provider.installSection(ctx, ns, schema, entry, hooks)
    return
  }
  if (typeof provider.register === 'function') {
    const scope = provider.register(ns, schema, { base: entry })
    hooks.setSource(() => scope.get())
    scoped.effect(() => () => {
      if (isUnloading(ctx)) return
      hooks.setSource(() => entry)
      hooks.onChange()
    })
    hooks.onChange()
    scope.watch(() => {
      if (isUnloading(ctx)) return
      hooks.onChange()
    })
    return
  }
  throw new TypeError('dsh-matlab-mcp: the running dsh settings service exposes none of configure (>= 0.2), installSection (>= 0.1.5), register (<= 0.1.1)')
}

export const inject = ['webServer', 'systemPrompt']

/** Everything the settings card needs to describe the current launch. */
export interface LaunchDescription {
  provisioned: boolean
  command: string
  args: string[]
  cwd: string
  serverName: string
  toolCallTimeoutMs: number
  env: Record<string, string>
}

/**
 * Build the MCP-client config for one resolved config, or `undefined` when the
 * bridge must not be mounted (disabled, or the binary has not been provisioned
 * yet — mounting a missing executable would reject the plugin fiber).
 */
export function buildLaunch(active: ResolvedConfig): LaunchDescription | undefined {
  const binary = binaryPath()
  if (!existsSync(binary)) return undefined
  const workspace = resolvedWorkspace(active.initialWorkingFolder)
  const extensionFile = simulinkExtensionFile()
  const args = buildServerArgs({
    matlabRoot: pickMatlabRoot({ preferred: active.matlabRoot }),
    sessionMode: active.sessionMode,
    displayMode: active.displayMode,
    initialWorkingFolder: workspace,
    logFolder: serverLogFolder(),
    extensionFiles: active.simulinkTools && existsSync(extensionFile) ? [extensionFile] : [],
    logLevel: 'info',
    telemetry: active.telemetry,
  })
  return {
    provisioned: true,
    command: binary,
    args,
    cwd: workspace,
    serverName: 'matlab',
    toolCallTimeoutMs: active.toolCallTimeoutMs,
    env: buildServerEnv(),
  }
}

/** The exact object handed to `@deepseek-ai/dsh-mcp-client`. */
function clientConfigFor(launch: LaunchDescription) {
  return {
    transport: 'stdio' as const,
    serverName: launch.serverName,
    command: launch.command,
    args: launch.args,
    env: launch.env,
    cwd: launch.cwd,
    toolCallTimeoutMs: launch.toolCallTimeoutMs,
    failOnStartupError: true,
    reconnect: {
      enabled: true,
      initialDelayMs: 500,
      maxDelayMs: 30_000,
      maxAttempts: 10,
    },
  }
}

export function apply(ctx: Context, config?: MatlabMcpConfig): void {
  let current: () => MatlabMcpConfig = () => unwrapConfig(config ?? {})
  const resolved = (): ResolvedConfig => resolveConfig(current())
  let disposeClient: (() => Promise<void>) | undefined
  let disposeSection: (() => void) | undefined
  let mounting: Promise<void> = Promise.resolve()
  let syncedBySettings = false
  let mountError: string | undefined
  let mountCount = 0
  let skillControl: SkillProviderControl | undefined
  let skillCount = 0

  const remountClient = (): void => {
    // Mounts are serialized and awaited: the MCP client reserves its
    // `serverName` for as long as its fiber lives and rejects a second mount of
    // the same name, so a remount must not start before the previous fiber
    // finished disposing.
    mounting = mounting.then(async () => {
      if (disposeClient !== undefined) {
        const dispose = disposeClient
        disposeClient = undefined
        await dispose()
      }
      const active = resolved()
      if (!active.enabled) return
      const launch = buildLaunch(active)
      if (launch === undefined) {
        mountError = 'not-provisioned: ' + binaryPath()
        return
      }
      mountError = undefined
      mountCount += 1
      rememberSpawnBaseline()
      try {
        const fiber = ctx.inject(['tools'], (toolsCtx) => {
          try {
            toolsCtx.plugin(mcpClient, clientConfigFor(launch))
          } catch (error) {
            mountError = error instanceof Error ? error.message : String(error)
          }
        })
        disposeClient = async () => { await fiber.dispose() }
      } catch (error) {
        mountError = error instanceof Error ? error.message : String(error)
      }
    }).catch((error: unknown) => {
      mountError = error instanceof Error ? error.message : String(error)
    })
  }

  const provisionLogger: ProvisionLogger = () => {}

  const runSetupWithConfig = async (log: ProvisionLogger): Promise<SetupResult> => {
    const active = resolved()
    const result = await runSetup({
      policy: { allowMirror: active.allowMirrorDownload, mirror: active.downloadMirror },
      matlabRoot: active.matlabRoot === '' ? undefined : active.matlabRoot,
      installToolboxInto: true,
      registerSimulink: active.simulinkTools,
      log,
    })
    // Freshly synced toolkits change the skill catalog.
    skillControl?.invalidate()
    return result
  }

  const probe = async (deep: boolean): Promise<McpProbeResult> => {
    const active = resolved()
    const launch = buildLaunch(active)
    if (launch === undefined) {
      return { ok: false, error: '尚未安装 MATLAB MCP Server：请先点「一键安装/修复」 / not provisioned yet: run setup first', elapsedMs: 0 }
    }
    return await probeMcp({
      command: launch.command,
      args: launch.args,
      env: launch.env,
      cwd: launch.cwd,
      timeoutMs: deep ? 300_000 : 60_000,
      ...(deep
        ? {
            call: {
              name: 'evaluate_matlab_code',
              arguments: {
                code: 'disp("MATLAB " + version); t = ver; names = string({t.Name}); disp("Simulink present: " + any(names == "Simulink")); disp("toolbox count: " + numel(t))',
                project_path: launch.cwd,
              },
            },
          }
        : {}),
    })
  }

  ctx.effect(() => {
    const disposers = makeMatlabMcpRoutes({
      getConfig: () => resolved(),
      getState: async () => await inspectState(resolved().matlabRoot),
      launchConfig: () => {
        const launch = buildLaunch(resolved())
        return launch === undefined ? { provisioned: false, binary: binaryPath() } : launch
      },
      setup: async (log: ProvisionLogger) => await runSetupWithConfig(log),
      probe,
      reconnect: remountClient,
      diagnostics: () => ({ mountCount, mountError: mountError ?? null, skillGroups: skillCount, binary: binaryPath() }),
    }).map(route => ctx.webServer.register(route))
    return () => { for (const dispose of disposers) dispose() }
  }, 'matlab-mcp: host routes')

  // Toolkit skills ride DSH's own skill registry, so the model loads them with
  // the standard `skill` tool exactly like local project skills.
  ctx.inject(['skills'], (sctx) => {
    sctx.effect(() => {
      const dispose = sctx.skills.registerProvider((control) => {
        skillControl = control
        return createToolkitSkillProvider({
          control,
          getGroups: () => {
            const active = resolved()
            if (!active.enabled || !active.skillsEnabled) return []
            const groups = resolveSkillGroups(active.skillGroups)
            skillCount = groups.length
            return groups
          },
        })
      })
      return () => { dispose() }
    }, 'matlab-mcp: toolkit skills')
  })

  ctx.inject(['settings'], (sctx) => {
    sctx.effect(() => {
      const disposers = makeMatlabMcpSettingsRoutes(sctx.settings as unknown as SettingsBridge).map(route => ctx.webServer.register(route))
      return () => { for (const dispose of disposers) dispose() }
    }, 'matlab-mcp: settings bridge')
  })

  const sync = (): void => {
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    const active = resolved()
    remountClient()
    skillControl?.invalidate()
    if (active.enabled && active.announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:matlab-mcp',
        order: SECTION_ORDER,
        text: MATLAB_MCP_GUIDANCE,
      })
    }
  }

  ctx.inject(['settings'], (sctx) => {
    installSettingsSection(ctx, sctx, MATLAB_MCP_SETTINGS_NAMESPACE, Config, unwrapConfig(config ?? {}), {
      setSource: (source) => { current = () => unwrapConfig(source()) },
      onChange: () => { syncedBySettings = true; sync() },
    })
  })

  // Release the MATLAB this plugin started when the plugin goes away.
  ctx.effect(() => () => {
    if (!resolved().shutdownMatlabOnUnload) return
    void releaseOwnedMatlab(message => { provisionLogger(message) }).catch(() => {})
  }, 'matlab-mcp: MATLAB cleanup')

  if (!syncedBySettings) sync()
}
