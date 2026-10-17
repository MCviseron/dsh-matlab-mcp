#!/usr/bin/env node
/**
 * Compare the installed DeepSeek Harness against the newest build on its update
 * feed, and check whether the host APIs this plugin relies on have changed.
 *
 * The contract we care about is deliberately narrow: the nine entry files this
 * plugin actually calls into (see docs/dsh-compat.json). Each is fingerprinted
 * byte-for-byte; "unchanged" therefore means "the code we call is the same code
 * we verified", which is much stronger than comparing version numbers.
 *
 *   node scripts/check-dsh-version.mjs                 # human summary
 *   node scripts/check-dsh-version.mjs --json          # machine summary
 *   node scripts/check-dsh-version.mjs --channel stable
 *   node scripts/check-dsh-version.mjs --app-dir "D:/DeepSeek Harness"
 *   node scripts/check-dsh-version.mjs --no-download   # installed vs feed only
 *
 * Exit codes
 *   0  nothing to do for the plugin: either already newest, or the newer build is
 *      already covered by our peerDependencies and the contract is unchanged
 *   2  a newer build exists, the contract is unchanged, but our peer ranges do not
 *      cover it yet (widen the ranges + release)
 *   3  contract files changed  -> human review required
 *   1  the check itself could not complete (network/IO)
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const DEFAULT_FEED = 'https://download.deepseek.com/dsh-desk/feeds/win-x64/'
const CACHE = join(homedir(), 'AppData', 'Local', 'Temp', 'dsh-compat-cache')

const argv = process.argv.slice(2)
const has = (flag) => argv.includes('--' + flag)
const flag = (name, fallback) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const asJson = has('json')
const channel = flag('channel', 'nightly')
const appDir = flag('app-dir', '')
const wantDownload = !has('no-download')

const log = (line) => { if (!asJson) console.log(line) }
const fail = (message) => { console.error((asJson ? JSON.stringify({ ok: false, error: message }) : '✗ ' + message)); process.exit(1) }

/** Numeric triple of a version, ignoring any -rc/-alpha suffix. */
function triple(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  return m === null ? undefined : [Number(m[1]), Number(m[2]), Number(m[3])]
}
function compare(a, b) {
  const x = triple(a), y = triple(b)
  if (x === undefined || y === undefined) return 0
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}
/** Caret semantics are what every range in package.json uses; for 0.x a caret pins the minor. */
function satisfiesCaret(range, version) {
  for (const part of String(range).split('||').map((p) => p.trim())) {
    const m = /^\^?(\d+)\.(\d+)\.(\d+)/.exec(part)
    if (m === null) continue
    const [, major, minor, patch] = m.map(Number)
    const v = triple(version)
    if (v === undefined) continue
    if (v[0] === major && v[1] === minor && v[2] >= patch) return true
  }
  return false
}

async function installedVersion() {
  const runtimes = join(homedir(), '.dsh', 'dsh-runtimes')
  let best
  let entries = []
  try { entries = await (await import('node:fs/promises')).readdir(runtimes, { withFileTypes: true }) } catch { return undefined }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const meta = JSON.parse(await readFile(join(runtimes, entry.name, 'runtime.json'), 'utf8'))
      if (typeof meta.desktopVersion !== 'string') continue
      if (best === undefined || compare(meta.desktopVersion, best) > 0) best = meta.desktopVersion
    } catch { /* next */ }
  }
  return best
}

/** The update feed is an electron-updater "generic" provider: `<channel>.yml` holds `version:`. */
async function feedInfo() {
  let feed = DEFAULT_FEED
  let chan = channel
  if (appDir !== '') {
    try {
      const yml = await readFile(join(appDir, 'resources', 'app-update.yml'), 'utf8')
      const url = /^url:\s*(\S+)/m.exec(yml)?.[1]
      const ch = /^channel:\s*(\S+)/m.exec(yml)?.[1]
      if (url !== undefined) feed = url.endsWith('/') ? url : url + '/'
      if (ch !== undefined) chan = ch
    } catch { /* fall back to defaults */ }
  }
  const url = feed + chan + '.yml'
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`feed ${url} -> HTTP ${response.status}`)
  const body = await response.text()
  const version = /^version:\s*(\S+)/m.exec(body)?.[1]
  const files = [...body.matchAll(/^\s+-\s+url:\s*(\S+)/gm)].map((m) => m[1])
  if (version === undefined) throw new Error(`feed ${url} has no version field`)
  return { url, channel: chan, version, files }
}

async function tarballUrl(pkg, version) {
  for (const registry of ['https://registry.npmmirror.com', 'https://registry.npmjs.org']) {
    try {
      const response = await fetch(`${registry}/@deepseek-ai%2F${pkg}/${version}`, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) continue
      const dist = (await response.json()).dist
      if (dist?.tarball) return dist.tarball
    } catch { /* next registry */ }
  }
  return undefined
}

const run = (cmd, args, cwd) => new Promise((done) => {
  execFile(cmd, args, { cwd, maxBuffer: 64 << 20 }, (error) => done(error === null))
})

/** Download one package version once and return the extracted directory. */
async function extracted(pkg, version) {
  const dir = join(CACHE, pkg + '-' + version)
  if (await access(join(dir, 'package.json')).then(() => true, () => false)) return dir
  const url = await tarballUrl(pkg, version)
  if (url === undefined) return undefined
  await mkdir(dir, { recursive: true })
  const ok1 = await run('curl.exe', ['-sL', '--max-time', '180', '-o', join(dir, 'pkg.tgz'), url])
  if (!ok1) return undefined
  const ok2 = await run('tar', ['-xzf', 'pkg.tgz', '-C', '.', '--strip-components=1'], dir)
  return ok2 ? dir : undefined
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

async function main() {
  const installed = await installedVersion()
  if (installed === undefined) fail('找不到已安装的 DSH 版本（~/.dsh/dsh-runtimes/*/runtime.json 里没有 desktopVersion）')
  const feed = await feedInfo()

  let baseline
  try {
    baseline = JSON.parse(await readFile(join(repo, 'docs', 'dsh-compat.json'), 'utf8'))
  } catch {
    fail('缺少 docs/dsh-compat.json（兼容性基线指纹）')
  }
  const peer = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8')).peerDependencies ?? {}
  const clientPeers = Object.entries(peer).filter(([name]) => name.startsWith('@deepseek-ai/dsh-client-'))

  const contract = []
  for (const [pkg, spec] of Object.entries(baseline.contract)) {
    const entry = { package: pkg, file: spec.file, baseline: spec.sha256, latest: undefined, same: undefined }
    if (wantDownload) {
      const dir = await extracted(pkg, feed.version)
      if (dir === undefined) { contract.push({ ...entry, error: 'download failed' }); continue }
      try {
        entry.latest = sha256(await readFile(join(dir, spec.file)))
        entry.same = entry.latest === entry.baseline
      } catch { entry.error = 'missing ' + spec.file }
    }
    contract.push(entry)
  }

  const changed = contract.filter((c) => c.same === false || c.error !== undefined)
  const newer = compare(feed.version, installed) > 0
  const uncovered = clientPeers.filter(([, range]) => !satisfiesCaret(range, feed.version)).map(([name]) => name)

  const result = {
    ok: true,
    installed,
    latest: feed.version,
    channel: feed.channel,
    feed: feed.url,
    newer,
    baselineVerifiedOn: baseline.verifiedOn,
    verifiedAt: baseline.verifiedAt,
    contract: contract.map(({ package: p, file, same, latest, error }) => ({ package: p, file, same, latest: latest?.slice(0, 16), error })),
    contractChanged: changed.length > 0,
    peerRangesCoverLatest: uncovered.length === 0,
    peerRangesMissing: uncovered,
    // review-required: we must look at the code; widen-ranges: only our declared
    // ranges are behind; compatible: a newer DSH exists but we already declare it.
    verdict: changed.length > 0 ? 'review-required' : newer && !(uncovered.length === 0) ? 'widen-ranges' : 'compatible',
  }

  if (asJson) {
    console.log(JSON.stringify(result, undefined, 2))
  } else {
    log('DSH 更新与兼容性检查')
    log(`  已安装     ${installed}`)
    log(`  最新(${feed.channel})  ${feed.version}${newer ? '   ← 有更新' : '   （已是最新）'}`)
    log(`  基线       ${baseline.verifiedOn}（${baseline.verifiedAt} 验证）`)
    log('  契约文件（本插件真正调用的宿主入口，逐字节比对）:')
    for (const c of contract) {
      const mark = c.same === true ? '✅ 相同' : c.same === false ? '⚠ 已变化' : '· 跳过'
      log(`    ${mark}  ${c.package}/${c.file}${c.error ? '  (' + c.error + ')' : ''}`)
    }
    log(`  peer 范围覆盖最新版本: ${uncovered.length === 0 ? '✅ 是' : '✗ 缺 ' + uncovered.join(', ')}`)
    log('')
    if (result.verdict === 'compatible') {
      log(newer
        ? '→ 结论：DSH 有新版 ' + feed.version + '，契约文件未变、peer 范围已覆盖 → 插件无需改动；升级 DSH 后按 docs/dsh-compat.md 第 6 节验收即可。'
        : '→ 结论：已是最新，且契约未变；无需任何操作。')
    }
    if (result.verdict === 'widen-ranges') log('→ 结论：DSH 有新版 ' + feed.version + '，契约文件未变但 peer 范围未覆盖 → 放宽 peerDependencies + 重新构建 + 发版。')
    if (result.verdict === 'review-required') log('→ 结论：契约文件发生变化 → 必须人工评估（对照 docs/dsh-compat.md 第 5 节）。')
  }

  process.exit(result.contractChanged ? 3 : result.verdict === 'widen-ranges' ? 2 : 0)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
