/**
 * Download-plan test: the mirror is opt-in, and a direct failure with mirrors
 * disabled must surface the actionable `MIRROR_DISABLED` code.
 *
 * `node --experimental-strip-types test/download.test.ts`
 */
import { DEFAULT_MIRROR, MirrorDisabledError, downloadPlan, formatBytes, mirrorUrl } from '../src/download.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

const url = 'https://github.com/matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe'

check('mirror disabled means direct only', downloadPlan(url, { allowMirror: false }), [url])
check('mirror enabled appends the default mirror', downloadPlan(url, { allowMirror: true }), [url, DEFAULT_MIRROR + url])
check('a custom mirror is used verbatim', downloadPlan(url, { allowMirror: true, mirror: 'https://mirror.example/' }), [url, 'https://mirror.example/' + url])
check('a mirror without a trailing slash still joins cleanly', mirrorUrl('https://mirror.example', url), 'https://mirror.example/' + url)

const disabled = new MirrorDisabledError(url, 'fetch failed')
check('mirror-disabled carries a stable code', disabled.code, 'MIRROR_DISABLED')
check('mirror-disabled tells the user which switch to flip', disabled.message.includes('allowMirrorDownload'), true)
check('mirror-disabled keeps the direct error', disabled.message.includes('fetch failed'), true)

check('formatBytes renders bytes', formatBytes(512), '512 B')
check('formatBytes renders kilobytes', formatBytes(2048), '2.0 KB')
check('formatBytes renders megabytes', formatBytes(19_502_944), '18.6 MB')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
