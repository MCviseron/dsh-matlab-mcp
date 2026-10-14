/**
 * Artifact download with an explicit, opt-in mirror fallback.
 *
 * The MathWorks release assets live on `github.com`, which is slow or
 * unreachable from some networks. A mirror can deliver the same bytes faster,
 * but routing a vendor artifact through a third party is a security decision
 * the user makes, so it is **off by default**; when it is off and the direct
 * download fails the caller gets an actionable `MIRROR_DISABLED` error.
 *
 * Mirror availability is volatile (measured on the target machine: `ghproxy.net`
 * went from working to 0.03 MB/s within hours while `gh-proxy.com` held
 * 2.5–9.5 MB/s), so the policy carries an **ordered list**, not one URL.
 */
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream, existsSync } from 'node:fs'

/**
 * Default mirrors, fastest first. Measured 2026-10-14 from the target machine
 * with the VPN off: `gh-proxy.com` 2.53 MB/s on the release asset and
 * 9.51 MB/s on a codeload zipball; `gh.llkk.cc` 1.18 MB/s with the VPN on but
 * timing out without it; `ghproxy.net` effectively dead.
 */
export const DEFAULT_MIRRORS: readonly string[] = [
  'https://gh-proxy.com/{url}',
  'https://gh.llkk.cc/{url}',
  'https://ghproxy.net/{url}',
]

/** First default mirror (kept for callers that want a single template). */
export const DEFAULT_MIRROR = DEFAULT_MIRRORS[0]!

/** The default mirror list as the comma-separated settings value. */
export const DEFAULT_MIRRORS_VALUE = DEFAULT_MIRRORS.join(',')

/** Whether third-party mirrors may be used, and in which order. */
export interface DownloadPolicy {
  allowMirror: boolean
  /** One template or several; omitted means {@link DEFAULT_MIRRORS}. */
  mirrors?: string | readonly string[] | undefined
  /**
   * A directory laid out like the GitHub paths (exactly what
   * `scripts/mirror-assets.mjs` produces). When an artifact is present there it
   * is copied and **no network source is contacted at all** — that is the
   * "keep the artifacts next to the plugin" deployment.
   */
  localDir?: string | undefined
}

/** One attempted source, kept for the failure report. */
export interface DownloadAttempt {
  url: string
  error: string
}

/** Raised when the direct source failed and mirrors are disabled. */
export class MirrorDisabledError extends Error {
  readonly code = 'MIRROR_DISABLED'
  readonly url: string
  readonly directError: string
  constructor(url: string, directError: string) {
    super(
      '直连下载失败，且「允许镜像下载」处于关闭状态。'
      + ' Direct download failed and mirror download is disabled.'
      + '\n请在 DSH 设置 → MATLAB MCP 中开启「允许镜像下载」(allowMirrorDownload) 后重试；'
      + '或在能访问 GitHub 的网络下重试。'
      + '\n原始错误 / original error: ' + directError,
    )
    this.name = 'MirrorDisabledError'
    this.url = url
    this.directError = directError
  }
}

/** Raised when every allowed source failed. */
export class DownloadFailedError extends Error {
  readonly code = 'DOWNLOAD_FAILED'
  readonly url: string
  readonly attempts: DownloadAttempt[]
  constructor(url: string, attempts: DownloadAttempt[]) {
    super('下载失败 / download failed: ' + attempts.map(attempt => attempt.url + ' -> ' + attempt.error).join(' | '))
    this.name = 'DownloadFailedError'
    this.url = url
    this.attempts = attempts
  }
}

/** Split a configured mirror field into an ordered, trimmed template list. */
export function parseMirrors(value: string | readonly string[] | undefined): string[] {
  const raw = typeof value === 'string' ? value.split(',') : (value ?? DEFAULT_MIRRORS)
  const list = [...raw].map(entry => entry.trim()).filter(entry => entry !== '')
  return list.length === 0 ? [...DEFAULT_MIRRORS] : list
}

/**
 * Build one mirror URL from a template:
 *  - `{url}`  → the whole original URL (prefix-style proxies, e.g. gh-proxy.com)
 *  - `{path}` → path + query only (host-replacement proxies, e.g. kkgithub.com)
 *  - neither  → legacy behaviour: the template is a prefix (`<base>/<url>`)
 */
export function expandMirror(template: string, url: string): string {
  if (template.includes('{url}')) return template.replaceAll('{url}', url)
  if (template.includes('{path}')) {
    const parsed = new URL(url)
    const pathAndQuery = parsed.pathname + parsed.search
    // `https://host/{path}` must not become `https://host//a/b`, while
    // `https://host{path}` still needs the leading slash.
    const value = template.includes('/{path}') ? pathAndQuery.replace(/^\//, '') : pathAndQuery
    return template.replaceAll('{path}', value)
  }
  const base = template.endsWith('/') ? template : template + '/'
  return base + url
}

/** Legacy helper: prefix one absolute URL with a mirror base. */
export function mirrorUrl(mirror: string, url: string): string {
  return expandMirror(mirror, url)
}

/**
 * The ordered source list for one artifact.
 *
 * Mirrors come **first** when the user allowed them: the measured direct
 * throughput (0.21 MB/s) is an order of magnitude below the mirror's, and the
 * user opted in precisely because direct is slow. When mirrors are disabled the
 * direct URL is the only source, so a failure reports `MIRROR_DISABLED`.
 */
export function downloadPlan(url: string, policy: DownloadPolicy): string[] {
  if (!policy.allowMirror) return [url]
  const mirrored = parseMirrors(policy.mirrors).map(template => expandMirror(template, url)).filter(entry => entry !== url)
  return [...mirrored, url]
}

/**
 * Download one URL to one path atomically: bytes go to `<target>.partial`, are
 * validated **there**, and only a validated file is renamed over the target.
 * A failure therefore never truncates, deletes or otherwise disturbs a
 * previously working artifact — which matters because the running MCP server is
 * that same file on Windows.
 */
export async function fetchToFile(
  url: string,
  target: string,
  timeoutMs: number,
  signal?: AbortSignal,
  validate?: (path: string) => Promise<void> | void,
): Promise<number> {
  await mkdir(dirname(target), { recursive: true })
  const partial = target + '.partial'
  await rm(partial, { force: true })
  const timeout = AbortSignal.timeout(timeoutMs)
  const composed = signal === undefined ? timeout : AbortSignal.any([timeout, signal])
  try {
    const response = await fetch(url, { redirect: 'follow', signal: composed })
    if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText)
    if (response.body === null) throw new Error('empty response body')
    await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(partial))
    const written = await stat(partial)
    if (written.size === 0) throw new Error('downloaded file is empty')
    if (validate !== undefined) await validate(partial)
    await rename(partial, target)
    return written.size
  } catch (error) {
    await rm(partial, { force: true }).catch(() => {})
    throw error
  }
}

export interface DownloadOptions {
  timeoutMs?: number
  signal?: AbortSignal | undefined
  log?: (message: string) => void
  /** Extra validation of the finished file, run on the staged copy before the swap. */
  validate?: (path: string) => Promise<void> | void
}

export interface DownloadResult {
  url: string
  path: string
  bytes: number
  mirrored: boolean
  /** True when the artifact came from `policy.localDir` instead of the network. */
  local: boolean
}

/**
 * Where an artifact for `url` lives inside a local asset directory: the GitHub
 * pathname under the directory root, which is how the mirror tree is laid out.
 */
export function localAssetPath(localDir: string, url: string): string {
  return join(localDir, new URL(url).pathname.replace(/^\//, ''))
}

/**
 * Copy one artifact out of the local asset directory, validated on the staged
 * copy exactly like a download. Returns `undefined` when the file is absent so
 * the caller can fall through to the network plan.
 */
async function copyFromLocalDir(source: string, target: string, validate?: (path: string) => Promise<void> | void): Promise<number | undefined> {
  if (!existsSync(source)) return undefined
  await mkdir(dirname(target), { recursive: true })
  const partial = target + '.partial'
  await rm(partial, { force: true })
  try {
    await copyFile(source, partial)
    const written = await stat(partial)
    if (written.size === 0) throw new Error('local asset is empty: ' + source)
    if (validate !== undefined) await validate(partial)
    await rename(partial, target)
    return written.size
  } catch (error) {
    await rm(partial, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Resolve one artifact from the sources allowed by the policy, in order:
 * the local asset directory first (if configured and populated), then the
 * network plan. A mirror that is disabled is never contacted: the direct
 * failure is reported as {@link MirrorDisabledError} so the UI can tell the
 * user exactly which switch to flip.
 */
export async function downloadWithFallback(url: string, target: string, policy: DownloadPolicy, options: DownloadOptions = {}): Promise<DownloadResult> {
  const timeoutMs = options.timeoutMs ?? 600_000
  const localDir = policy.localDir?.trim()
  if (localDir !== undefined && localDir !== '') {
    const source = localAssetPath(localDir, url)
    options.log?.('本地制品 / local asset: ' + source)
    const bytes = await copyFromLocalDir(source, target, options.validate)
    if (bytes !== undefined) {
      options.log?.('取自本地目录 / copied from the local asset directory')
      return { url: 'local:' + source, path: target, bytes, mirrored: false, local: true }
    }
    options.log?.('本地目录没有该制品，转网络 / not present locally, falling back to the network')
  }
  const plan = downloadPlan(url, policy)
  const attempts: DownloadAttempt[] = []
  for (const source of plan) {
    options.log?.('下载 / downloading: ' + source)
    try {
      const bytes = await fetchToFile(source, target, timeoutMs, options.signal, options.validate)
      return { url: source, path: target, bytes, mirrored: source !== url, local: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      attempts.push({ url: source, error: message })
      options.log?.('失败 / failed: ' + source + ' -> ' + message)
    }
  }
  if (plan.length === 1 && !policy.allowMirror) {
    throw new MirrorDisabledError(url, attempts[0]?.error ?? 'unknown error')
  }
  throw new DownloadFailedError(url, attempts)
}

/** One mirror's measured behaviour for a given artifact. */
export interface MirrorMeasurement {
  template: string
  url: string
  ok: boolean
  /** Milliseconds until the first byte arrived. */
  ttfbMs?: number
  /** Approximate throughput in MB/s over the sampled range. */
  mbps?: number
  note?: string
}

export interface MeasureOptions {
  /** How long one mirror may take before it is abandoned. */
  budgetMs?: number
  /** Bytes requested per mirror; the probe stops early once the budget is spent. */
  sampleBytes?: number
  log?: (message: string) => void
}

/**
 * Probe every configured mirror against a real artifact and report TTFB and
 * approximate throughput, so the settings card can re-rank a list that has gone
 * stale — mirror quality changes within hours, and a hard-coded order rots.
 */
export async function measureMirrors(url: string, mirrors: readonly string[], options: MeasureOptions = {}): Promise<MirrorMeasurement[]> {
  const budgetMs = options.budgetMs ?? 6000
  const sampleBytes = options.sampleBytes ?? 4 * 1024 * 1024
  const results: MirrorMeasurement[] = []
  for (const template of parseMirrors(mirrors)) {
    const target = expandMirror(template, url)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), budgetMs + 2000)
    const started = Date.now()
    try {
      const response = await fetch(target, {
        signal: controller.signal,
        headers: { Range: 'bytes=0-' + String(sampleBytes - 1) },
      })
      if (!response.ok && response.status !== 206) throw new Error('HTTP ' + response.status)
      if (response.body === null) throw new Error('empty response body')
      const reader = response.body.getReader()
      let bytes = 0
      let ttfbMs: number | undefined
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (ttfbMs === undefined) ttfbMs = Date.now() - started
        bytes += value.byteLength
        if (Date.now() - started > budgetMs || bytes >= sampleBytes) {
          await reader.cancel().catch(() => {})
          break
        }
      }
      const elapsed = Math.max(1, Date.now() - started)
      const measurement: MirrorMeasurement = {
        template,
        url: target,
        ok: bytes > 0,
        ...(ttfbMs === undefined ? {} : { ttfbMs }),
        mbps: bytes / 1048576 / (elapsed / 1000),
        ...(bytes === 0 ? { note: 'no data received' } : {}),
      }
      options.log?.('镜像测速 / mirror probe: ' + template + ' -> ' + (measurement.mbps ?? 0).toFixed(2) + ' MB/s')
      results.push(measurement)
    } catch (error) {
      const note = (error as Error).name === 'AbortError' ? 'timeout' : (error as Error).message
      options.log?.('镜像不可用 / mirror unavailable: ' + template + ' -> ' + note)
      results.push({ template, url: target, ok: false, note })
    } finally {
      clearTimeout(timer)
    }
  }
  return results
}

/** Re-order mirror templates: reachable ones fastest-first, then the failures. */
export function orderBySpeed(measurements: readonly MirrorMeasurement[]): string[] {
  const measured = new Map(measurements.map(entry => [entry.template, entry]))
  return [...measurements]
    .sort((left, right) => {
      if (left.ok !== right.ok) return left.ok ? -1 : 1
      return (right.mbps ?? 0) - (left.mbps ?? 0)
    })
    .map(entry => measured.get(entry.template)!.template)
}

/** Whether a downloaded file starts with the given magic bytes (cheap integrity check). */
export async function hasMagic(path: string, magic: readonly number[]): Promise<boolean> {
  const { open } = await import('node:fs/promises')
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(magic.length)
    const { bytesRead } = await handle.read(buffer, 0, magic.length, 0)
    if (bytesRead !== magic.length) return false
    return magic.every((byte, index) => buffer[index] === byte)
  } finally {
    await handle.close()
  }
}

/** `MZ` — every Windows PE executable (the MATLAB MCP server binary). */
export const PE_MAGIC = [0x4d, 0x5a] as const

/** `PK` — every zip container (`.mltbx` add-on packages). */
export const ZIP_MAGIC = [0x50, 0x4b] as const

/** Sizes are reported in the settings card, so one helper formats them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
