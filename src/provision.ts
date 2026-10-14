/**
 * One-click provisioning of everything the bridge needs.
 *
 * Nothing here requires the user to touch MATLAB or a terminal:
 *   1. the MathWorks MCP server binary (release asset, integrity-checked),
 *   2. the MATLAB-side toolbox package that provides `shareMATLABSession`,
 *   3. the two MathWorks Agentic Toolkit checkouts (skills + Simulink tools),
 *   4. the MATLAB path entry that makes the Simulink toolkit functions visible.
 *
 * Every step is idempotent: it reuses what is already on disk and only reports
 * what it changed, so "一键安装/修复" can be pressed any number of times.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  downloadWithFallback,
  hasMagic,
  PE_MAGIC,
  ZIP_MAGIC,
  type DownloadPolicy,
} from './download.ts'
import {
  MATLAB_AGENTIC_TOOLKIT_REPO,
  MATLAB_MCP_SERVER_RELEASE_BASE,
  SIMULINK_AGENTIC_TOOLKIT_REPO,
  binaryAssetName,
  binaryPath,
  defaultWorkspaceDir,
  listMatlabRoots,
  logsDir,
  matlabCacheRoot,
  pickMatlabRoot,
  toolboxPath,
  toolkitDirs,
  toolkitsDir,
} from './paths.ts'

const run = promisify(execFile)

/** Progress sink: the Host route forwards these lines to the settings card. */
export type ProvisionLogger = (message: string) => void

export interface ToolkitState {
  name: string
  repo: string
  dir: string
  present: boolean
}

export interface ProvisionState {
  home: string
  binary: { path: string; present: boolean; version?: string; bytes?: number }
  toolbox: { path: string; present: boolean; bytes?: number }
  toolkits: ToolkitState[]
  simulink: { extensionFile: string; present: boolean }
  matlab: { root?: string; candidates: string[] }
  ready: boolean
}

/** Where the MCP server writes its own log files. */
export function serverLogFolder(): string {
  return logsDir()
}

/** Working folder handed to MATLAB when the setting leaves it empty. */
export function resolvedWorkspace(configured: string | undefined): string {
  const trimmed = configured?.trim()
  return trimmed !== undefined && trimmed !== '' ? trimmed : defaultWorkspaceDir()
}

/** Absolute path of the Simulink Agentic Toolkit extension file (MCP custom tools). */
export function simulinkExtensionFile(): string {
  return join(toolkitsDir(), 'simulink-agentic-toolkit', 'tools', 'tools.json')
}

async function sizeOf(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).size
  } catch {
    return undefined
  }
}

/** Parse the release version out of `--version` output. */
export function parseServerVersion(output: string): string | undefined {
  const match = /v(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/.exec(output)
  return match?.[1]
}

/** Run the MCP server binary with `--version`; `undefined` when it does not run. */
export async function probeServerVersion(binary: string, timeoutMs = 15_000): Promise<{ version?: string; error?: string }> {
  if (!existsSync(binary)) return { error: 'binary not found: ' + binary }
  try {
    const { stdout, stderr } = await run(binary, ['--version'], { timeout: timeoutMs, windowsHide: true })
    const version = parseServerVersion(stdout + stderr)
    return version === undefined ? { error: 'unexpected --version output: ' + (stdout + stderr).trim().slice(0, 200) } : { version }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** Current on-disk state; cheap enough to call from a status route. */
export async function inspectState(configuredRoot?: string): Promise<ProvisionState> {
  const binary = binaryPath()
  const toolbox = toolboxPath()
  const dirs = toolkitDirs()
  const matlabCandidates = listMatlabRoots()
  const root = pickMatlabRoot({ preferred: configuredRoot, available: matlabCandidates })
  const binaryPresent = existsSync(binary)
  const toolboxPresent = existsSync(toolbox)
  const toolkits: ToolkitState[] = [
    { name: 'matlab-agentic-toolkit', repo: MATLAB_AGENTIC_TOOLKIT_REPO, dir: dirs.matlab, present: existsSync(join(dirs.matlab, 'skills-catalog')) },
    { name: 'simulink-agentic-toolkit', repo: SIMULINK_AGENTIC_TOOLKIT_REPO, dir: dirs.simulink, present: existsSync(join(dirs.simulink, 'skills-catalog')) },
  ]
  const extensionFile = simulinkExtensionFile()
  const extensionPresent = existsSync(extensionFile)
  const version = binaryPresent ? (await probeServerVersion(binary)).version : undefined
  return {
    home: matlabCacheRoot(),
    binary: { path: binary, present: binaryPresent, ...(version === undefined ? {} : { version }), ...(await sizeOf(binary) === undefined ? {} : { bytes: await sizeOf(binary) }) },
    toolbox: { path: toolbox, present: toolboxPresent, ...(await sizeOf(toolbox) === undefined ? {} : { bytes: await sizeOf(toolbox) }) },
    toolkits,
    simulink: { extensionFile, present: extensionPresent },
    matlab: { ...(root === undefined ? {} : { root }), candidates: matlabCandidates },
    ready: binaryPresent && toolboxPresent && toolkits.every(toolkit => toolkit.present),
  }
}

/** Download + verify the MCP server binary; reuses a working copy. */
export async function ensureBinary(policy: DownloadPolicy, log: ProvisionLogger, signal?: AbortSignal): Promise<{ path: string; version?: string; downloaded: boolean }> {
  const target = binaryPath()
  const asset = binaryAssetName()
  if (asset === undefined) throw new Error('此平台没有官方 MATLAB MCP Server 预编译产物 / no official MATLAB MCP Server build for this platform')
  if (existsSync(target)) {
    const probe = await probeServerVersion(target)
    if (probe.version !== undefined) {
      log('已存在 MCP 服务器 / MCP server present: v' + probe.version)
      return { path: target, version: probe.version, downloaded: false }
    }
    // Never delete a binary that might still be in use: the staged download
    // swaps over it only after the new file proved usable, and a swap that
    // cannot replace a running image fails loudly instead of leaving nothing.
    log('已存在的二进制不可用，将用暂存下载替换 / existing binary unusable, replacing via staged download: ' + (probe.error ?? ''))
  }
  const url = MATLAB_MCP_SERVER_RELEASE_BASE + '/' + asset
  const result = await downloadWithFallback(url, target, policy, {
    signal,
    log,
    validate: async (path) => {
      if (process.platform === 'win32' && !await hasMagic(path, PE_MAGIC)) throw new Error('not a Windows executable (MZ magic missing)')
    },
  })
  if (process.platform !== 'win32') await run('chmod', ['+x', target]).catch(() => {})
  const probe = await probeServerVersion(target)
  if (probe.version === undefined) {
    throw new Error(
      'MCP 服务器下载后无法运行 / the downloaded MCP server does not run: ' + (probe.error ?? 'unknown')
      + '\n文件 / file: ' + target
      + '\n常见原因：杀毒软件隔离了它（把该目录加入白名单后重试）/ usual cause: antivirus quarantine of the fresh executable.',
    )
  }
  log('已下载 MCP 服务器 / MCP server downloaded: v' + probe.version + ' (' + result.bytes + ' bytes' + (result.mirrored ? ', via mirror' : '') + ')')
  return { path: target, version: probe.version, downloaded: true }
}

/** Download the MATLAB-side toolbox package (`shareMATLABSession` provider). */
export async function ensureToolbox(policy: DownloadPolicy, log: ProvisionLogger, signal?: AbortSignal): Promise<{ path: string; downloaded: boolean }> {
  const target = toolboxPath()
  if (existsSync(target) && await hasMagic(target, ZIP_MAGIC)) {
    log('已存在 MATLAB 端工具箱 / MATLAB toolbox present')
    return { path: target, downloaded: false }
  }
  const url = MATLAB_MCP_SERVER_RELEASE_BASE + '/MATLABMCPServerToolbox.mltbx'
  const result = await downloadWithFallback(url, target, policy, {
    signal,
    log,
    validate: async (path) => {
      if (!await hasMagic(path, ZIP_MAGIC)) throw new Error('not an .mltbx package (zip magic missing)')
    },
  })
  log('已下载 MATLAB 端工具箱 / MATLAB toolbox downloaded (' + result.bytes + ' bytes' + (result.mirrored ? ', via mirror' : '') + ')')
  return { path: target, downloaded: true }
}

async function gitAvailable(): Promise<boolean> {
  try {
    await run('git', ['--version'], { timeout: 10_000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function cloneOrUpdate(repo: string, dir: string, log: ProvisionLogger, signal?: AbortSignal): Promise<void> {
  await mkdir(join(dir, '..'), { recursive: true })
  if (existsSync(join(dir, '.git'))) {
    log('更新技能仓 / updating ' + repo)
    await run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', 'main'], { timeout: 600_000, windowsHide: true })
    await run('git', ['-C', dir, 'reset', '--hard', 'FETCH_HEAD'], { timeout: 120_000, windowsHide: true })
    return
  }
  log('克隆技能仓 / cloning ' + repo)
  await rm(dir, { recursive: true, force: true })
  await run('git', ['clone', '--depth', '1', '--branch', 'main', repo, dir], { timeout: 900_000, windowsHide: true })
  if (signal?.aborted === true) throw new Error('aborted')
}

async function zipFallback(repo: string, dir: string, policy: DownloadPolicy, log: ProvisionLogger, signal?: AbortSignal): Promise<void> {
  const archive = join(dir + '.zip')
  log('下载技能仓压缩包 / downloading toolkit archive (zipball)')
  await downloadWithFallback(repo + '/archive/refs/heads/main.zip', archive, policy, { signal, log, validate: async (path) => {
    if (!await hasMagic(path, ZIP_MAGIC)) throw new Error('not a zip archive')
  } })
  const staging = dir + '.extract'
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  await run('tar', ['-xf', archive, '-C', staging], { timeout: 300_000, windowsHide: true })
  const entries = await readdir(staging)
  const root = entries.find(entry => entry.endsWith('-main')) ?? entries[0]
  if (root === undefined) throw new Error('archive contained no directory')
  // Swap only after the archive extracted successfully, and keep the previous
  // checkout until the new one is in place: a failed toolkit fetch must never
  // leave the cache without a usable skills-catalog.
  const previous = dir + '.previous'
  await rm(previous, { recursive: true, force: true })
  if (existsSync(dir)) await rename(dir, previous)
  await rename(join(staging, root), dir)
  await rm(staging, { recursive: true, force: true })
  await rm(previous, { recursive: true, force: true })
  await rm(archive, { force: true })
}

/** Clone or refresh both Agentic Toolkits (skills + Simulink MCP tools). */
export async function ensureToolkits(policy: DownloadPolicy, log: ProvisionLogger, signal?: AbortSignal): Promise<ToolkitState[]> {
  const dirs = toolkitDirs()
  const repos: Array<{ name: string; repo: string; dir: string }> = [
    { name: 'matlab-agentic-toolkit', repo: MATLAB_AGENTIC_TOOLKIT_REPO, dir: dirs.matlab },
    { name: 'simulink-agentic-toolkit', repo: SIMULINK_AGENTIC_TOOLKIT_REPO, dir: dirs.simulink },
  ]
  const usableGit = await gitAvailable()
  // A codeload zipball through a mirror is ~10x the direct git-clone rate
  // (measured 9.5 MB/s vs 0.15 MB/s on the target machine), so when the user
  // enabled mirrors the zipball is the primary path and git clone is the
  // fallback; without mirrors the order is reversed.
  const order: Array<'zip' | 'git'> = policy.allowMirror ? ['zip', 'git'] : ['git', 'zip']
  const states: ToolkitState[] = []
  for (const entry of repos) {
    const failures: string[] = []
    for (const step of order) {
      try {
        if (step === 'git') {
          if (!usableGit) throw new Error('git 不可用 / git not available')
          await cloneOrUpdate(entry.repo, entry.dir, log, signal)
        } else {
          await zipFallback(entry.repo, entry.dir, policy, log, signal)
        }
        failures.length = 0
        break
      } catch (error) {
        const message = step + ': ' + (error instanceof Error ? error.message : String(error))
        failures.push(message)
        log('技能仓获取失败，尝试下一种方式 / toolkit fetch failed, trying the next way: ' + message)
      }
    }
    if (failures.length > 0) throw new Error('技能仓获取失败 / toolkit fetch failed: ' + failures.join(' | '))
    states.push({ ...entry, present: existsSync(join(entry.dir, 'skills-catalog')) })
  }
  return states
}

/** MATLAB executable inside one installation root. */
export function matlabExecutable(root: string, platform: string = process.platform): string {
  return join(root, 'bin', platform === 'win32' ? 'matlab.exe' : 'matlab')
}

export interface MatlabBatchResult {
  ok: boolean
  stdout: string
  stderr: string
  error?: string
}

/**
 * Run one `matlab -batch` snippet (no desktop, exit code is meaningful).
 *
 * The snippet is written to a temporary `.m` file and invoked **by script name**
 * rather than passed as `-batch "<code>"`: on Windows MATLAB's command-line
 * parser mangles inner double quotes (verified: `disp("x")` arrives split at
 * spaces and the quotes vanish), so a file name — a single token with no quotes
 * — is the only form that survives arbitrary code.
 */
export async function runMatlabBatch(root: string, code: string, timeoutMs = 600_000): Promise<MatlabBatchResult> {
  const dir = join(matlabCacheRoot(), 'tmp')
  await mkdir(dir, { recursive: true })
  const scriptName = 'dsh_matlab_step_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)
  const scriptPath = join(dir, scriptName + '.m')
  await writeFile(scriptPath, code.endsWith('\n') ? code : code + '\n', 'utf8')
  try {
    const { stdout, stderr } = await run(matlabExecutable(root), ['-batch', scriptName], {
      timeout: timeoutMs,
      cwd: dir,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true, stdout, stderr }
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '', error: failure.message ?? String(error) }
  } finally {
    await rm(scriptPath, { force: true })
  }
}

/** Install the downloaded `.mltbx` into the selected MATLAB (idempotent). */
export async function installToolbox(root: string, mltbx: string, log: ProvisionLogger): Promise<MatlabBatchResult> {
  if (!existsSync(mltbx)) throw new Error('toolbox package missing: ' + mltbx)
  log('安装 MATLAB 端工具箱 / installing MATLAB toolbox into ' + root)
  const code = 'matlab.addons.toolbox.installToolbox(' + quoteMatlab(mltbx) + '); disp("DSH_MATLAB_MCP_TOOLBOX_OK")'
  const result = await runMatlabBatch(root, code, 900_000)
  const ok = result.ok && result.stdout.includes('DSH_MATLAB_MCP_TOOLBOX_OK')
  log(ok ? '工具箱安装完成 / toolbox installed' : '工具箱安装失败 / toolbox install failed: ' + (result.stderr || result.stdout || result.error || '').trim().slice(-300))
  return { ...result, ok }
}

/** Single-quote a path for MATLAB source. */
export function quoteMatlab(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'"
}

/** Make the Simulink Agentic Toolkit MATLAB functions visible to every session. */
export async function registerSimulinkPaths(root: string, log: ProvisionLogger): Promise<MatlabBatchResult> {
  const dirs = toolkitDirs()
  const tools = join(dirs.simulink, 'tools')
  log('注册 Simulink 工具包路径 / registering Simulink toolkit path')
  const code = [
    'addpath(genpath(' + quoteMatlab(tools) + '));',
    'status = savepath;',
    'disp("DSH_MATLAB_MCP_PATHS_OK " + string(status))',
  ].join(' ')
  const result = await runMatlabBatch(root, code, 300_000)
  const saved = result.stdout.includes('DSH_MATLAB_MCP_PATHS_OK 0')
  log(saved ? '路径已保存 / path saved' : '路径保存失败 / path save failed: ' + (result.stderr || result.stdout || result.error || '').trim().slice(-300))
  return result
}

export interface SetupOptions {
  policy: DownloadPolicy
  matlabRoot?: string | undefined
  /** Working folder handed to MATLAB (created if missing). */
  workingFolder?: string | undefined
  installToolboxInto: boolean
  registerSimulink: boolean
  log: ProvisionLogger
  signal?: AbortSignal | undefined
}

export interface SetupResult {
  binary: { path: string; version?: string; downloaded: boolean }
  toolbox: { path: string; downloaded: boolean }
  toolkits: ToolkitState[]
  matlab: { root?: string | undefined; toolboxInstall?: MatlabBatchResult; simulinkPaths?: MatlabBatchResult }
  state: ProvisionState
}

/** The one-click install/repair path behind `POST /api/dsh-matlab-mcp/setup`. */
export async function runSetup(options: SetupOptions): Promise<SetupResult> {
  const { log } = options
  await mkdir(matlabCacheRoot(), { recursive: true })
  await mkdir(logsDir(), { recursive: true })
  // The workspace and log folders are the launch's `cwd` and `--log-folder`:
  // a missing `cwd` makes the spawn fail with a misleading `spawn <exe> ENOENT`
  // that used to take the host process down, so they are created up front.
  await mkdir(resolvedWorkspace(options.workingFolder), { recursive: true })
  const binary = await ensureBinary(options.policy, log, options.signal)
  const toolbox = await ensureToolbox(options.policy, log, options.signal)
  const toolkits = await ensureToolkits(options.policy, log, options.signal)
  const root = pickMatlabRoot({ preferred: options.matlabRoot })
  let toolboxInstall: MatlabBatchResult | undefined
  let simulinkPaths: MatlabBatchResult | undefined
  if (root !== undefined && options.installToolboxInto) toolboxInstall = await installToolbox(root, toolbox.path, log)
  if (root !== undefined && options.registerSimulink) simulinkPaths = await registerSimulinkPaths(root, log)
  if (root === undefined) log('未找到 MATLAB 安装，跳过 MATLAB 侧步骤 / no MATLAB installation found, skipping MATLAB-side steps')
  const state = await inspectState(options.matlabRoot)
  return {
    binary,
    toolbox,
    toolkits,
    matlab: { root, ...(toolboxInstall === undefined ? {} : { toolboxInstall }), ...(simulinkPaths === undefined ? {} : { simulinkPaths }) },
    state,
  }
}
