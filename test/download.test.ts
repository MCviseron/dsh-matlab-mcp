/**
 * Download-plan test: mirror templates, the opt-in gate, and the measured-speed
 * ordering that keeps a rotted mirror list usable.
 *
 * `node --experimental-strip-types test/download.test.ts`
 */
import {
  DEFAULT_MIRRORS,
  DEFAULT_MIRRORS_VALUE,
  MirrorDisabledError,
  downloadPlan,
  expandMirror,
  formatBytes,
  orderBySpeed,
  parseMirrors,
  type MirrorMeasurement,
} from '../src/download.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

const url = 'https://github.com/matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe'

// --- mirror templates -------------------------------------------------------
check('{url} expands to a prefix-style mirror', expandMirror('https://gh-proxy.com/{url}', url), 'https://gh-proxy.com/' + url)
check('{path} expands to a host-replacement mirror', expandMirror('https://kkgithub.com/{path}', url), 'https://kkgithub.com/matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe')
check('{path} keeps the query string', expandMirror('https://m.test/{path}', 'https://github.com/a/b?x=1&y=2'), 'https://m.test/a/b?x=1&y=2')
check('a bare prefix still works (legacy config)', expandMirror('https://ghproxy.net/', url), 'https://ghproxy.net/' + url)
check('a bare prefix without slash works too', expandMirror('https://ghproxy.net', url), 'https://ghproxy.net/' + url)

// --- mirror list parsing ----------------------------------------------------
check('a comma-separated list is split and trimmed', parseMirrors(' a , b ,, c '), ['a', 'b', 'c'])
check('an empty setting falls back to the defaults', parseMirrors(''), [...DEFAULT_MIRRORS])
check('an undefined setting falls back to the defaults', parseMirrors(undefined), [...DEFAULT_MIRRORS])
check('an array is accepted as-is', parseMirrors(['x', 'y']), ['x', 'y'])
check('the settings default is the comma-joined list', DEFAULT_MIRRORS_VALUE, DEFAULT_MIRRORS.join(','))

// --- plan ordering ----------------------------------------------------------
check('mirrors disabled means direct only', downloadPlan(url, { allowMirror: false }), [url])
check('mirrors enabled means mirrors first, direct last', downloadPlan(url, { allowMirror: true }), [
  expandMirror(DEFAULT_MIRRORS[0]!, url),
  expandMirror(DEFAULT_MIRRORS[1]!, url),
  expandMirror(DEFAULT_MIRRORS[2]!, url),
  url,
])
check('a custom list is honoured, in order', downloadPlan(url, { allowMirror: true, mirrors: 'https://m1/{url},https://m2/{path}' }), [
  'https://m1/' + url,
  'https://m2/matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe',
  url,
])
check('a mirror that expands to the direct URL is not duplicated', downloadPlan(url, { allowMirror: true, mirrors: '{url}' }), [url])

// --- speed ordering ---------------------------------------------------------
const measurements: MirrorMeasurement[] = [
  { template: 'slow', url: 'u1', ok: true, mbps: 0.4 },
  { template: 'dead', url: 'u2', ok: false, note: 'timeout' },
  { template: 'fast', url: 'u3', ok: true, mbps: 9.5 },
]
check('the fastest working mirror goes first, failures last', orderBySpeed(measurements), ['fast', 'slow', 'dead'])

// --- errors and helpers -----------------------------------------------------
const disabled = new MirrorDisabledError(url, 'fetch failed')
check('mirror-disabled carries a stable code', disabled.code, 'MIRROR_DISABLED')
check('mirror-disabled tells the user which switch to flip', disabled.message.includes('allowMirrorDownload'), true)
check('mirror-disabled keeps the direct error', disabled.message.includes('fetch failed'), true)

check('formatBytes renders bytes', formatBytes(512), '512 B')
check('formatBytes renders kilobytes', formatBytes(2048), '2.0 KB')
check('formatBytes renders megabytes', formatBytes(19_502_944), '18.6 MB')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
