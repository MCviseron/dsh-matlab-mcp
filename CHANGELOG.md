# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-10-14

### 修复

- **严重：点「一键安装 / 修复」后 DSH 客户端崩溃**（`dsh: fatal uncaught exception: Error: spawn ...bin\matlab-mcp-server-windows-x64.exe ENOENT`）。
  - **根因不是文件缺失**：libuv 在 **`cwd` 不存在**时同样报 `spawn <exe> ENOENT`（错误指向命令，实为 chdir 失败）。挂载配置的 `cwd` 指向 `<DSH_HOME>\matlab-mcp\workspace`，而全新机器上该目录从未被创建（一键安装只建了缓存根与 `logs/`）。新机器时间线：启动时还没有二进制 → 不挂载（安全）→ 点安装 → 二进制就位 → 路由 `reconnect()` → 用不存在的 `cwd` 启动 → 未捕获异常 → 宿主退出。
  - **实测对照**：同一个真实存在的 exe，`cwd` 正常 → `spawned ok`；`cwd` 不存在 → `ENOENT`，与崩溃日志逐字一致。
  - **修复（多层防护）**：① `buildLaunch` 构造启动配置时创建 `cwd` 与 `--log-folder`；② 挂载前用我们自己的 `execFile` 做 `--version` 预检，跑不起来的二进制不再交给 MCP 客户端，改为可操作报错；③ 挂载配置在 `ctx.inject(['tools'])` 回调内**现算**，压掉「检查存在」与「真正 spawn」之间的窗口；④ `probeMcp` 补上 `child.on('error')`（此前缺该监听，同样会变成未捕获异常）；⑤ 下载改为**暂存校验后再原子换入**（校验在 `.partial` 上做），失败只清理暂存文件；`ensureBinary` 不再「先删后下」，也不再对下载后跑不起来的二进制返回成功。
- **这是 DSH 侧 `dsh-mcp-client` 的健壮性缺陷**：子进程 `spawn` 失败以未捕获异常终止宿主。插件已从自身侧消除可预见的触发条件，仍建议向上游反馈「`ChildProcess` 的 `'error'` 事件必须被捕获」。

### 变更

- **多镜像 + 镜像优先**：`downloadMirror` 改为逗号分隔的模板列表（支持 `{url}` 前缀式、`{path}` 换主机式，兼容老的纯前缀写法）；开启镜像后**镜像优先、直连兜底**（实测直连 0.21 MB/s vs 镜像 2.5–9.5 MB/s）。
- **默认镜像按实测重排**：`gh-proxy.com` → `gh.llkk.cc` → `ghproxy.net`（2026-10-14 关梯子实测：gh-proxy.com 2.53 MB/s / codeload 9.51 MB/s，ghproxy.net 0.03 MB/s，其余候选全部不通）。
- **技能仓优先走 zipball**（开启镜像时）：codeload 经镜像实测 9.5 MB/s（40 MB ≈ 5 秒）；`git clone` 直连 GitHub、绕不过镜像，退居兜底。解压成功后才切换目录，失败不会毁掉已有技能仓。
- **设置卡新增「镜像测速」**：对真实制品测 TTFB 与吞吐，并可一键「把最快的排到最前」——镜像存活期常常只有几小时，写死排序必然过期。
- README 排障表补充：崩溃日志读法（`ENOENT` ≠ 文件不存在）与杀毒软件隔离的应对。

## [0.3.1] - 2026-10-14

### 修复

- **内联版在 DSH 里加载失败（`matlab-mcp (dsh-matlab-mcp): failed to import`）**：
  - **现象**：0.3.0 的 `lib/index.js` 在 `node -e`、DSH 自带 Node、Electron-as-Node 三种独立进程里都能 import，但 DSH 启动时该 entry 的 `fiber` 始终是 `undefined`（`dsh-app-boot` 把 `fiber === undefined` 归类为 `failed to import`，真实异常只打到控制台）。
  - **定位**：把 DSH 宿主的 Electron 进程当作测试环境（`run_code` 就运行在其中），用与加载器相同的 `await import(file://…)` 复现出真实异常：
    `Error: Dynamic require of "child_process" is not supported at lib/index.js:11:9`（栈上是 `cross-spawn` ← MCP SDK）。
  - **根因**：把 CJS 依赖内联进 ESM bundle 后，esbuild 会把它们的 `require('child_process')` 改写成 `__require` 垫片；ESM 里没有 `require` 绑定时该垫片直接抛错 —— 只有真正走到宿主加载路径才会触发。
  - **修复**：`build.mjs` 给宿主 bundle 加 banner，用 `createRequire(import.meta.url)` 恢复 CJS 全局（`require` / `__filename` / `__dirname`）。
  - **验证**：在宿主 Electron 进程内 `await import()` 成功，`resolveConfig` / `Config` / `buildLaunch` 均正常。
- **CI 增补**：`inlined CJS dependencies must have their globals`（检查 banner 关键字）与 `the host bundle must import cleanly`（真实 import + 导出形状断言），防止同类问题再溜过去。

## [0.3.0] - 2026-10-14

### 变更

- **插件改为「clone 下来就能用」**：
  - 宿主 bundle 现在**内联全部运行时依赖**（`@deepseek-ai/dsh-mcp-client`、`dsh-settings`、`schemastery` 等），`lib/index.js` 只依赖 Node 内置模块 —— 实测把 `node_modules` 整个移走后仍能 `import` 成功（`IMPORT OK -> Config,MATLAB_MCP_SETTINGS_NAMESPACE,apply,buildLaunch,inject,resolveConfig`）。
  - **`lib/` 随仓库提交**（移出 `.gitignore`），新客户端 `git clone` 后无需 `pnpm install` / `pnpm build` 即可加载。
  - `scripts/install.mjs` 相应简化：不再强制安装依赖与构建，只做接线（建 `%DSH_HOME%` 联接 → 写 profile → 建立/修复 `node_modules` 联接），**没有 pnpm 也能装**；新增 `--rebuild` 供开发者从源码重建。
- **CI（`.github/workflows/check.yml`）**：每次 push 跑 `typecheck` + 6 套测试 + `build`，并校验 ① `lib/` 与全新构建一致（不会悄悄过期）② `lib/index.js` 里不再残留 `@deepseek-ai/*` 外部 import（保证自包含）。
- `dependencies` 清空（依赖已内联），相关包移入 `devDependencies`。

## [0.2.1] - 2026-10-14

### 新增

- **新客户端一键安装器 `scripts/install.mjs`**：`git clone` 后在仓库里跑 `node scripts/install.mjs` 即可完成全部接线 ——
  ① 仓库内 `pnpm install`（`prepare` 顺带构建 `lib/index.js`）；
  ② 在 `%DSH_HOME%` 建 `matlab-mcp-plugin` 联接指向仓库（同盘路径，规避 pnpm 跨盘 `link:` 问题）；
  ③ 给每个存在的 profile 写 `dependencies` / `dsh.profile.bundles` / `cordis.patch.yml`；
  ④ 在 profile 内 `pnpm install`，并**统一修复所有失效的 `link:` 联接**（含其它本地插件）；
  ⑤ 打印后续步骤。支持 `--dry-run` / `--profile <name>` / `--skip-profile-install`，`pnpm` 缺失时给出 DSH 自带 pnpm 的用法。

### 修复

- **新客户端启动报 `matlab-mcp (dsh-matlab-mcp): failed to import`**：根因是仓库按惯例不提交构建产物（`lib/` 被 `.gitignore` 排除）且插件从自身 `node_modules` 解析 `@deepseek-ai/*`，全新克隆后两者都不存在。安装器与文档（README「安装」第 0 节 + 排障表）现在明确覆盖这一路径。

## [0.2.0] - 2026-10-14

### 新增

- **聊天主界面「打开 MATLAB」按钮**：注册到会话标题栏动作位 `conversation.session.header.actions`（独立于设置页的第二个 UI 入口），点击即打开 MATLAB 桌面窗口。
  - `new` 会话模式：打开独立 MATLAB 桌面窗口，按钮提示里说明 Agent 使用的是它自己启动的会话。
  - `auto` / `existing` 会话模式：以 `-r shareMATLABSession` 打开**共享**会话，MCP 服务器随后连到同一个 MATLAB —— 你能在窗口里直接看着 Agent 干活。
  - 以 `detached + unref` 启动，窗口独立于插件生命周期：插件卸载不会关掉它（脚本 `scripts/open-matlab.ts` 实测：新 MATLAB 进程出现，且归属判定为「非本插件所有」）。
  - 新增宿主路由 `POST /api/dsh-matlab-mcp/open-matlab` 与 `buildMatlabDesktopArgs` 单测。

## [0.1.0] - 2026-10-14

首次发布：把 DSH 接到 MathWorks 官方 MATLAB MCP Server，实现「用自然语言让 Agent 自己动手跑 MATLAB / Simulink」。

### 新增

- **宿主半边**
  - 通过 `@deepseek-ai/dsh-mcp-client` 以 stdio 挂载官方 MATLAB MCP Server，工具命名空间 `mcp__matlab__*`。
  - 启动参数构造：`--matlab-root`、`--matlab-session-mode`、`--matlab-display-mode`、`--initial-working-folder`、`--extension-file`、`--log-folder`、`--log-level`、`--disable-telemetry`；`sessionMode=existing` 时按上游要求省略 root/folder/display。
  - 子进程环境显式传递 `windir`/`SystemRoot`/`PATH`/`TEMP` 等：上游 Simulink 文档指出剥离环境变量会导致 Simulink 失败，而 DSH 的 MCP 客户端只把配置里的 `env` 合并进脱敏环境。
  - 单次工具调用超时默认 600000 ms（MATLAB 冷启动 20–45 秒，仿真可达数分钟），上限 1800000 ms。
  - 挂载串行化 + 等待上一次 fiber 释放（MCP 客户端对 `serverName` 有唯一性守卫）。
  - 系统提示词注入（`plugin:matlab-mcp`，order 212）：工具用法、时间预期、图窗必须导出 PNG 才能被看见、Simulink 优先用专用工具、先探测产品再动手、错误先加载调试技能。
  - 多代设置接缝自适应（0.2 `configure` / 0.1.5 `installSection` / ≤0.1.1 `register`），`volatile` 配置活值解包（复用同族插件的排查结论）。
- **一键供给**（`POST /api/dsh-matlab-mcp/setup`）
  - 下载并校验官方 MCP 服务器二进制（PE 魔数 + `--version`，按平台选制品名）。
  - 下载 `MATLABMCPServerToolbox.mltbx` 并调用 `matlab -batch "matlab.addons.toolbox.installToolbox(...)"` 自动安装。
  - `git clone --depth 1`（失败则 zip 下载 + `tar -xf` 兜底）同步 MATLAB / Simulink Agentic Toolkit。
  - `addpath(genpath(<simulink-toolkit>/tools))` + `savepath`，让 9 个 Simulink 扩展工具的函数在每个 MATLAB 会话可见。
  - 幂等：已存在且可用的制品直接复用。
- **下载策略**（`src/download.ts`）
  - 直连优先；**镜像默认关闭**，直连失败且未开启镜像时抛出带有可操作提示的错误码 `MIRROR_DISABLED`。
  - 原子写入（`.partial` → rename）、空文件拒绝、可插拔校验回调。
- **技能注入**（`src/skills-catalog.ts`、`src/skills-provider.ts`）
  - 实现 DSH `SkillProvider`，扫描两个工具包 `skills-catalog/**/SKILL.md`（含 frontmatter 与 `manifest.yaml` 的 `requires-products`）。
  - 按技能组过滤，默认 6 组共 32 个技能；`none` 关闭全部；rank 500（用户自有技能优先）。
  - 设置变更或工具包同步后 `invalidate()` 热刷新。
- **进程卫生**（`src/matlab-processes.ts`）
  - 插件卸载时按父子进程链判定「由本插件 MCP 服务器启动的 MATLAB」并关闭；手动打开的 MATLAB 不受影响。
- **设置卡**（浏览器半边）
  - 14 个字段、状态面板（二进制版本 / 工具箱 / 技能仓 / MATLAB 路径）、6 个动作按钮（保存、一键安装修复、测试连接、深度自检、重连、刷新状态、恢复默认）。
  - 独立的设置命名空间桥（`/settings/describe`、`/settings/mutate`），与 DSH 0.1.5 / 0.2 两代兼容。
- **文档**：中文为主 README、英文 README、`docs/tools.md`（14 个工具的参数说明）、`scripts/`（可复跑的真实验证脚本）、验收记录 `docs/acceptance-2026-10-14.md`。

### 修复

- **Windows 下 `matlab -batch` 吞掉内层双引号**：`matlab -batch "disp(\"x\")"` 会被拆词，导致安装工具箱、`savepath`、`which` 全部失败且 stdout 为空。改为把代码写入 `<cache>/tmp/<name>.m`，以「`-batch <脚本名>` + `cwd` 指向该目录」执行 —— 单一 token、无引号，任意代码（含引号与换行）都能安全通过。
- **`src/index.ts` 的路由 `getConfig` 类型**：暴露解析后的配置（`ResolvedConfig`）而不是原始活值配置。
- **MATLAB 安装选择**：调用方传入的候选列表也会按发布版排序，避免「谁在后面谁生效」的隐式行为。

### 说明

- 本仓库不携带任何 MathWorks 制品；二进制、`.mltbx` 与技能文本均在安装时从 MathWorks 官方 GitHub 下载且不修改。
- **profile 联接**：DSH 通过 profile 的 `node_modules` 解析插件包。pnpm 对 `link:D:/...`（与 profile 不同盘符）会生成无效联接，导致重启后所有本地插件都不加载。请使用 `link:C:/Users/<user>/.dsh/<name>-plugin` 形态（该路径做 `mklink /J` 指向仓库），或在 `pnpm install` 后用 `mklink /J` 修复 `node_modules/<name>`。

[Unreleased]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MCviseron/dsh-matlab-mcp/releases/tag/v0.1.0
