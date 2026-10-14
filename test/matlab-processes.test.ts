/**
 * MATLAB ownership test: only MATLAB processes descending from this plugin's
 * MCP server binary may be stopped — a MATLAB the user opened by hand never is.
 *
 * `node --experimental-strip-types test/matlab-processes.test.ts`
 */
import { ownedMatlabPids, type ProcessRow } from '../src/matlab-processes.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

const SERVER = 'C:\\Users\\me\\.dsh\\matlab-mcp\\bin\\matlab-mcp-server-windows-x64.exe'

const rows: ProcessRow[] = [
  { ProcessId: 100, ParentProcessId: 1, Name: 'DeepSeek Harness.exe', ExecutablePath: 'D:\\DeepSeek Harness\\DeepSeek Harness.exe' },
  // the plugin's MCP server, spawned by the harness
  { ProcessId: 200, ParentProcessId: 100, Name: 'matlab-mcp-server-windows-x64.exe', ExecutablePath: SERVER },
  // the watchdog child the server spawns for itself
  { ProcessId: 210, ParentProcessId: 200, Name: 'matlab-mcp-server-windows-x64.exe', ExecutablePath: SERVER },
  // the MATLAB the server started (direct child)
  { ProcessId: 300, ParentProcessId: 200, Name: 'MATLAB.exe', ExecutablePath: 'D:\\MATLAB\\2025b\\bin\\win64\\MATLAB.exe' },
  { ProcessId: 310, ParentProcessId: 300, Name: 'matlabwindowhelper.exe', ExecutablePath: 'D:\\MATLAB\\2025b\\bin\\win64\\matlabwindowhelper.exe' },
  // a MATLAB the user opened by hand: no path to our server
  { ProcessId: 400, ParentProcessId: 42, Name: 'MATLAB.exe', ExecutablePath: 'D:\\MATLAB\\2025b\\bin\\win64\\MATLAB.exe' },
  // a MATLAB launched through the watchdog branch
  { ProcessId: 500, ParentProcessId: 210, Name: 'MATLAB.exe', ExecutablePath: 'D:\\MATLAB\\2025b\\bin\\win64\\MATLAB.exe' },
]

check('only MATLAB descendants of our server are owned', ownedMatlabPids(rows, SERVER).sort((a, b) => a - b), [300, 500])
check('a hand-started MATLAB is never owned', ownedMatlabPids(rows, SERVER).includes(400), false)
check('non-MATLAB descendants are ignored', ownedMatlabPids(rows, SERVER).includes(310), false)
check('no server process means nothing is owned', ownedMatlabPids(rows, 'C:\\other\\matlab-mcp-server.exe'), [])

// A MATLAB that existed before the plugin started stays protected even when it
// happens to sit under our server (for example a user-attached session).
check('pre-existing MATLAB pids are protected', ownedMatlabPids(rows, SERVER, new Set([300])).sort((a, b) => a - b), [500])

// Path comparison is case-insensitive on Windows.
check('the executable path matches case-insensitively', ownedMatlabPids(rows, SERVER.toUpperCase()).sort((a, b) => a - b), [300, 500])

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
