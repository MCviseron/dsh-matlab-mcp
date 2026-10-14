/**
 * Artifact download with an explicit, opt-in mirror fallback.
 *
 * The MathWorks release assets live on `github.com`, which is unreachable from
 * some networks (verified on the target machine: `raw.githubusercontent.com`
 * and `api.github.com` time out, `github.com` is intermittent). A mirror can
 * deliver the same bytes, but routing a vendor artifact through a third party
 * is a security decision the user makes, so it is **off by default**: when the
 * direct download fails and no mirror is allowed, the caller gets an actionable
 * error telling the user which setting to enable.
 */
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'

/** Default mirror: a GitHub reverse proxy used only when explicitly enabled. */
export const DEFAULT_MIRROR = 'https://ghproxy.net/'

/** Whether a third-party mirror may be used, and which one. */
export interface DownloadPolicy {
  allowMirror: boolean
  mirror?: string | undefined
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

/** Prefix one absolute URL with a mirror base (`https://mirror/` + `https://...`). */
export function mirrorUrl(mirror: string, url: string): string {
  const base = mirror.endsWith('/') ? mirror : mirror + '/'
  return base + url
}

/**
 * The ordered source list for one artifact: the direct URL first, then the
 * mirror only when the user allowed it.
 */
export function downloadPlan(url: string, policy: DownloadPolicy): string[] {
  if (!policy.allowMirror) return [url]
  return [url, mirrorUrl(policy.mirror ?? DEFAULT_MIRROR, url)]
}

/** Download one URL to one path atomically (`<target>.partial` then rename). */
export async function fetchToFile(url: string, target: string, timeoutMs: number, signal?: AbortSignal): Promise<number> {
  await mkdir(dirname(target), { recursive: true })
  const partial = target + '.partial'
  await rm(partial, { force: true })
  const timeout = AbortSignal.timeout(timeoutMs)
  const composed = signal === undefined ? timeout : AbortSignal.any([timeout, signal])
  const response = await fetch(url, { redirect: 'follow', signal: composed })
  if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText)
  if (response.body === null) throw new Error('empty response body')
  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(partial))
  const written = await stat(partial)
  if (written.size === 0) {
    await rm(partial, { force: true })
    throw new Error('downloaded file is empty')
  }
  await rename(partial, target)
  return written.size
}

export interface DownloadOptions {
  timeoutMs?: number
  signal?: AbortSignal | undefined
  log?: (message: string) => void
  /** Extra validation of the finished file; a throw removes it and fails that source. */
  validate?: (path: string) => Promise<void> | void
}

export interface DownloadResult {
  url: string
  path: string
  bytes: number
  mirrored: boolean
}

/**
 * Download one artifact through every allowed source. A mirror that is disabled
 * is never contacted: the direct failure is reported as {@link MirrorDisabledError}
 * so the UI can tell the user exactly which switch to flip.
 */
export async function downloadWithFallback(url: string, target: string, policy: DownloadPolicy, options: DownloadOptions = {}): Promise<DownloadResult> {
  const timeoutMs = options.timeoutMs ?? 600_000
  const plan = downloadPlan(url, policy)
  const attempts: DownloadAttempt[] = []
  for (const [index, source] of plan.entries()) {
    options.log?.('下载 / downloading: ' + source)
    try {
      const bytes = await fetchToFile(source, target, timeoutMs, options.signal)
      if (options.validate !== undefined) await options.validate(target)
      return { url: source, path: target, bytes, mirrored: index > 0 }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      attempts.push({ url: source, error: message })
      await rm(target, { force: true })
      options.log?.('失败 / failed: ' + source + ' -> ' + message)
    }
  }
  if (plan.length === 1 && !policy.allowMirror) {
    throw new MirrorDisabledError(url, attempts[0]?.error ?? 'unknown error')
  }
  throw new DownloadFailedError(url, attempts)
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
