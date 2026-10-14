# 验收记录 / Acceptance record — 2026-10-14

**被测版本**：dsh-matlab-mcp `0.1.0`（commit `5fd38df` + 本次修复提交）
**执行人**：DSH Agent（在真实桌面环境内执行，非模拟）

## 环境

| 项目 | 值 |
|---|---|
| 主机 | Windows 11 家庭版 中文版 10.0 (Build 26200) |
| MATLAB | **R2025b**（25.2.0.2998904），license 968398，110 个产品，含 Simulink / Stateflow / Simulink Test / Control System Toolbox 等 |
| MATLAB 安装目录 | `D:\MATLAB\2025b`（自动探测命中，未手填） |
| DSH | 桌面版，profile = `C:\Users\25639\.dsh\profiles\desktop` |
| Node.js | v22.19.0 |
| 插件缓存 | `C:\Users\25639\.dsh\matlab-mcp`（68.3 MB） |
| 上游 MCP Server | `github.com/matlab/matlab-mcp-server` v0.14.0（官方 Windows x64 二进制，19,502,944 B） |
| 技能来源 | `matlab/matlab-agentic-toolkit`、`matlab/simulink-agentic-toolkit` 官方仓 clone |

---

## A. 静态质量 — ✅

```
$ pnpm typecheck    → tsc --noEmit 无输出（0 错误）
$ pnpm test         → ALL PASS ×6（6 个测试套件）
$ pnpm build        → built lib/index.js and lib/client.js
```

六个套件（纯逻辑，不依赖 MATLAB/网络）：`config-values`（配置活值解包 / 枚举回退）、`download`（镜像默认关闭与 `MIRROR_DISABLED` 文案）、`paths`（发布版排序、MATLAB 探测与选择顺序）、`server-args`（`-batch` 参数与环境透传）、`skills`（frontmatter 解析、组过滤、默认组）、`matlab-processes`（MATLAB 归属判定：只回收本插件服务器派生的进程）。

插件加载无报错：重启后 `matlab` 命名空间注册了 **14 个工具**，技能目录出现了 32 个 MathWorks 官方技能（见 F）。

## B. 桥连通 — ✅

`mcp__matlab__detect_matlab_toolboxes`（DSH 会话内经 MCP 调用）：

```
MATLAB 版本: 25.2.0.2998904 (R2025b)
MATLAB 许可证编号: 968398
操作系统: Microsoft Windows 11 家庭版 中文版 Version 10.0 (Build 26200)
```

底层握手（自检模块 `src/selftest.ts` 直连官方服务器）：

```
initialize +531ms -> {"name":"matlab-mcp-server","version":"github.com/matlab/matlab-mcp-server v0.14.0"}
tools/list +532ms -> 5 tools
```

带 `--extension-file=<simulink toolkit>/tools/tools.json` 后：

```
tool count: 14
check_matlab_code, detect_matlab_toolboxes, evaluate_matlab_code, model_check, model_edit,
model_overview, model_query_params, model_read, model_read_diagnostics, model_resolve_params,
model_scan, model_test, run_matlab_file, run_matlab_test_file
```

## C. 执行 MATLAB 代码 — ✅

工作目录 `C:\Users\25639\.dsh\matlab-mcp\workspace`，脚本 `acceptance_plot.m`（二阶系统阶跃响应对比 + 数值统计 + `exportgraphics` 导出 PNG）：

`mcp__matlab__run_matlab_file` 返回：

```
DSH_SUM_1_TO_10=55
DSH_EIG_MAX=5.3723
DSH_OVERSHOOT_PCT=72.92
DSH_PNG_BYTES=66543
```

- `sum(1:10)=55` — 代码确实在 MATLAB 里执行。
- `max(abs(eig([1 2;3 4]))) = 5.3723` — 数值正确。
- ζ=0.2 时超调 72.92% — 与解析解一致。
- 导出的 `acceptance_step_response.png`（66,543 B）由 `read_image` 复核：四条曲线（ζ=0.1 峰值≈1.73、ζ=0.3、ζ=0.7、ζ=1.0 无超调）与理论完全吻合 —— **图窗不可见 → 导出 PNG → 视觉复核** 这条链路成立。

## D. Simulink 仿真 — ✅

脚本 `acceptance_simulink.m` 用代码搭建模型（Step → Transfer Fcn `1/(s+1)` → Out1，StopTime=5，ode45）并 `sim()`：

```
DSH_SIM_FINAL=0.9933
DSH_SIM_MAX=0.9933
DSH_SIM_SAMPLES=56
DSH_SIM_FILE=C:\Users\25639\.dsh\matlab-mcp\workspace\dsh_acceptance_model.slx
```

终值 0.9933 = 1 − e⁻⁵，与一阶惯性环节解析解一致；56 个采样点由 ode45 变步长产生。**全程无人工点击**。

## E. Simulink Agentic Toolkit 工具 — ✅

| 工具 | 调用 | 结果 |
|---|---|---|
| `model_overview` | `{model: dsh_acceptance_model.slx, scope: root, detail: interfaces}` | `blk_0 dsh_acceptance_model [3 \| 0/1]`，0 个容器 |
| `model_read` | `{scope: root, depth: '1'}` | `status: ok`，`blocks:` 列出 Outport `blk_3 #y1 Name: Out1`，`token_estimate: 124` |
| `model_scan` | `pattern: 'TransferFcn'` | 命中 `blk_2`：`<Block BlockType="TransferFcn" Name="Plant" SID="2">`，并提示该 ID 可直接给 `model_edit` |
| `model_check` | `checks: '["all"]'` | `status: healthy`，跑了 unconnected_ports / unconnected_lines / stateflow_lint |

（附带发现：`model_scan` 的 pattern 匹配的是 `.slx` 里的 XML 块类型，`Transfer Fcn` 要写成 `TransferFcn`。）

## F. 技能注入 — ✅

DSH 会话技能目录中出现了来自两个官方 toolkit 的技能，例如：
`matlab-debug-code`、`matlab-review-code`、`matlab-create-live-script`、`matlab-read-documentation`、`matlab-list-products`、`matlab-install-products`、`matlab-analyze-data`、`matlab-optimize-performance`、`matlab-package-toolbox`、`matlab-write-help`、`building-simulink-models`、`simulating-simulink-models`、`specifying-plant-models`、`filing-bug-reports`、`managing-simulink-projects`、`simulink-sanitize-model`、`generate-requirement-drafts`、`setup-custom-libraries`、`simulink-curating-library-kg` …

`skill({name: "matlab-list-products"})` 成功加载，返回内容带有
`Base directory for this skill: C:\Users\25639\.dsh\matlab-mcp\toolkits\matlab-agentic-toolkit\skills-catalog\matlab-core\matlab-list-products`
与 `Copyright 2026 The MathWorks, Inc.` —— 证明技能来自官方仓原文、由插件的技能提供者注册、按需加载。

系统提示词公告也已生效（本会话带 MATLAB 使用规范：超时预期、图窗导出、Simulink 工具优先级、先探测产品、报错先加载调试技能）。

## G. 零手动安装 — ✅

从零到可用只按了一次「一键安装 / 修复」，日志（`POST /api/dsh-matlab-mcp/setup` 所走的同一条代码路径）：

```
下载 MATLABMCPServerToolbox.mltbx (59,694 bytes)          ← 直连成功
克隆 matlab-agentic-toolkit / simulink-agentic-toolkit    ← git clone
安装 MATLAB 端工具箱 → DSH_MATLAB_MCP_TOOLBOX_OK
注册 Simulink 工具包路径 → DSH_MATLAB_MCP_SAVEPATH 0
```

MATLAB 侧复核（`matlab -batch`，由插件自身执行）：

```
model_overview -> ...\simulink-agentic-toolkit\tools\model_overview\model_overview.p
model_read     -> ...\model_read\model_read.p
model_edit     -> ...\model_edit\model_edit.p
model_check    -> ...\model_check\model_check.p
model_scan     -> ...\model_scan\model_scan.p
model_test     -> ...\model_test\model_test.p
```

用户侧动作：**0 次手动命令、0 次手动打开 MATLAB**。

## H. 稳定性与进程卫生 — ✅

- **幂等**：第二次运行供给流程复用已有制品（`已存在 MATLAB 端工具箱`、`更新技能仓`），工具数仍为 14，无重复下载。
- **归属判定**：`ownedMatlabPids` 单测覆盖「服务器派生的 MATLAB 会被回收 / 用户手动打开的 MATLAB 不会被回收 / 基线 PID 受保护 / 路径大小写不敏感」。
- **运行时进程表**（会话内，插件正常挂载）：
  - `matlab-mcp-server-windows-x64.exe` ×2（服务器本体 + 其 watchdog 子进程，父进程链指向 DSH 宿主）
  - `MATLAB` 会话 1 个（`sessionMode=new` 由插件启动，长驻以便后续调用秒级响应）
- **卸载回收**：插件 `ctx.effect` 的 dispose 钩子按父子进程链调用 `taskkill /T /F`（`shutdownMatlabOnUnload=true` 时）。
- **注意**：`displayMode=desktop` 时 MATLAB 桌面会常驻（属预期）；`nodesktop` 下探针实测服务器退出后 MATLAB 也随之退出。

## I. 文档 — ✅

`README.md`（中文主文档）、`README.en.md`（英文对齐）、`docs/tools.md`（14 个工具的完整参数参考）、`CHANGELOG.md`（Keep a Changelog）、本验收记录、`LICENSE`（Apache-2.0）。

---

## 过程中发现并修复的三个真实坑

1. **Windows 下 `matlab -batch` 会吞内层双引号**
   现象：`matlab -batch "disp(\"x\")"` 被拆词，`installToolbox` / `savepath` / `which` 全部失败且 stdout 为空。
   修复：把代码写入 `<cache>/tmp/<name>.m`，以「`-batch <脚本名>` + `cwd=<该目录>`」执行（单一 token、无引号），任意代码都能安全通过。见 `src/provision.ts`。

2. **pnpm 的 `link:D:/...` 会生成无效联接**
   现象：desktop profile 里 6 个本地插件的联接全部指向 `C:\...\desktop\D:\Program\...`，导致重启后 **所有** MCP 插件（含原有 EDA 插件）都不加载。
   修复：`mklink /J` 逐条重建联接（`dsh-matlab-mcp` 及原有 5 个插件），并改用 `link:C:/Users/25639/.dsh/<name>-plugin` 形态规避。

3. **DSH MCP 客户端只桥接 tools**
   官方文档明确不支持 MCP resources/prompts，因此 MathWorks 的 `guidelines://coding` 等资源拿不到 —— 这正是本插件把 Agentic Toolkit 技能注册进 DSH 技能系统、并在系统提示词里写死使用规范的原因。

## 已知限制

- 首次调用 MATLAB 冷启动约 20–45 秒（实测 38–63 秒含 Simulink 编译）；之后同会话调用为秒级。
- `model_scan` 只读磁盘上的 `.slx`，模型有未保存改动会返回 `MODEL_LOCKED`。
- `model_test` 需要 Simulink Test（本机已装）与 Gherkin 规格文件，建议先加载 `testing-simulink-models` 技能。
- 直连 GitHub 不稳定时需在设置里开启「允许镜像下载」（默认关闭，开启后仅在直连失败时启用）。
- `skillGroups` 留空时默认注册 6 组共 32 个技能，以免 201 个技能淹没模型上下文；需要更多请显式填写组名。

---

# 追加验收：0.2.0「打开 MATLAB」按钮

**被测版本**：dsh-matlab-mcp `0.2.0`（commit `38998bf`，tag `v0.2.0`）

| # | 验收项 | 证据 |
|---|---|---|
| J1 | 按钮出现在**聊天主界面** | 用户重启后确认：会话标题栏出现「打开 MATLAB」按钮（注册位 `conversation.session.header.actions`，list / session 作用域） |
| J2 | 点击真的打开 MATLAB | 重启后进程表出现新的 `MATLAB`（15:17:22）+ 5 个 `matlabwindowhelper`（桌面窗口），时间晚于插件挂载（15:16:59）；`scripts/open-matlab.ts` 亦实测 detached 启动后 3 秒内出现新 MATLAB 进程 |
| J3 | 不误伤用户窗口 | 同一时刻 `agentSessionPids()` 返回 **(none)** —— 按钮打开的 MATLAB **不属于**插件清理范围；插件卸载/退出只关它自己启动的会话，不会关掉你的窗口 |
| J4 | 会话模式语义 | 单测：`new` → `[]`（独立窗口）；`auto`/`existing` → `['-r','shareMATLABSession']`（共享会话：MCP 服务器连到同一个 MATLAB，你能在窗口里看 Agent 干活） |
| J5 | 静态质量 | `pnpm check`：typecheck 0 错、6 套测试全绿（含新增 3 例）、build 通过 |
| J6 | 路由 | 新增 `POST /api/dsh-matlab-mcp/open-matlab`，与 `/status` `/setup` `/test` `/reconnect` 同样受 loopback + 同源校验 |
