/**
 * MATLAB discovery test: release ranking, root validation and the pick order
 * (explicit setting > newest installed > the installation behind PATH).
 *
 * `node --experimental-strip-types test/paths.test.ts`
 */
import { binaryAssetName, findOnPath, pickMatlabRoot, releaseRank } from '../src/paths.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

check('release R2025b ranks above R2025a', releaseRank('R2025b') > releaseRank('R2025a'), true)
check('release R2025a ranks above R2024b', releaseRank('R2025a') > releaseRank('R2024b'), true)
check('R2025b parses to 20252', releaseRank('R2025b'), 20252)
check('a non-release folder ranks last', releaseRank('toolbox'), -1)

check('newest installed release wins when nothing is configured', pickMatlabRoot({ preferred: '', available: ['D:\\MATLAB\\2025a', 'D:\\MATLAB\\2025b'], onPath: '' }), 'D:\\MATLAB\\2025b')
check('no settings, no install, no PATH resolves to undefined', pickMatlabRoot({ preferred: '', available: [], onPath: '' }), undefined)
check('the PATH installation is used when nothing else exists', pickMatlabRoot({ preferred: '', available: [], onPath: 'C:\\MATLAB\\R2025b\\bin\\matlab.exe', platform: 'win32' }), 'C:\\MATLAB\\R2025b')

check('unsupported platforms get no asset name', binaryAssetName('freebsd', 'x64'), undefined)
check('windows x64 uses the shipped asset name', binaryAssetName('win32', 'x64'), 'matlab-mcp-server-windows-x64.exe')
check('macOS arm64 uses the official asset name', binaryAssetName('darwin', 'arm64'), 'matlab-mcp-server-macos-arm64')

check('findOnPath ignores empty PATH', findOnPath('', 'matlab.exe'), undefined)
check('findOnPath skips missing entries', findOnPath('Z:\\does-not-exist;C:\\also-missing', 'matlab.exe'), undefined)

// A preferred root that does not exist on disk falls through to detection.
check('an invalid preferred root falls through', pickMatlabRoot({ preferred: 'D:\\not-matlab', available: ['D:\\MATLAB\\2025b'], onPath: '' }), 'D:\\MATLAB\\2025b')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
