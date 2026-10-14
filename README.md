# dsh-matlab-mcp

**中文** | [English](README.en.md)

让 DeepSeek Harness（DSH）的 Agent **直接动手操作 MATLAB 与 Simulink** 的插件：执行 MATLAB 代码、运行 `.m` 脚本与单元测试、做代码静态检查、读写/查询/检查/仿真 Simulink 模型 —— 全部通过 **MathWorks 官方 MATLAB MCP Server** 完成，并注入 **MATLAB / Simulink Agentic Toolkit** 的专家技能。

> 这不是"在 MATLAB 里塞一个 AI"，而是反过来：**MATLAB 作为 MCP 服务器被 DSH 调用**。DSH 侧只做三件事：挂载官方 MCP 服务器、一键供给官方制品、把官方技能注册进技能目录。

```
你 ──自然语言──▶ DSH Agent
                   ├─ 工具  mcp__matlab__<tool>  ──stdio MCP──▶ MATLAB MCP Server(官方 exe) ──▶ MATLAB / Simulink
                   ├─ 技能  matlab-* / simulink-*  ── 来自两个官方 Agentic Toolkit
                   └─ 系统提示词注入（调用规范、超时、图窗导出、Simulink 工具优先级）
```

---

## 目录

- [特性](#特性)
- [架构与上游](#架构与上游)
- [环境要求](#环境要求)
- [安装](#安装)
- [配置项](#配置项)
- [工具清单](#工具清单)
- [技能注入](#技能注入)
- [使用示例](#使用示例)
- [排障](#排障)
- [卸载](#卸载)
- [验收](#验收)
- [开发](#开发)
- [版本与变更](#版本与变更)
- [许可证与商标](#许可证与商标)

---

## 特性

| 能力 | 说明 |
|---|---|
| 执行 MATLAB 代码 | `mcp__matlab__evaluate_matlab_code`：给一段代码 + 工作目录，返回命令窗口输出 |
| 运行脚本 / 测试 | `run_matlab_file`、`run_matlab_test_file`（MATLAB 单元测试框架） |
| 静态检查 | `check_matlab_code`：不执行代码，报出风格/潜在错误/弃用函数/性能问题 |
| 工具箱探测 | `detect_matlab_toolboxes`：列出已安装产品与版本 |
| Simulink 模型操作 | `model_overview`、`model_read`、`model_query_params`、`model_resolve_params`、`model_edit`、`model_read_diagnostics`、`model_check`、`model_scan`、`model_test` |
| 专家技能 | 按组注册 MathWorks Agentic Toolkit 技能（调试、代码评审、Live Script、建模仿真最佳实践…），用标准 `skill` 工具按需加载 |
| 打开 MATLAB 按钮 | **聊天主界面**标题栏有一个「打开 MATLAB」按钮，点一下弹出 MATLAB 桌面窗口；`auto`/`existing` 模式下打开的是**共享会话**，你可以直接在窗口里看 Agent 干活 |
| 一键安装 | 设置卡「一键安装 / 修复」：自动下载官方二进制、MATLAB 端工具箱、两个技能仓，并注册 Simulink 工具包路径。**全程不需要你手动打开 MATLAB** |
| 零手动 | 默认 `sessionMode=new`：插件自己启动 MATLAB（桌面可见），你只需要用自然语言下命令 |
| 网络兜底 | 直连 GitHub 失败时可选用镜像（**默认关闭**，开启后仅在直连失败时启用，并校验 PE/ZIP 魔数） |
| 进程卫生 | 插件卸载时按父子进程归属关闭**它自己启动的** MATLAB，绝不动你手动打开的那个 |
| 中英双语 UI | 设置卡与文档均中英对齐 |

## 架构与上游

本插件**不重造 MCP 桥**，全部使用 MathWorks 官方制品：

| 上游 | 作用 | 本插件的角色 |
|---|---|---|
| [`matlab/matlab-mcp-server`](https://github.com/matlab/matlab-mcp-server)（官方 Go 二进制） | MCP 服务器本体，被 DSH 的 `@deepseek-ai/dsh-mcp-client` 以 stdio 方式挂载 | 下载、校验、缓存、构建启动参数与环境变量 |
| `MATLABMCPServerToolbox.mltbx`（同上 release） | 提供 `shareMATLABSession()`，用于接管已有 MATLAB 会话 | 下载并调用 `matlab -batch` 自动安装 |
| [`matlab/matlab-agentic-toolkit`](https://github.com/matlab/matlab-agentic-toolkit) | 24 组 MATLAB 技能 | 同步到本地缓存，注册为 DSH 技能 |
| [`matlab/simulink-agentic-toolkit`](https://github.com/matlab/simulink-agentic-toolkit) | 11 组 Simulink 技能 + 9 个 MCP 扩展工具（`tools/tools.json`） | 同步、注册技能、`addpath`+`savepath` 注册工具函数路径、把 `tools.json` 作为 `--extension-file` 传给 MCP 服务器 |

**为什么需要一个 DSH 插件？** 因为 DSH 的官方 MCP 客户端 `@deepseek-ai/dsh-mcp-client` 只桥接 **tools**（[官方文档](https://github.com/deepseek-ai/deepseek-harness)：*"This package bridges tools only; MCP resources and prompts are unsupported"*）。所以：工具走 MCP，**领域知识（官方 MCP resources + Agentic Toolkit 技能）改由 DSH 的技能系统注入** —— 这正是本插件的价值。

## 环境要求

| 项目 | 要求 | 本机实测 |
|---|---|---|
| MATLAB | R2021a 或更高（Simulink 工具需 R2023a+，`model_test` 需 Simulink Test） | **R2025b（25.2.0.2998904）**，含 Simulink / Stateflow / Simulink Test 等 110 个产品 |
| DSH | 0.1.5 及以上（插件按 0.1.5 / 0.2 两代设置接缝自适应） | 0.2.0 系列 |
| Node.js | `^22.19.0 || >=24` | v22.19.0 |
| 网络 | 首次安装需访问 GitHub；受限网络可开启镜像开关 | 直连不稳，镜像可用 |

## 安装

### 0. 直接安装（推荐，两条命令）

```powershell
git clone https://github.com/MCviseron/dsh-matlab-mcp.git D:\dsh-matlab-mcp
node D:\dsh-matlab-mcp\scripts\install.mjs     # 加 --dry-run 可先预演
```

**不需要 `pnpm install`，也不需要构建**：仓库自带 `lib/`，且宿主 bundle 把所有运行时依赖（`@deepseek-ai/dsh-mcp-client` 等）都打进去了，只依赖 Node 内置模块。安装器只做接线：

1. 在 `%DSH_HOME%` 建 `matlab-mcp-plugin` 联接指向仓库（**同盘路径**，规避 pnpm 跨盘 `link:D:/...` 生成无效联接的问题）；
2. 给每个存在的 profile 写 `dependencies` / `dsh.profile.bundles` / `cordis.patch.yml`；
3. 直接建立（或修复）`node_modules` 里的联接 —— 有 pnpm 时顺带跑一次 `pnpm install`，**没有 pnpm 也能装**；顺带修复其它本地插件失效的 `link:` 联接；
4. 打印后续步骤。

跑完**重启 DeepSeek Harness**，再做下面第 2 步的「一键安装运行时」。

> 兼容性说明：`lib/` 随仓库提交，CI（`.github/workflows/check.yml`）会在每次 push 时重新构建并校验 `lib/` 与 `src/` 一致、且 bundle 里不再有 `@deepseek-ai/*` 外部 import —— 所以「提交构建产物」不会变成悄悄过期的坑。

### 1. 手动安装插件本体

不想用脚本就手工接线（同样**不需要构建**，仓库自带 `lib/`）：

```powershell
# 1) 在 DSH 主目录建一个指向本仓库的联接
cmd /c mklink /J "$env:DSH_HOME\matlab-mcp-plugin" "D:\Program\DSH-Plugin-Class\dsh-matlab-mcp"

# 2) 在 profile 的 package.json 里加依赖与 bundle
#    "dependencies": { "dsh-matlab-mcp": "link:C:/Users/<你>/.dsh/matlab-mcp-plugin" }
#    "dsh.profile.bundles": [ ..., "dsh-matlab-mcp" ]

# 3) 在 profile 的 cordis.patch.yml 里加一行（见下）
# 4) 建立联接（有 pnpm 时用 pnpm install；没有 pnpm 就直接 mklink）
cd "$env:DSH_HOME\profiles\web"; pnpm install
# 若发现某些插件的 node_modules 联接失效（指向 C:\...\profiles\<p>\D:\...），用 mklink /J 逐个修复
```

`cordis.patch.yml` 追加：

```yaml
- id: matlab-mcp
  name: dsh-matlab-mcp
  config:
    enabled: true
    sessionMode: new
    displayMode: desktop
    simulinkTools: true
    toolCallTimeoutMs: 600000
    allowMirrorDownload: false
```

然后**重启 DeepSeek Harness**（新增 bundle 需要重新读取插件清单）。

### 2. 一键安装运行时（在 DSH 设置里）

打开 **设置 → MATLAB / Simulink MCP**，点 **「一键安装 / 修复」**。它会：

1. 下载 `matlab-mcp-server-<平台>` 到 `$DSH_HOME/matlab-mcp/bin/`（校验 PE 魔数 + `--version`）；
2. 下载 `MATLABMCPServerToolbox.mltbx` 并用 `matlab -batch` 自动安装（拿到 `shareMATLABSession`）；
3. `git clone`（失败则 zip 兜底）两个 Agentic Toolkit 到 `$DSH_HOME/matlab-mcp/toolkits/`；
4. `addpath(genpath(<simulink-toolkit>/tools))` + `savepath`，让 9 个 Simulink 工具函数在**每个** MATLAB 会话里可见；
5. 重新挂载 MCP 客户端 —— 工具以 `mcp__matlab__*` 出现在会话里。

> 若直连 GitHub 失败，会返回 `MIRROR_DISABLED` 错误并提示你打开「允许镜像下载」，不会静默走第三方。

## 制品获取（镜像 / 本地目录）

插件默认**直连 GitHub**；国内网络可配置镜像或本地制品目录（两者都可选，默认关闭）：

```yaml
allowMirrorDownload: true
downloadMirror: "https://你的镜像/{path},https://gh-proxy.com/{url}"   # {path} 换主机式 / {url} 前缀式，逗号分隔按序回退
localAssetsDir: "D:\matlab-mirror"                                   # 命中即直接复制、零网络请求（优先级：本地 → 镜像 → 直连）
```

**服务器侧的部署工具不在插件里**：自建静态镜像、nginx 反代配置生成、备案与端口注意事项，见 [`deploy/`](deploy/README.md)。
那份工具与插件运行无关，npm 包也不包含它（`files` 字段里没有 `deploy/`）。

## 配置项

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 关闭则卸载 MCP 客户端，不再注册 `mcp__matlab__*` |
| `announceToAgent` | `true` | 把 MATLAB 使用规范注入系统提示词 |
| `matlabRoot` | `""` | 留空 = 自动探测最新安装（本机探测到 `D:\MATLAB\2025b`） |
| `sessionMode` | `new` | `new` 自启 / `auto` 优先接管已共享会话 / `existing` 只连已共享会话 |
| `displayMode` | `desktop` | `desktop` 显示 MATLAB 桌面；`nodesktop` 不显示（更快） |
| `initialWorkingFolder` | `""` | 留空 = `$DSH_HOME/matlab-mcp/workspace` |
| `simulinkTools` | `true` | 挂载 9 个 Simulink 工具，并在安装时注册工具包路径 |
| `skillsEnabled` | `true` | 把两个 Agentic Toolkit 的技能注册进技能目录 |
| `skillGroups` | `""` | 逗号分隔的技能组；留空 = 默认组；`none` = 全部关闭 |
| `toolCallTimeoutMs` | `600000` | 单次工具调用超时（10 分钟）；上限 30 分钟 |
| `allowMirrorDownload` | `false` | **默认关闭**；直连失败时才用镜像下载官方制品 |
| `localAssetsDir` | `""` | 本地制品目录（`mirror-assets.mjs` 产出的那种布局）。命中即**直接复制、零网络请求**；优先级 本地 → 镜像 → 直连 |
| `downloadMirror` | `https://gh-proxy.com/{url},https://gh.llkk.cc/{url},https://ghproxy.net/{url}` | 镜像**列表**（逗号分隔，按顺序回退）。模板：`{url}` 前缀式、`{path}` 换主机式，老的纯前缀写法仍兼容。开启开关后镜像优先、直连兜底 |
| `telemetry` | `false` | 关闭时传 `--disable-telemetry=true` 给 MCP 服务器 |
| `shutdownMatlabOnUnload` | `true` | 插件卸载时关闭**由本插件启动**的 MATLAB（按父子进程归属判定） |

## 工具清单

完整参数与返回说明见 [`docs/tools.md`](docs/tools.md)。会话中看到的名字带 `mcp__matlab__` 前缀。

**内置 5 个**：`detect_matlab_toolboxes`、`check_matlab_code`、`evaluate_matlab_code`、`run_matlab_file`、`run_matlab_test_file`

**Simulink 扩展 9 个**（来自 Simulink Agentic Toolkit 的 `tools/tools.json`）：`model_overview`、`model_read`、`model_query_params`、`model_resolve_params`、`model_edit`、`model_read_diagnostics`、`model_check`、`model_scan`、`model_test`

## 技能注入

技能来自两个官方仓的 `skills-catalog/<group>/<skill>/SKILL.md`，通过 `ctx.skills.registerProvider` 注册为 DSH 技能，用标准 `skill` 工具按需加载（不占用常驻上下文）。默认组（32 个技能）：

| 组 | 技能数 | 内容 |
|---|---|---|
| `matlab-core` | 6 | 调试、代码评审、Live Script、文档查询、产品安装/列举 |
| `matlab-programming` | 1 | 带参数校验的健壮函数 |
| `matlab-software-development` | 11 | 测试、性能/内存优化、文档、工具箱打包、工程与构建计划 |
| `matlab-data-import-and-analysis` | 4 | 表格/时间表/大数据方案、凭证安全 |
| `model-based-design-core` | 11 | 建模、仿真、需求草稿、模型清理、缺陷报告 |
| `simulink-simulation` | 3 | 仿真输入、SDI 运行、批量仿真 |

`skillGroups` 填其它组名即可启用（例如 `matlab-app-building`、`ai-and-statistics`、`verification-validation-and-test`…）。技能内容是 MathWorks 官方原文，本插件不修改。

## 使用示例

安装完成后，直接用自然语言即可，例如：

- 「用 MATLAB 算一下这个矩阵的特征值，并把结果写成 csv 放到当前工程」
- 「画一张阻尼比 0.1~1.0 的阶跃响应对比图，导出 PNG 给我看」
- 「在 Simulink 里建一个 PID 控制二阶系统的模型，跑 10 秒仿真，给我超调量和稳态误差」
- 「检查我工程里所有 .m 文件的代码规范问题」

Agent 会自动：先 `detect_matlab_toolboxes` 探测 → 需要时加载对应技能 → 用 `evaluate_matlab_code`/`run_matlab_file` 执行 → 需要看图就先 `exportgraphics` 导出 PNG 再自己看 → Simulink 场景优先用 `model_*` 工具。

## 排障

| 现象 | 原因与处理 |
|---|---|
| 错误码 `MIRROR_DISABLED` | 直连 GitHub 失败且镜像未开启。设置里打开「允许镜像下载」后重试 |
| 启动日志：`matlab-mcp (dsh-matlab-mcp): failed to import` | 插件入口加载失败。① 你的仓库副本是 0.2.x 或更早（那时 `lib/` 不进仓库）→ `git pull` 到 0.3.0+（自带 `lib/`）；② profile 里的 `node_modules` 联接失效（见下一条）；③ 自己改过 `src/` 却没重新 `pnpm build`。跑 `node scripts/install.mjs` 可一次处理接线问题 |
| 启动日志：多个插件同时 `failed to activate` / `failed to import` | profile 的 `node_modules` 里 `link:` 联接坏了（pnpm 对 `link:D:/...` 跨盘路径会生成无效联接，指向 `C:\...\profiles\<p>\D:\...`）。用 `mklink /J <profile>\node_modules\<插件名> <真实目录>` 逐个修复，或直接重跑 `node scripts/install.mjs`（它会统一修复） |
| 客户端**直接崩溃**并生成 `crash-*-host.log`，里面有 `spawn ...matlab-mcp-server-windows-x64.exe ENOENT` | **`ENOENT` 不代表文件不存在** —— libuv 在 `cwd` 不存在时也报这个错。0.4.0 起插件会自动创建工作目录并在挂载前预检二进制；若你还在 0.3.x：升级，或先手工 `mkdir "%USERPROFILE%\.dsh\matlab-mcp\workspace"` 再重试。这也是 DSH 侧 `dsh-mcp-client` 未捕获 spawn 错误导致宿主退出的健壮性缺陷 |
| 安装极慢或卡在下载 | 点设置卡「**镜像测速**」，再点「把最快的排到最前」。镜像存活期常常只有几小时（实测 `ghproxy.net` 数小时内从可用掉到 0.03 MB/s），默认列表会过期 |
| `not-provisioned` / 没有 `mcp__matlab__*` 工具 | 还没安装运行时。点设置卡「一键安装 / 修复」 |
| 首次调用很慢（20–45 秒） | MATLAB 冷启动，属正常；之后再调用是秒级 |
| 工具调用超时 | 调大 `toolCallTimeoutMs`，或把长任务改成写脚本 + 轮询结果文件 |
| Simulink 工具报找不到函数 | 一键安装的第 4 步没跑（`simulinkTools` 关闭时不会注册路径）；开启后重跑安装 |
| 你手动打开的 MATLAB 被关掉了 | 不应该发生：只关闭父进程链上属于本插件 MCP 服务器的 MATLAB。若出现请提 issue |
| 想看日志 | MCP 服务器日志在 `$DSH_HOME/matlab-mcp/logs/`；设置卡「刷新状态」显示二进制版本、MATLAB 路径、工具箱/技能仓是否就位 |

## 卸载

1. 设置卡关闭 `enabled`（立刻卸载 MCP 客户端、注销技能与工具）；
2. 从 profile 的 `package.json`（`dependencies` + `dsh.profile.bundles`）与 `cordis.patch.yml` 移除 `dsh-matlab-mcp` 行，`pnpm install`，重启 DSH；
3. 删除 `$DSH_HOME\matlab-mcp`（缓存，约 70 MB，含二进制、工具包、技能仓）；
4. 如需彻底清理 MATLAB 侧：在 MATLAB 里 `matlab.addons.toolbox.uninstallToolbox(...)` 卸载 MATLAB MCP Server Toolbox，并用 `rmpath` 去掉 Simulink 工具包路径（`savepath`）。

## 验收

逐项验收清单与**原始证据**（命令输出、工具返回、截图）见 [`docs/acceptance-2026-10-14.md`](docs/acceptance-2026-10-14.md)。

| # | 验收项 | 通过标准 |
|---|---|---|
| A | 静态质量 | `pnpm typecheck && pnpm test && pnpm build` 全绿；插件加载无报错 |
| B | 桥连通 | `mcp__matlab__detect_matlab_toolboxes` 返回 R2025b + Simulink |
| C | 执行代码 | 自然语言算 `sum(1:10)`=55；画图导出 PNG 并视觉复核 |
| D | Simulink 仿真 | 脚本建模型 + `sim()` 取仿真结果，全程无人工点击 |
| E | Simulink 工具 | `model_overview`/`model_read`/`model_scan` 返回结构化结果 |
| F | 技能注入 | 技能出现在目录、`skill()` 可加载、行为符合技能指引 |
| G | 零手动 | 删缓存后一键安装即可复现 B–F |
| H | 稳定性 | 安装幂等、卸载无残留、无孤儿 MATLAB 进程 |
| I | 文档 | 本 README、`docs/tools.md`、CHANGELOG、验收记录、可复跑验证脚本 `scripts/` |

## 开发

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # 5 个纯逻辑测试套件（配置解包/下载策略/路径探测/启动参数/技能解析）
pnpm build       # esbuild → lib/index.js（宿主）+ lib/client.js（浏览器设置卡）
pnpm check       # 三者串跑
```

源码结构：

| 文件 | 职责 |
|---|---|
| `src/index.ts` | 宿主半边：配置 schema、挂载 MCP 客户端、系统提示词段、技能提供者注册、设置接缝适配 |
| `src/provision.ts` | 一键供给：二进制/工具箱/技能仓下载与安装、Simulink 路径注册、`runSetup` |
| `src/download.ts` | 下载策略（直连→镜像、镜像默认关闭）、原子写入、魔数校验 |
| `src/paths.ts` | 缓存布局、平台制品名、MATLAB 安装探测与选择 |
| `src/server-args.ts` | MCP 服务器启动参数与子进程环境（Windows `windir`/`PATH` 显式传递） |
| `src/selftest.ts` | 最小 MCP stdio 客户端（设置卡「测试连接 / 深度自检」用） |
| `src/skills-catalog.ts` + `src/skills-provider.ts` | 技能发现/解析/过滤 + DSH `SkillProvider` |
| `src/matlab-processes.ts` | 按父子进程归属回收本插件启动的 MATLAB |
| `src/routes.ts` | 宿主 HTTP 路由：status/setup/test/reconnect/diagnostics + 设置桥 |
| `src/client/*` | 浏览器半边：设置卡、文案（中/英）、设置命名空间读写 |

## 版本与变更

- 语义化版本；每次发布打 tag（`v0.1.0`）。
- 变更记录见 [CHANGELOG.md](CHANGELOG.md)（Keep a Changelog 格式）。
- 与 DSH 的兼容性：设置接缝、`ctx.inject(['tools'])` 挂载、`volatile` 配置解包均按 0.1.5 / 0.2 两代自适应，详见 CHANGELOG。

## 许可证与商标

- 本插件代码：Apache-2.0（见 [LICENSE](LICENSE)）。
- **不随仓库分发**任何 MathWorks 制品：二进制、`.mltbx`、技能文本都在安装时从 MathWorks 官方 GitHub 下载，且不修改其内容。上游许可见各自仓库（`matlab-agentic-toolkit` / `simulink-agentic-toolkit` 为 MathWorks 许可，限制用于配合 MathWorks 产品；`matlab-mcp-server` 见其 `LICENSE.md`）。
- MATLAB、Simulink、MathWorks 是 The MathWorks, Inc. 的商标。本项目与 MathWorks 无隶属或背书关系。
