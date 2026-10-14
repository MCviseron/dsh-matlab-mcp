/**
 * MATLAB process cleanup.
 *
 * The official MCP server starts MATLAB itself, and killing the server does NOT
 * stop that MATLAB (verified: after the probe client exited, a MATLAB process
 * from the same run kept running). Leaving it behind would accumulate desktop
 * windows and licenses across plugin reloads, so the plugin tracks which MATLAB
 * processes descend from *its* MCP server binary and stops only those.
 *
 * Ownership is decided by process parentage, never by name alone: a MATLAB the
 * user started by hand is never touched.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { binaryPath } from './paths.ts'

const run = promisify(execFile)

export interface ProcessRow {
  ProcessId: number
  ParentProcessId: number
  Name: string
  ExecutablePath?: string | null
}

/** PIDs of MATLAB processes that were already running when this plugin started. */
const preexisting = new Set<number>()
let baselineCaptured = false

/** Record the MATLAB processes that existed before this plugin spawned anything. */
export function rememberSpawnBaseline(): void {
  if (baselineCaptured) return
  baselineCaptured = true
  void listProcesses().then(rows => {
    for (const row of rows) if (isMatlab(row)) preexisting.add(row.ProcessId)
  }).catch(() => {})
}

function isMatlab(row: ProcessRow): boolean {
  return /^matlab(\.exe)?$/i.test(row.Name)
}

/** All processes visible to the current user, or `[]` when the query fails. */
export async function listProcesses(): Promise<ProcessRow[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await run('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath | ConvertTo-Json -Compress',
    ], { timeout: 20_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
    const trimmed = stdout.trim()
    if (trimmed === '') return []
    const parsed = JSON.parse(trimmed) as ProcessRow | ProcessRow[]
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

/**
 * MATLAB PIDs reachable from any process running the given executable — the MCP
 * server binary and, through it, the MATLAB it launched.
 */
export function ownedMatlabPids(rows: readonly ProcessRow[], serverExe: string, protected_Pids: ReadonlySet<number> = preexisting): number[] {
  const target = serverExe.toLowerCase()
  const roots = rows.filter(row => typeof row.ExecutablePath === 'string' && row.ExecutablePath.toLowerCase() === target).map(row => row.ProcessId)
  if (roots.length === 0) return []
  const childrenOf = new Map<number, number[]>()
  for (const row of rows) {
    const list = childrenOf.get(row.ParentProcessId)
    if (list === undefined) childrenOf.set(row.ParentProcessId, [row.ProcessId])
    else list.push(row.ProcessId)
  }
  const owned: number[] = []
  const queue = [...roots]
  const seen = new Set<number>(roots)
  while (queue.length > 0) {
    const pid = queue.shift()!
    for (const child of childrenOf.get(pid) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      queue.push(child)
      const row = rows.find(candidate => candidate.ProcessId === child)
      if (row !== undefined && isMatlab(row) && !protected_Pids.has(child)) owned.push(child)
    }
  }
  return owned
}

/** Force-stop one process tree; resolves with whether the call succeeded. */
async function killTree(pid: number): Promise<boolean> {
  try {
    await run('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 20_000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

/**
 * Stop the MATLAB processes this plugin's MCP server started. Called when the
 * plugin unloads or when the user asks for it; never throws.
 */
export async function releaseOwnedMatlab(log: (message: string) => void): Promise<number[]> {
  if (process.platform !== 'win32') return []
  const rows = await listProcesses()
  const pids = ownedMatlabPids(rows, binaryPath())
  if (pids.length === 0) {
    log('没有发现本插件启动的 MATLAB 进程 / no MATLAB process owned by this plugin')
    return []
  }
  const killed: number[] = []
  for (const pid of pids) {
    log('关闭 MATLAB 进程 / stopping MATLAB pid ' + pid)
    if (await killTree(pid)) killed.push(pid)
  }
  return killed
}
