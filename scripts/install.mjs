#!/usr/bin/env node
/**
 * One-command onboarding for a DSH client.
 *
 * The plugin ships its build output (`lib/`) and inlines every runtime
 * dependency, so a fresh clone is loadable as-is — this script only has to wire
 * the clone into DSH:
 *
 *   1. Create the `<DSH_HOME>/matlab-mcp-plugin` junction pointing at this repo
 *      (a same-drive path, because pnpm mishandles `link:D:/...` from a C: profile).
 *   2. For every DSH profile that exists: add the dependency, add the bundle
 *      entry, and add the plugin row to `cordis.patch.yml`.
 *   3. Materialize the link — via `pnpm install` when pnpm is available, and in
 *      any case by repairing every dangling `link:` junction directly (which
 *      also heals the other local plugins a pnpm install would have broken).
 *
 * Usage:
 *   node scripts/install.mjs [--profile <name>] [--dry-run] [--skip-profile-install]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN = 'dsh-matlab-mcp'
const JUNCTION_NAME = 'matlab-mcp-plugin'
const CONFIG_ROW = [
  '- id: matlab-mcp',
  '  name: dsh-matlab-mcp',
  '  config:',
  '    enabled: true',
  '    announceToAgent: true',
  '    matlabRoot: ""',
  '    sessionMode: new',
  '    displayMode: desktop',
  '    initialWorkingFolder: ""',
  '    simulinkTools: true',
  '    skillsEnabled: true',
  '    skillGroups: ""',
  '    toolCallTimeoutMs: 600000',
  '    allowMirrorDownload: false',
  '    downloadMirror: https://ghproxy.net/',
  '    telemetry: false',
  '    shutdownMatlabOnUnload: true',
].join('\n')

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const skipProfileInstall = argv.includes('--skip-profile-install')
const rebuild = argv.includes('--rebuild')
const profileFlagIndex = argv.indexOf('--profile')
const onlyProfile = profileFlagIndex >= 0 ? argv[profileFlagIndex + 1] : undefined

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const isWindows = process.platform === 'win32'
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm'

const log = (message) => { console.log('[install] ' + message) }
const fail = (message) => { console.error('[install] ERROR: ' + message); process.exit(1) }

function run(command, args, cwd) {
  log('运行 / running: ' + command + ' ' + args.join(' ') + '   (cwd: ' + cwd + ')')
  if (dryRun) return
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: false })
}

/** Whether pnpm is usable; it is optional now that the plugin is self-contained. */
function hasPnpm() {
  try {
    execFileSync(pnpm, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Create a directory junction (Windows) or symlink (elsewhere). */
function linkDirectory(linkPath, targetPath) {
  log('创建联接 / creating link: ' + linkPath + ' -> ' + targetPath)
  if (dryRun) return
  mkdirSync(dirname(linkPath), { recursive: true })
  if (isWindows) execFileSync('cmd', ['/c', 'mklink', '/J', linkPath, targetPath], { stdio: 'inherit' })
  else symlinkSync(targetPath, linkPath, 'dir')
}

/** Resolve a `link:` spec to an absolute path. */
function linkTarget(spec) {
  return resolve(spec.slice('link:'.length))
}

// ------------------------------------------------- 1. build output (optional)
log('仓库 / repository: ' + repoDir)
if (!existsSync(join(repoDir, 'package.json'))) fail('这不是插件仓库目录 / not the plugin repository: ' + repoDir)
const libPath = join(repoDir, 'lib', 'index.js')
if (rebuild || !existsSync(libPath)) {
  if (!existsSync(libPath)) log('缺少 lib/index.js（应从仓库自带）；尝试从源码构建 / lib/index.js missing, building from source')
  run(pnpm, ['install'], repoDir)
  run(pnpm, ['build'], repoDir)
  if (!dryRun && !existsSync(libPath)) fail('构建后仍缺少 lib/index.js / lib/index.js still missing after build')
} else {
  log('构建产物已随仓库提供 / build output shipped with the repo: lib/index.js')
}

// ------------------------------------------------------- 2. DSH home junction
const homeLink = join(dshHome, JUNCTION_NAME)
if (existsSync(homeLink)) log('DSH 主目录联接已存在 / home link present: ' + homeLink)
else linkDirectory(homeLink, repoDir)

// ------------------------------------------------------------ 3. DSH profiles
const profilesRoot = join(dshHome, 'profiles')
if (!existsSync(profilesRoot)) fail('未找到 DSH profiles 目录 / no DSH profiles directory: ' + profilesRoot)
const profiles = readdirSync(profilesRoot)
  .filter(name => existsSync(join(profilesRoot, name, 'package.json')))
  .filter(name => onlyProfile === undefined || name === onlyProfile)
if (profiles.length === 0) fail('没有可用的 profile / no usable profile under ' + profilesRoot)

const homeLinkSpec = 'link:' + homeLink.split('\\').join('/')
const pnpmAvailable = dryRun ? true : hasPnpm()
if (!pnpmAvailable) log('未找到 pnpm —— 将直接创建联接（插件已自包含，无需安装依赖）/ pnpm not found, linking directly')

for (const name of profiles) {
  const dir = join(profilesRoot, name)
  const pkgPath = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  let changed = false

  pkg.dependencies ??= {}
  if (pkg.dependencies[PLUGIN] !== homeLinkSpec) {
    log('[' + name + '] dependency ' + PLUGIN + ' -> ' + homeLinkSpec)
    pkg.dependencies[PLUGIN] = homeLinkSpec
    changed = true
  }
  const bundles = pkg.dsh?.profile?.bundles
  if (Array.isArray(bundles) && !bundles.includes(PLUGIN)) {
    log('[' + name + '] bundle += ' + PLUGIN)
    bundles.push(PLUGIN)
    changed = true
  }
  if (changed && !dryRun) writeFileSync(pkgPath, JSON.stringify(pkg, undefined, 2) + '\n', 'utf8')

  const patchPath = join(dir, 'cordis.patch.yml')
  const patch = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
  if (!/^\s*-\s*id:\s*matlab-mcp\s*$/m.test(patch)) {
    log('[' + name + '] cordis.patch.yml += matlab-mcp 行')
    if (!dryRun) writeFileSync(patchPath, patch.replace(/\s*$/, '') + '\n' + CONFIG_ROW + '\n', 'utf8')
  } else {
    log('[' + name + '] cordis.patch.yml 已包含 matlab-mcp 行')
  }

  if (pnpmAvailable && !skipProfileInstall) run(pnpm, ['install'], dir)

  // Materialize (and heal) every `link:` junction. pnpm resolves cross-drive
  // links against the profile directory, which the OS then cannot follow — the
  // symptom is every local plugin failing to activate after a restart.
  const nodeModules = join(dir, 'node_modules')
  for (const [dep, spec] of Object.entries(pkg.dependencies ?? {})) {
    if (typeof spec !== 'string' || !spec.startsWith('link:')) continue
    const linked = join(nodeModules, dep)
    if (existsSync(join(linked, 'package.json'))) continue
    const target = linkTarget(spec)
    if (!existsSync(join(target, 'package.json'))) {
      log('[' + name + '] 跳过 / skip ' + dep + '（目标不存在 ' + target + '）')
      continue
    }
    log('[' + name + '] 建立/修复联接 / linking: ' + dep)
    if (!dryRun && isWindows) {
      try { execFileSync('cmd', ['/c', 'rmdir', linked], { stdio: 'inherit' }) } catch { /* not a link */ }
      execFileSync('cmd', ['/c', 'mklink', '/J', linked, target], { stdio: 'inherit' })
    }
  }

  const ready = existsSync(join(nodeModules, PLUGIN, 'lib', 'index.js'))
  log('[' + name + '] 校验 / check: ' + (dryRun ? '(dry-run)' : ready ? 'OK' : '仍不可用，请检查 ' + join(nodeModules, PLUGIN)))
}

log('')
log('完成 / done. 接下来 / next:')
log('  1. 重启 DeepSeek Harness（插件清单在启动时读取）')
log('  2. 设置 → MATLAB / Simulink MCP → 点「一键安装 / 修复」')
log('  3. 会话里应出现 mcp__matlab__*（14 个工具）与 matlab-*/simulink-* 技能')
