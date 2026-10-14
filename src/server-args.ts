/**
 * The exact argument vector handed to the official MATLAB MCP Server, kept pure
 * so it can be asserted in tests without touching MATLAB or the network.
 *
 * Reference: https://github.com/matlab/matlab-mcp-server#arguments
 */
import { MCP_SERVER_NAME } from './paths.ts'

/** Which MATLAB the server talks to. */
export const SESSION_MODES = ['new', 'auto', 'existing'] as const
export type SessionMode = typeof SESSION_MODES[number]

/** Whether MATLAB shows its desktop while the agent works. */
export const DISPLAY_MODES = ['desktop', 'nodesktop'] as const
export type DisplayMode = typeof DISPLAY_MODES[number]

export interface ServerArgsInput {
  matlabRoot?: string | undefined
  sessionMode: SessionMode
  displayMode: DisplayMode
  initialWorkingFolder?: string | undefined
  logFolder?: string | undefined
  /** Absolute path of a Simulink Agentic Toolkit `tools.json` extension file. */
  extensionFiles?: readonly string[] | undefined
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | undefined
  /** Whether anonymized MathWorks telemetry stays enabled (default: disabled). */
  telemetry?: boolean | undefined
  /** Start MATLAB during server startup instead of on the first tool call. */
  initializeOnStartup?: boolean | undefined
}

/**
 * Build the launch arguments. `--matlab-session-mode=existing` must not be
 * combined with `--matlab-root`/`--initial-working-folder`/`--matlab-display-mode`
 * (the upstream documentation rejects that combination), so those three are
 * omitted in that mode.
 */
export function buildServerArgs(input: ServerArgsInput): string[] {
  const args: string[] = []
  const existing = input.sessionMode === 'existing'
  if (!existing && input.matlabRoot !== undefined && input.matlabRoot !== '') args.push('--matlab-root=' + input.matlabRoot)
  args.push('--matlab-session-mode=' + input.sessionMode)
  if (!existing) args.push('--matlab-display-mode=' + input.displayMode)
  if (!existing && input.initialWorkingFolder !== undefined && input.initialWorkingFolder !== '') {
    args.push('--initial-working-folder=' + input.initialWorkingFolder)
  }
  for (const file of input.extensionFiles ?? []) args.push('--extension-file=' + file)
  if (input.logFolder !== undefined && input.logFolder !== '') args.push('--log-folder=' + input.logFolder)
  args.push('--log-level=' + (input.logLevel ?? 'info'))
  args.push('--disable-telemetry=' + (input.telemetry === true ? 'false' : 'true'))
  if (input.initializeOnStartup === true) args.push('--initialize-matlab-on-startup=true')
  return args
}

/**
 * Environment handed to the MCP server child.
 *
 * `@deepseek-ai/dsh-mcp-client` starts the child from `scrubbedParentEnv()`
 * plus this map, so anything the child genuinely needs must be listed here.
 * On Windows MATLAB and Simulink need the system roots and `PATH`; the upstream
 * Simulink toolkit documents that agents which strip environment variables from
 * MCP subprocesses break Simulink, so these are passed explicitly.
 */
export function buildServerEnv(source: NodeJS.ProcessEnv = process.env, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = { ...extra }
  const passthrough = [
    'PATH',
    'Path',
    'SystemRoot',
    'SystemDrive',
    'windir',
    'WINDIR',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'USERNAME',
    'COMPUTERNAME',
    'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE',
    'ProgramData',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'ProgramW6432',
    'CommonProgramFiles',
    'LOCALAPPDATA',
    'APPDATA',
    'HOMEDRIVE',
    'HOMEPATH',
    'HOME',
    'LANG',
    'TZ',
  ]
  for (const name of passthrough) {
    const value = source[name]
    if (typeof value === 'string' && value !== '' && env[name] === undefined) env[name] = value
  }
  return env
}

/** The MCP namespace every bridged tool appears under (`mcp__matlab__<tool>`). */
export const SERVER_NAME = MCP_SERVER_NAME

/**
 * Arguments for opening a MATLAB desktop window from the chat UI.
 *
 * `new` mode owns its own MATLAB, so the button opens a plain desktop. `auto`
 * and `existing` attach to a *shared* MATLAB session, so the window is opened
 * with `shareMATLABSession` — the same session the MCP server then connects to,
 * which is what makes the agent's work visible in the window the user opened.
 */
export function buildMatlabDesktopArgs(sessionMode: SessionMode): string[] {
  return sessionMode === 'new' ? [] : ['-r', 'shareMATLABSession']
}
