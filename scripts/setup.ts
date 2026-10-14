/**
 * Phase 3 spike: provisioning + Simulink extension verification, headless.
 *
 * `node --experimental-strip-types .spike/setup.ts`            (direct only)
 * `node --experimental-strip-types .spike/setup.ts --mirror`   (mirror allowed)
 * `node --experimental-strip-types .spike/setup.ts --mirror --matlab`  (+ MATLAB side)
 */
import {
  ensureToolbox,
  ensureToolkits,
  inspectState,
  installToolbox,
  registerSimulinkPaths,
  runMatlabBatch,
  simulinkExtensionFile,
} from '../src/provision.ts'
import { probeMcp } from '../src/selftest.ts'
import { buildServerArgs, buildServerEnv } from '../src/server-args.ts'
import { binaryPath, logsDir } from '../src/paths.ts'

const log = (message: string): void => { console.log('[setup] ' + message) }
const policy = { allowMirror: process.argv.includes('--mirror') }
const withMatlab = process.argv.includes('--matlab')
const matlabRoot = 'D:\\MATLAB\\2025b'

console.log('=== policy: allowMirror=' + policy.allowMirror + ', matlab steps=' + withMatlab + ' ===')

try {
  const toolbox = await ensureToolbox(policy, log)
  console.log('[toolbox] ' + JSON.stringify(toolbox))
} catch (error) {
  console.log('[toolbox] FAILED: ' + (error as Error).message.slice(0, 500))
}

try {
  const toolkits = await ensureToolkits(policy, log)
  console.log('[toolkits] ' + JSON.stringify(toolkits))
} catch (error) {
  console.log('[toolkits] FAILED: ' + (error as Error).message.slice(0, 500))
}

const state = await inspectState()
console.log('=== state ===')
console.log(JSON.stringify({
  binary: state.binary,
  toolbox: state.toolbox,
  toolkits: state.toolkits.map(toolkit => ({ name: toolkit.name, present: toolkit.present })),
  simulink: state.simulink,
  matlab: state.matlab,
  ready: state.ready,
}, null, 1))

// The decisive Phase 3 check: with the extension file, tools/list must grow
// from 5 built-ins to 14 tools. This does not start MATLAB.
const extensionFile = simulinkExtensionFile()
const args = buildServerArgs({
  matlabRoot,
  sessionMode: 'new',
  displayMode: 'desktop',
  initialWorkingFolder: process.cwd(),
  logFolder: logsDir(),
  extensionFiles: [extensionFile],
})
console.log('=== tools/list with --extension-file ===')
console.log(args.join(' '))
const probe = await probeMcp({ command: binaryPath(), args, env: buildServerEnv(), cwd: process.cwd(), timeoutMs: 60_000 })
console.log(probe.ok ? probe.tools?.join(', ') : 'PROBE FAILED: ' + probe.error)
console.log('tool count: ' + (probe.tools?.length ?? 0))

if (withMatlab) {
  console.log('=== MATLAB side: install toolbox ===')
  const installed = await installToolbox(matlabRoot, state.toolbox.path, log)
  console.log('install ok=' + installed.ok + ' stdout=' + installed.stdout.trim().slice(-200))
  console.log('=== MATLAB side: register Simulink toolkit path ===')
  const paths = await registerSimulinkPaths(matlabRoot, log)
  console.log('savepath ok=' + paths.ok + ' stdout=' + paths.stdout.trim().slice(-200))
  console.log('=== MATLAB side: can MATLAB see the toolkit functions? ===')
  const which = await runMatlabBatch(matlabRoot, [
    'f = ["model_overview","model_read","model_edit","model_check","model_scan","model_test"];',
    'for k = 1:numel(f), p = which(f(k)); disp(f(k) + " -> " + p); end',
  ].join(' '), 300_000)
  console.log(which.stdout.trim())
  if (!which.ok) console.log('which failed: ' + (which.error ?? '') + ' ' + which.stderr.slice(-300))
}

console.log('bin: ' + binaryPath())
