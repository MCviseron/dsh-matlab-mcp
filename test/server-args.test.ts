/**
 * MCP launch-argument test: the argument vector handed to the official server
 * must stay valid for every session mode, and the child environment must carry
 * the Windows roots Simulink needs.
 *
 * `node --experimental-strip-types test/server-args.test.ts`
 */
import { buildMatlabDesktopArgs, buildServerArgs, buildServerEnv } from '../src/server-args.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

const base = {
  matlabRoot: 'D:\\MATLAB\\2025b',
  sessionMode: 'new' as const,
  displayMode: 'desktop' as const,
  initialWorkingFolder: 'D:\\work',
  logFolder: 'C:\\Users\\me\\.dsh\\matlab-mcp\\logs',
}

check('new + desktop carries root, mode, display, folder, logs', buildServerArgs(base), [
  '--matlab-root=D:\\MATLAB\\2025b',
  '--matlab-session-mode=new',
  '--matlab-display-mode=desktop',
  '--initial-working-folder=D:\\work',
  '--log-folder=C:\\Users\\me\\.dsh\\matlab-mcp\\logs',
  '--log-level=info',
  '--disable-telemetry=true',
])

check('existing mode drops root, folder and display', buildServerArgs({ ...base, sessionMode: 'existing' }), [
  '--matlab-session-mode=existing',
  '--log-folder=C:\\Users\\me\\.dsh\\matlab-mcp\\logs',
  '--log-level=info',
  '--disable-telemetry=true',
])

check('extension files are passed once each, in order', buildServerArgs({
  ...base,
  extensionFiles: ['C:\\tools\\tools.json', 'C:\\tools\\more.json'],
}).filter(arg => arg.startsWith('--extension-file=')), [
  '--extension-file=C:\\tools\\tools.json',
  '--extension-file=C:\\tools\\more.json',
])

check('nodesktop is passed through', buildServerArgs({ ...base, displayMode: 'nodesktop' }).includes('--matlab-display-mode=nodesktop'), true)
check('telemetry stays disabled unless explicitly enabled', buildServerArgs({ ...base, telemetry: false }).includes('--disable-telemetry=true'), true)
check('telemetry can be left enabled', buildServerArgs({ ...base, telemetry: true }).includes('--disable-telemetry=false'), true)
check('startup initialization is opt-in', buildServerArgs(base).includes('--initialize-matlab-on-startup=true'), false)

const env = buildServerEnv({ windir: 'C:\\Windows', SystemRoot: 'C:\\Windows', PATH: 'C:\\bin', SECRET_TOKEN: 'nope' } as NodeJS.ProcessEnv)
check('the Windows root survives into the child env', env.windir, 'C:\\Windows')
check('SystemRoot survives into the child env', env.SystemRoot, 'C:\\Windows')
check('PATH survives into the child env', env.PATH, 'C:\\bin')
check('unrelated secret-shaped names are not forwarded', env.SECRET_TOKEN, undefined)

// The chat-header "Open MATLAB" button: `new` mode owns its own session, so a
// plain desktop is right; auto/existing must share the session the server attaches to.
check('new mode opens a plain MATLAB desktop', buildMatlabDesktopArgs('new'), [])
check('auto mode opens a shared session', buildMatlabDesktopArgs('auto'), ['-r', 'shareMATLABSession'])
check('existing mode opens a shared session', buildMatlabDesktopArgs('existing'), ['-r', 'shareMATLABSession'])

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
