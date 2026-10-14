/**
 * Phase 1 spike: exercise the plugin's own provision/selftest modules against
 * the real machine, without a running DSH host.
 *
 * `node --experimental-strip-types .spike/plugin-probe.ts`
 */
import { inspectState, simulinkExtensionFile } from '../src/provision.ts'
import { probeMcp } from '../src/selftest.ts'
import { binaryPath } from '../src/paths.ts'
import { buildServerArgs, buildServerEnv } from '../src/server-args.ts'

const state = await inspectState()
console.log('=== inspectState ===')
console.log(JSON.stringify({
  home: state.home,
  binary: state.binary,
  toolbox: state.toolbox,
  toolkits: state.toolkits,
  simulink: state.simulink,
  matlab: state.matlab,
  ready: state.ready,
}, null, 1))

console.log('=== shallow MCP probe through src/selftest.ts ===')
const args = buildServerArgs({
  matlabRoot: state.matlab.root,
  sessionMode: 'new',
  displayMode: 'desktop',
  logFolder: state.home + '\\logs',
  extensionFiles: [],
})
console.log('args:', args.join(' '))
const probe = await probeMcp({
  command: binaryPath(),
  args,
  env: buildServerEnv(),
  cwd: process.cwd(),
  timeoutMs: 60_000,
})
console.log(JSON.stringify(probe, null, 1))
console.log('extension file would be:', simulinkExtensionFile())
