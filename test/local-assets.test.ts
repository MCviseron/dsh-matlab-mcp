/**
 * Local asset directory test: `localAssetsDir` resolves an artifact from disk
 * with no network request at all, and falls through cleanly when it is absent.
 *
 * `node --experimental-strip-types test/local-assets.test.ts`
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { downloadWithFallback, localAssetPath } from '../src/download.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

const root = mkdtempSync(join(tmpdir(), 'matlab-mcp-local-'))
const url = 'https://github.com/matlab/matlab-mcp-server/releases/download/v0.14.0/matlab-mcp-server-windows-x64.exe'
const staged = join(root, 'matlab/matlab-mcp-server/releases/download/v0.14.0/matlab-mcp-server-windows-x64.exe')
mkdirSync(dirname(staged), { recursive: true })
writeFileSync(staged, 'LOCAL-PAYLOAD')

check(
  'localAssetPath mirrors the GitHub path under the directory root',
  localAssetPath(root, url).replaceAll('\\', '/').replace(root.replaceAll('\\', '/'), ''),
  '/matlab/matlab-mcp-server/releases/download/v0.14.0/matlab-mcp-server-windows-x64.exe',
)

const target = join(root, 'cache', 'matlab-mcp-server-windows-x64.exe')
const copied = await downloadWithFallback(url, target, { allowMirror: false, localDir: root })
check('a local asset short-circuits the network', copied.local, true)
check('the local asset is reported as local, not mirrored', copied.mirrored, false)
check('the bytes reached the target path', readFileSync(target, 'utf8'), 'LOCAL-PAYLOAD')
check('the result points at the local source', copied.url.startsWith('local:'), true)

// A missing local artifact must fall through to the network plan. The URL here
// resolves nowhere, so the network attempt fails immediately and the error is
// the mirror-policy one — proving the local step is a source, not a shortcut
// that swallows the network path.
const missingUrl = 'https://matlab-mcp.invalid/releases/download/v1/nothing.bin'
const failure = await downloadWithFallback(missingUrl, join(root, 'cache', 'nothing.bin'), { allowMirror: false, localDir: root })
  .then(() => 'no-error', (error: Error) => (error as Error & { code?: string }).code ?? error.name)
check('a missing local asset falls through and reports the network failure', failure, 'MIRROR_DISABLED')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
