/**
 * Phase 3/4 spike: the full bridge — MCP server → MATLAB → Simulink — plus one
 * Simulink Agentic Toolkit extension tool call, all headless.
 *
 * `node --experimental-strip-types .spike/mcp-sim.ts`
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { binaryPath, defaultWorkspaceDir, logsDir } from '../src/paths.ts'
import { buildServerArgs, buildServerEnv } from '../src/server-args.ts'
import { probeMcp } from '../src/selftest.ts'
import { simulinkExtensionFile } from '../src/provision.ts'

const workspace = defaultWorkspaceDir()
await mkdir(workspace, { recursive: true })
const script = join(workspace, 'dsh_build_model.m')
await copyFile('.spike/build-model.m', script)

const args = buildServerArgs({
  matlabRoot: 'D:\\MATLAB\\2025b',
  sessionMode: 'new',
  displayMode: 'nodesktop',
  initialWorkingFolder: workspace,
  logFolder: logsDir(),
  extensionFiles: [simulinkExtensionFile()],
})

console.log('=== 1) run_matlab_file: build + simulate a Simulink model ===')
const run = await probeMcp({
  command: binaryPath(),
  args,
  env: buildServerEnv(),
  cwd: workspace,
  timeoutMs: 420_000,
  call: { name: 'run_matlab_file', arguments: { script_path: script } },
})
console.log('ok=' + run.ok + ' elapsed=' + (run.elapsedMs / 1000).toFixed(1) + 's')
console.log(run.callText ?? run.error ?? '')

console.log('=== 2) model_overview (Simulink Agentic Toolkit extension tool) ===')
const overview = await probeMcp({
  command: binaryPath(),
  args,
  env: buildServerEnv(),
  cwd: workspace,
  timeoutMs: 420_000,
  call: { name: 'model_overview', arguments: { model: 'dsh_demo_model.slx', scope: 'root', detail: 'interfaces' } },
})
console.log('ok=' + overview.ok + ' elapsed=' + (overview.elapsedMs / 1000).toFixed(1) + 's')
console.log((overview.callText ?? overview.error ?? '').slice(0, 1500))

console.log('=== 3) model_scan (fast regex scan of the .slx on disk) ===')
const scan = await probeMcp({
  command: binaryPath(),
  args,
  env: buildServerEnv(),
  cwd: workspace,
  timeoutMs: 420_000,
  call: { name: 'model_scan', arguments: { model: 'dsh_demo_model.slx', command: 'grep', pattern: 'Gain' } },
})
console.log('ok=' + scan.ok + ' elapsed=' + (scan.elapsedMs / 1000).toFixed(1) + 's')
console.log((scan.callText ?? scan.error ?? '').slice(0, 800))
