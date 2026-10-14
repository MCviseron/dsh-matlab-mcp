/**
 * Filesystem layout, upstream artifact coordinates, and MATLAB installation
 * discovery. Every path this plugin writes lives under one cache root so the
 * whole footprint can be inspected or deleted as a unit.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, posix, win32 } from 'node:path'

/** DSH config root; mirrors `@deepseek-ai/dsh-skill-filesystem`'s default. */
/**
 * Path rules for the platform a path *belongs to* — not the host running this
 * code. A Windows MATLAB root must be split with win32 rules even in CI on
 * Linux, otherwise `dirname`/`join` treat the whole path as one segment.
 */
function pathApi(platform: string): typeof win32 {
  return platform === 'win32' ? win32 : posix
}

export function dshHome(): string {
  const fromEnv = process.env.DSH_HOME
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : join(homedir(), '.dsh')
}

/** Cache root for everything this plugin downloads. */
export function matlabCacheRoot(): string {
  return join(dshHome(), 'matlab-mcp')
}

/** Launch name of the MCP server binary for one platform/arch. */
export function binaryAssetName(platform: string = process.platform, arch: string = process.arch): string | undefined {
  if (platform === 'win32') return arch === 'x64' ? 'matlab-mcp-server-windows-x64.exe' : undefined
  if (platform === 'darwin') return arch === 'arm64' ? 'matlab-mcp-server-macos-arm64' : arch === 'x64' ? 'matlab-mcp-server-macos-x64' : undefined
  if (platform === 'linux') return arch === 'x64' ? 'matlab-mcp-server-linux-x64' : undefined
  return undefined
}

/** Absolute path the MCP server binary is provisioned to (platform-specific). */
export function binaryPath(platform?: string, arch?: string): string {
  const asset = binaryAssetName(platform, arch) ?? 'matlab-mcp-server-windows-x64.exe'
  return join(matlabCacheRoot(), 'bin', asset)
}

/** Absolute path of the downloaded MATLAB-side toolbox package. */
export function toolboxPath(): string {
  return join(matlabCacheRoot(), 'toolbox', 'MATLABMCPServerToolbox.mltbx')
}

/** Directory holding the two Agentic Toolkit checkouts. */
export function toolkitsDir(): string {
  return join(matlabCacheRoot(), 'toolkits')
}

/** Directories of the two toolkit checkouts. */
export function toolkitDirs(): { matlab: string; simulink: string } {
  return {
    matlab: join(toolkitsDir(), 'matlab-agentic-toolkit'),
    simulink: join(toolkitsDir(), 'simulink-agentic-toolkit'),
  }
}

/** Directory the MCP server writes its own logs to. */
export function logsDir(): string {
  return join(matlabCacheRoot(), 'logs')
}

/** Working root handed to MATLAB when the setting leaves it empty. */
export function defaultWorkspaceDir(): string {
  return join(matlabCacheRoot(), 'workspace')
}

/** Upstream artifact coordinates (MathWorks-official repositories only). */
export const MATLAB_MCP_SERVER_REPO = 'https://github.com/matlab/matlab-mcp-server'
export const MATLAB_MCP_SERVER_RELEASE_BASE = MATLAB_MCP_SERVER_REPO + '/releases/latest/download'
export const MATLAB_AGENTIC_TOOLKIT_REPO = 'https://github.com/matlab/matlab-agentic-toolkit'
export const SIMULINK_AGENTIC_TOOLKIT_REPO = 'https://github.com/matlab/simulink-agentic-toolkit'

/** MCP server name: every bridged tool is exposed as `mcp__matlab__<tool>`. */
export const MCP_SERVER_NAME = 'matlab'

/** Directories searched for MATLAB installations, best-effort per platform. */
export function matlabSearchDirs(platform: string = process.platform, env: NodeJS.ProcessEnv = process.env): string[] {
  if (platform === 'win32') {
    return [
      'C:\\Program Files\\MATLAB',
      'C:\\Program Files (x86)\\MATLAB',
      'D:\\Program Files\\MATLAB',
      'D:\\MATLAB',
      'C:\\MATLAB',
    ].filter(dir => dir !== undefined)
  }
  if (platform === 'darwin') return ['/Applications', join(homedir(), 'MATLAB')]
  return ['/usr/local/MATLAB', '/opt/MATLAB', join(homedir(), 'MATLAB'), ...(env.HOME !== undefined ? [join(env.HOME, 'MATLAB')] : [])]
}

/** Whether one directory is a MATLAB installation root (contains `<root>/bin/matlab[.exe]`). */
export function isMatlabRoot(dir: string, platform: string = process.platform): boolean {
  const exe = platform === 'win32' ? 'matlab.exe' : 'matlab'
  return existsSync(pathApi(platform).join(dir, 'bin', exe))
}

/** Parse a release directory name into a sortable rank (`R2025b`/`2025b` -> 20252). */
export function releaseRank(name: string): number {
  const match = /^[Rr]?(\d{4})([ab])$/.exec(name)
  if (match === null) return -1
  return Number(match[1]) * 10 + (match[2]!.toLowerCase() === 'b' ? 2 : 1)
}

/** MATLAB installations under the given search dirs, newest release first. */
export function listMatlabRoots(dirs: readonly string[] = matlabSearchDirs()): string[] {
  const found: string[] = []
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    if (isMatlabRoot(dir)) {
      found.push(dir)
      continue
    }
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const candidate = join(dir, entry)
      try {
        if (statSync(candidate).isDirectory() && isMatlabRoot(candidate)) found.push(candidate)
      } catch {
        continue
      }
    }
  }
  return found.sort((left, right) => releaseRank(right.split(/[\\/]/).pop() ?? '') - releaseRank(left.split(/[\\/]/).pop() ?? ''))
}

/** First `matlab`/`matlab.exe` reachable through a PATH-style string. */
export function findOnPath(pathValue: string | undefined, exeName: string, platform: string = process.platform): string | undefined {
  if (pathValue === undefined || pathValue === '') return undefined
  const api = pathApi(platform)
  for (const part of pathValue.split(api.delimiter)) {
    if (part === '') continue
    const candidate = api.join(part, exeName)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Resolve the MATLAB installation root the MCP server should be pointed at:
 * an explicit setting wins, then the newest installed release, then the
 * installation behind the `matlab` on PATH.
 */
export function pickMatlabRoot(options: {
  preferred?: string | undefined
  available?: string[]
  onPath?: string | undefined
  platform?: string
} = {}): string | undefined {
  const platform = options.platform ?? process.platform
  const preferred = options.preferred?.trim()
  if (preferred !== undefined && preferred !== '' && isMatlabRoot(preferred, platform)) return preferred
  // Sort here too: a caller-supplied list must not silently decide the winner.
  const available = [...(options.available ?? listMatlabRoots())].sort((left, right) =>
    releaseRank(right.split(/[\\/]/).pop() ?? '') - releaseRank(left.split(/[\\/]/).pop() ?? ''))
  if (available.length > 0) return available[0]
  const onPath = options.onPath === undefined
    ? findOnPath(process.env.PATH, platform === 'win32' ? 'matlab.exe' : 'matlab', platform)
    : (options.onPath.trim() === '' ? undefined : options.onPath)
  if (onPath === undefined) return undefined
  // `<root>/bin/matlab.exe` -> `<root>`, using the rules of that platform.
  return pathApi(platform).join(onPath, '..', '..')
}
