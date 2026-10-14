#!/usr/bin/env node
/**
 * One-command onboarding for a NEW DSH client.
 *
 * Why this exists: the repository intentionally does not ship build output
 * (`lib/` is git-ignored) and the plugin resolves `@deepseek-ai/*` from its own
 * `node_modules`. On a fresh clone that means DSH reports
 * `matlab-mcp (dsh-matlab-mcp): failed to import` until dependencies are
 * installed and `lib/` is built. This script does the whole sequence, including
 * the profile wiring, and is safe to re-run.
 *
 * Usage:
 *   node scripts/install.mjs [--profile <name>] [--dry-run] [--skip-profile-install]
 *
 * Steps:
 *   1. `pnpm install` inside this repository (installs deps; `prepare` builds lib/).
 *   2. Create the `<DSH_HOME>/matlab-mcp-plugin` junction pointing at this repo —
 *      a same-drive path, because pnpm mishandles `link:D:/...` from a C: profile.
 *   3. For every DSH profile that exists: add the dependency, add the bundle
 *      entry, and add the plugin row to `cordis.patch.yml`.
 *   4. `pnpm install` in those profiles, then repair every `link:` junction that
 *      pnpm left dangling (it does this for cross-drive targets) — including the
 *      other local plugins, so the profile keeps working.
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
const profileFlagIndex = argv.indexOf('--profile')
const onlyProfile = profileFlagIndex >= 0 ? argv[profileFlagIndex + 1] : undefined

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const isWindows = process.platform === 'win32'
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm'

const log = (message) => { console.log('[install] ' + message) }
const fail = (message) => { console.error('[install] ERROR: ' + message); process.exit(1) }

/** pnpm must exist before anything else runs; DSH ships one if the user has none. */
function requirePnpm() {
  if (dryRun) return
  try {
    execFileSync(pnpm, ['--version'], { stdio: 'ignore' })
    return
  } catch {
    fail(
      '未找到 pnpm。请安装：npm i -g pnpm；或使用 DSH 自带的 pnpm：\n'
      + '  node "<DeepSeek Harness>/resources/runtime/pnpm/bin/pnpm.mjs" install\n'
      + 'pnpm was not found. Install it (npm i -g pnpm) or use the pnpm bundled with DSH.',
    )
  }
}
requirePnpm()

function run(command, args, cwd) {
  log('运行 / running: ' + command + ' ' + args.join(' ') + '   (cwd: ' + cwd + ')')
  if (dryRun) return
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: false })
}

/** Create a directory junction (Windows) or symlink (elsewhere). */
function linkDirectory(linkPath, targetPath) {
  log('创建联接 / creating link: ' + linkPath + ' -> ' + targetPath)
  if (dryRun) return
  mkdirSync(dirname(linkPath), { recursive: true })
  if (isWindows) execFileSync('cmd', ['/c', 'mklink', '/J', linkPath, targetPath], { stdio: 'inherit' })
  else symlinkSync(targetPath, linkPath, 'dir')
}

// ---------------------------------------------------------------- 1. build
log('仓库 / repository: ' + repoDir)
if (!existsSync(join(repoDir, 'package.json'))) fail('这不是插件仓库目录 / not the plugin repository: ' + repoDir)
run(pnpm, ['install'], repoDir)
if (!dryRun && !existsSync(join(repoDir, 'lib', 'index.js'))) {
  fail('lib/index.js 不存在：请运行 `pnpm build` 并查看报错 / lib/index.js is missing; run `pnpm build` and read the error')
}
log('构建产物 / build output: ' + (dryRun ? '(dry-run)' : 'lib/index.js OK'))

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

/** Resolve a `link:` spec to an absolute path the way pnpm records it. */
function linkTarget(spec) {
  const raw = spec.slice('link:'.length)
  return resolve(raw)
}

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

  if (!skipProfileInstall) run(pnpm, ['install'], dir)

  // Repair every dangling `link:` junction this install may have produced —
  // pnpm resolves cross-drive links against the profile directory, which the
  // OS then cannot follow. Re-linking keeps the whole profile loadable.
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
    log('[' + name + '] 修复失效联接 / repairing dangling link: ' + dep)
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
