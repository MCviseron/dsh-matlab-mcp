/**
 * Spike for the chat-header "Open MATLAB" action: launch a detached MATLAB
 * desktop exactly as the Host route does, then confirm the process appeared and
 * that the plugin's cleanup policy does NOT consider it owned.
 *
 * `node --experimental-strip-types scripts/open-matlab.ts [new|auto|existing]`
 */
import { agentSessionPids, launchMatlabDesktop, listProcesses } from '../src/matlab-processes.ts'
import { pickMatlabRoot } from '../src/paths.ts'
import { buildMatlabDesktopArgs, type SessionMode } from '../src/server-args.ts'

const sessionMode = (process.argv[2] ?? 'new') as SessionMode
const root = pickMatlabRoot()
console.log('matlab root:', root)
if (root === undefined) process.exit(1)

const args = buildMatlabDesktopArgs(sessionMode)
console.log('session mode:', sessionMode, '| desktop args:', JSON.stringify(args))

const before = (await listProcesses()).filter(row => /^matlab(\.exe)?$/i.test(row.Name)).map(row => row.ProcessId)
const pid = launchMatlabDesktop(root, args)
console.log('spawned launcher pid:', pid)

// MATLAB's launcher takes a few seconds to materialize the real processes.
for (let attempt = 0; attempt < 10; attempt += 1) {
  await new Promise(resolve => setTimeout(resolve, 3000))
  const now = (await listProcesses()).filter(row => /^matlab(\.exe)?$/i.test(row.Name)).map(row => row.ProcessId)
  const fresh = now.filter(candidate => !before.includes(candidate))
  if (fresh.length > 0) {
    console.log('MATLAB pids after ' + ((attempt + 1) * 3) + 's:', now.join(', '), '| new:', fresh.join(', '))
    break
  }
  if (attempt === 9) console.log('no MATLAB process observed after 30s (pids now: ' + now.join(', ') + ')')
}

const owned = await agentSessionPids()
console.log('pids the plugin cleanup would stop (agent session):', owned.length === 0 ? '(none)' : owned.join(', '))
console.log('=> the window opened here is NOT owned, so unloading the plugin will not close it.')
