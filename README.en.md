# dsh-matlab-mcp

[中文](README.md) | **English**

A DeepSeek Harness (DSH) plugin that lets the agent **actually drive MATLAB and Simulink**: run MATLAB code, execute `.m` scripts and unit tests, statically check code quality, and read/edit/query/check/simulate Simulink models — all through the **official MathWorks MATLAB MCP Server**, with the **MATLAB / Simulink Agentic Toolkit** skills injected into the session.

> This is not "an AI inside MATLAB". It is the other way round: **MATLAB is exposed as an MCP server that DSH calls**. The plugin only mounts the official server, provisions the official artifacts, and registers the official skills.

```
you ──natural language──▶ DSH agent
                           ├─ tools  mcp__matlab__<tool>  ──stdio MCP──▶ MATLAB MCP Server (official exe) ──▶ MATLAB / Simulink
                           ├─ skills matlab-* / simulink-*  ── from the two official Agentic Toolkits
                           └─ system-prompt guidance (call rules, timeouts, figure export, Simulink tool preference)
```

## Features

| Capability | Detail |
|---|---|
| Run MATLAB code | `mcp__matlab__evaluate_matlab_code` — code plus a project folder, returns the command-window output |
| Run scripts / tests | `run_matlab_file`, `run_matlab_test_file` |
| Static analysis | `check_matlab_code` — style, potential errors, deprecated functions, performance, best practices |
| Toolbox discovery | `detect_matlab_toolboxes` |
| Simulink model tools | `model_overview`, `model_read`, `model_query_params`, `model_resolve_params`, `model_edit`, `model_read_diagnostics`, `model_check`, `model_scan`, `model_test` |
| Expert skills | MathWorks Agentic Toolkit skills registered per group and loaded on demand through DSH's own `skill` tool |
| Open MATLAB button | A chat-header action opens a MATLAB desktop window; in `auto`/`existing` mode it opens a *shared* session so you watch the agent work in the same MATLAB |
| One-click setup | Downloads the official binary, the MATLAB-side toolbox and both toolkit repositories, then registers the Simulink toolkit path — **no manual step in MATLAB** |
| No manual operation | Default `sessionMode=new`: the plugin starts MATLAB itself (desktop visible) and you just talk to the agent |
| Network fallback | Optional mirror for blocked networks (**off by default**; only used after a direct failure, with PE/ZIP magic verification) |
| Process hygiene | On unload the plugin stops the MATLAB **it** started (decided by process parentage); a MATLAB you opened yourself is never touched |

## Upstream components

| Upstream | Role | What this plugin does |
|---|---|---|
| [`matlab/matlab-mcp-server`](https://github.com/matlab/matlab-mcp-server) (official Go binary) | The MCP server itself, mounted over stdio by DSH's `@deepseek-ai/dsh-mcp-client` | Download, verify, cache, build arguments and child environment |
| `MATLABMCPServerToolbox.mltbx` (same release) | Provides `shareMATLABSession()` for attaching to an existing MATLAB | Download and install automatically via `matlab -batch` |
| [`matlab/matlab-agentic-toolkit`](https://github.com/matlab/matlab-agentic-toolkit) | 24 groups of MATLAB skills | Sync locally, register as DSH skills |
| [`matlab/simulink-agentic-toolkit`](https://github.com/matlab/simulink-agentic-toolkit) | 11 groups of Simulink skills + 9 MCP extension tools | Sync, register skills, `addpath`+`savepath` the tool functions, pass `tools/tools.json` as `--extension-file` |

**Why a plugin at all?** DSH's MCP client bridges **tools only** — *"MCP resources and prompts are unsupported"*. So tools travel over MCP while the domain knowledge (the official MCP resources and the Agentic Toolkit skills) is injected through DSH's skill registry. That split is the whole point of this plugin.

## Requirements

| Item | Requirement | Verified here |
|---|---|---|
| MATLAB | R2021a+ (Simulink tools need R2023a+, `model_test` needs Simulink Test) | **R2025b (25.2.0.2998904)** with Simulink, Stateflow, Simulink Test, … (110 products) |
| DSH | 0.1.5+ (adapts to the 0.1.5 and 0.2 settings seams) | 0.2 series |
| Node.js | `^22.19.0 \|\| >=24` | v22.19.0 |
| Network | GitHub reachable for the first install; a mirror switch exists for restricted networks | direct link unstable, mirror works |

## Install

### New client: one command

```powershell
git clone https://github.com/MCviseron/dsh-matlab-mcp.git D:\dsh-matlab-mcp
cd D:\dsh-matlab-mcp
node scripts/install.mjs        # add --dry-run to preview
```

It installs the dependencies (which builds `lib/`), creates the `<DSH_HOME>/matlab-mcp-plugin` junction, wires every DSH profile (`dependencies`, `dsh.profile.bundles`, `cordis.patch.yml`), runs `pnpm install` in those profiles, and repairs any dangling `link:` junction (pnpm mishandles cross-drive `link:D:/...`, which otherwise makes *every* local plugin fail to load). Then restart DeepSeek Harness.

> Cloning and linking without that step reports `matlab-mcp (dsh-matlab-mcp): failed to import`, because the repository does not ship build output and the plugin resolves `@deepseek-ai/*` from its own `node_modules`. Run the installer, or `pnpm install && pnpm build` manually.

```powershell
# 1) link this repository into the DSH home
cmd /c mklink /J "$env:DSH_HOME\matlab-mcp-plugin" "D:\Program\DSH-Plugin-Class\dsh-matlab-mcp"

# 2) add to the profile package.json
#    dependencies:  "dsh-matlab-mcp": "link:C:/Users/<you>/.dsh/matlab-mcp-plugin"
#    dsh.profile.bundles: [ ..., "dsh-matlab-mcp" ]

# 3) add the config row to the profile cordis.patch.yml (see README.md)

# 4) install the link and restart DeepSeek Harness
cd "$env:DSH_HOME\profiles\web"; pnpm install
```

Then open **Settings → MATLAB / Simulink MCP** and press **Install / repair**. It downloads the MCP server binary into `$DSH_HOME/matlab-mcp/bin/`, installs the MATLAB toolbox, clones both toolkits, registers the Simulink toolkit path, and remounts the MCP client. Tools then appear as `mcp__matlab__*`.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Dispose the MCP client and unregister tools when off |
| `announceToAgent` | `true` | Inject MATLAB usage rules into the system prompt |
| `matlabRoot` | `""` | Empty = auto-detect the newest installation |
| `sessionMode` | `new` | `new` start our own / `auto` prefer a shared session / `existing` shared only |
| `displayMode` | `desktop` | `desktop` shows the MATLAB desktop, `nodesktop` is faster |
| `initialWorkingFolder` | `""` | Empty = `$DSH_HOME/matlab-mcp/workspace` |
| `simulinkTools` | `true` | Mount the 9 Simulink tools and register the toolkit path during setup |
| `skillsEnabled` | `true` | Register the Agentic Toolkit skills |
| `skillGroups` | `""` | Comma separated; empty = default groups; `none` disables all |
| `toolCallTimeoutMs` | `600000` | Per tool call; max 1800000 |
| `allowMirrorDownload` | `false` | Off by default; enables the mirror only after a direct failure |
| `downloadMirror` | `https://ghproxy.net/` | Mirror prefix; used only when the switch is on |
| `telemetry` | `false` | Off passes `--disable-telemetry=true` |
| `shutdownMatlabOnUnload` | `true` | Stop the MATLAB started by this plugin's MCP server on unload |

## Tools and skills

- Full tool reference (14 tools): [`docs/tools.md`](docs/tools.md).
- Default skill groups (32 skills): `matlab-core`, `matlab-programming`, `matlab-software-development`, `matlab-data-import-and-analysis`, `model-based-design-core`, `simulink-simulation`. Add other group names to `skillGroups` to enable more (for example `matlab-app-building`, `ai-and-statistics`, `verification-validation-and-test`).
- Skill text is MathWorks content, unmodified; it is downloaded at install time and never redistributed by this repository.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Error code `MIRROR_DISABLED` | Direct GitHub download failed and the mirror is off. Turn on "Allow mirror download" and retry |
| No `mcp__matlab__*` tools | The runtime is not provisioned yet. Press "Install / repair" |
| The first call takes 20–45 s | MATLAB cold start; later calls are fast |
| Tool call times out | Raise `toolCallTimeoutMs`, or turn a long job into a script plus a results file |
| Simulink tools report a missing function | The path-registration step did not run (it is skipped when `simulinkTools` is off); enable it and re-run setup |
| Logs | MCP server logs live in `$DSH_HOME/matlab-mcp/logs/`; "Refresh status" in the settings card shows binary version, MATLAB root and artifact presence |

## Acceptance

Item-by-item acceptance with raw evidence lives in [`docs/acceptance-2026-10-14.md`](docs/acceptance-2026-10-14.md) (typecheck/tests/build, MCP handshake, MATLAB execution, Simulink simulation, skills, idempotent setup, process cleanup).

## Development

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # 5 pure-logic suites: config unwrapping, download policy, path detection, launch args, skill parsing
pnpm build       # esbuild → lib/index.js (host) + lib/client.js (browser settings card)
pnpm check       # all three
```

## Versioning

Semantic versioning with a git tag per release; changes are recorded in [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog).

## License and trademarks

- Plugin code: Apache-2.0 ([LICENSE](LICENSE)).
- **No MathWorks artifact is redistributed** by this repository: the binary, the `.mltbx` and the skill text are downloaded from MathWorks' official GitHub during installation and are not modified. See the upstream repositories for their licenses (the Agentic Toolkits are under a MathWorks license restricted to use with MathWorks products; see `matlab-mcp-server/LICENSE.md`).
- MATLAB, Simulink and MathWorks are trademarks of The MathWorks, Inc. This project is not affiliated with or endorsed by MathWorks.
