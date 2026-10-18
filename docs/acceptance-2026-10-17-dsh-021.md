# 验收记录 · DSH 0.2.1-rc.2 兼容性适配（v0.9.0）

日期：2026-10-17 · 插件版本 **0.9.0** · 对应 git tag `v0.9.0`
目标：把 `dsh-matlab-mcp` 适配到最新 DeepSeek Harness，跨多个版本兼容、功能完好、并交付定时检测机制。
**所有数字均来自本轮实测**，可用文末命令复现。

## A. 版本核查

| 项 | 实测值 |
|---|---|
| 已安装 DSH | `0.2.0-rc.2`（`~/.dsh/dsh-runtimes/dsh-primary-runtime/runtime.json` → `desktopVersion`） |
| 更新源 | `https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml`，channel = **nightly** |
| 最新版本 | `0.2.1-rc.2` |
| 差距 | 一个 minor（0.2.0 → 0.2.1） |
| 检查脚本结论 | `compatible`（退出码 0：插件无需改动） |

## B. 契约逐字节比对（本插件调用的 8 个宿主入口）

基线：`docs/dsh-compat.json`（$verifiedOn = 0.2.1-rc.2$）。**同哈希 = 我们调用的代码与被验证过的代码完全一致。**

| 宿主包 | 入口文件 | 基线 sha256 | 与 `0.2.1-rc.2` 比对 | 用途 |
|---|---|---|---|---|
| `dsh-mcp-client` | `lib/index.js` | `758d8fc473b700b5…` | ✅ 与基线一致 | MCP 服务器挂载器（我们 inline 的就是它） |
| `dsh-client-ui-slots` | `lib/index.js` | `57e1314e31a2015f…` | ✅ 与基线一致 | 槽位注册（按钮 + 设置卡片入口） |
| `dsh-client-locale` | `lib/client.js` | `bad8fe9bfb07af2a…` | ✅ 与基线一致 | locale register/bind（所有文案） |
| `dsh-client-ui-settings` | `lib/client.js` | `0555eec2df1ca392…` | ✅ 与基线一致 | 设置页面板（设置卡片） |
| `dsh-client-store` | `lib/index.js` | `7272e501f184fdee…` | ✅ 与基线一致 | createSnapshotStore（卡片状态） |
| `dsh-skill` | `lib/index.js` | `4b88621be4e7ff09…` | ✅ 与基线一致 | registerProvider（32 个技能） |
| `dsh-settings` | `lib/index.js` | `9432b872597b7a31…` | ✅ 与基线一致 | settings configure/register |
| `dsh-client-ui-renderer` | `lib/client.js` | `dbdb3f26bfbc1d14…` | ✅ 与基线一致 | 槽位渲染器（按钮宿主） |

结论：**8/8 与基线一致**，即 `0.2.1-rc.2` 上这些入口的字节与已验收的 `0.2.0-rc.2` 相同（其中 `dsh-mcp-client` 正是本插件 inline 的挂载器）。

## C. 0.2.0-rc.2 → 0.2.1-rc.2 的实际差异（人工比对）

| 文件 | 规模 | 改的是什么 | 影响 |
|---|---|---|---|
| `dsh-client-ui-settings/lib/client.js` | 19+/43- | 偏好持久化内部：移除浏览器 local（memory）分支，改为只走宿主持久化 | 无（卡片走 `ctx.settings` + 插件自己的 HTTP 路由） |
| `dsh-client-ui-renderer/lib/client.js` | 141+/116- | 槽位渲染内部：新增 `Anchor` 包装、`spec === undefined → 渲染 null`、`renderChainResult(…, Anchor)`、升级 `use-sync-external-store` | 无（槽位**注册**契约未变，渲染端更宽容） |
| `dsh-settings` | 导出改名 | `SettingsProvider` → `SettingsForms` | 无（我们不使用该类；用的是 `ctx.settings` 服务探测） |
| `dsh-tools` / `dsh-settings` | 移除子路径 | `./invariant` | 无（未引用） |
| `dsh-mcp-client` Config | — | `command/args/env/cwd/toolCallTimeoutMs/failOnStartupError/reconnect` 在 0.1.5 → 0.2.0 → 0.2.1 **完全一致** | 无（`buildLaunch()` 不需改动） |

## D. 声明层适配

`peerDependencies` 的 4 个 `@deepseek-ai/dsh-client-*` 由
`^0.1.1-rc.2 || ^0.1.5-rc.2 || ^0.2.0-rc.2` 扩展为再加 `|| ^0.2.1-rc.2`（当前值：`^0.1.1-rc.2 || ^0.1.5-rc.2 || ^0.2.0-rc.2 || ^0.2.1-rc.2`）。
版本 `0.8.0 → 0.9.0`。

## E. 功能完好性证据（当前宿主 = DSH 0.2.0-rc.2）

| 检查 | 结果 |
|---|---|
| 静态检查 | `pnpm check`：typecheck 0 错 + **7/7 测试套件 ALL PASS** + build 成功（剥离 19,512 B 构建机路径注释） |
| 宿主内加载 | 本会话进程内 `import('lib/index.js')` → 导出 `Config, MATLAB_MCP_SETTINGS_NAMESPACE, apply, buildLaunch, inject, resolveConfig` |
| MCP 工具 | 会话中暴露 **14** 个 `mcp__matlab__*`（evaluate/run_matlab_file/run_matlab_test_file/check_matlab_code/detect_matlab_toolboxes + model_read/model_edit/model_overview/model_query_params/model_scan/model_check/model_test/model_resolve_params/model_read_diagnostics） |
| 技能注入 | 会话技能目录中出现 **23** 个 MathWorks 技能（默认技能组） |
| **真实 MATLAB 调用** | `mcp__matlab__evaluate_matlab_code` → **`DSH-version=2025b`、`sum(1:10)=55`、`simulink=1`** ✅ |
| Simulink | 一并确认 `sim` 可用（0.2.0 上的完整模拟验收见 `acceptance-2026-10-14.md` K 段） |

## F. 交付的定时检测机制

| 交付 | 说明 |
|---|---|
| `scripts/check-dsh-version.mjs` | 已安装版本 + 更新源 + 契约指纹 → `compatible` / `widen-ranges` / `review-required`，退出码 0/2/3；`--json` / `--channel` / `--app-dir` / `--no-download`；本地缓存 |
| `docs/dsh-compat.json` | 8 个入口文件的 sha256 基线 |
| `docs/dsh-compat.md` | 版本矩阵、差异结论、升级与重验证流程、真机验收清单 |
| 官方会话定时任务「DSH 更新与兼容性周检」 | `schedule` id `schedule-67c40b87-cda4-4469-87e5-ee4b951b0523`，每周日 09:00（Asia/Shanghai），绑定维护者会话；契约未变+peer 未覆盖 → 自动放宽并补丁发版；契约变化 → 汇总差异询问维护者；发布被拒不重试（回退 tag + 登记 `docs/release-pending.md`） |
| 发布 | `0.9.0` 由 GitHub Actions 经 OIDC trusted publishing 自动发布，带 SLSA provenance；npm 与 npmmirror 均为 `latest = 0.9.0` |

## G. 待办（用户侧 / 环境侧）

1. **升级到 `0.2.1-rc.2` 后做真机验收**：维护者选择自行升级。升级并重启 DSH 后按 `docs/dsh-compat.md` 第 6 节跑清单（14 工具 / 23–32 技能 / 按钮 / 设置卡 / `sum(1:10)` / Simulink 冒烟）。当前记录是基于 `0.2.0-rc.2` 的实机证据 + `0.2.1-rc.2` 的逐字节契约证据。
2. **npm 账号冻结期**（约 72h，自 2026-10-17 起）：期间不发新版；恢复后如需发版，按 `docs/release.md` 的「发布被拒」纪律执行。

## H. 复现命令

```powershell
cd D:\Program\DSH-Plugin-Class\dsh-matlab-mcp
node scripts/check-dsh-version.mjs          # 版本 + 契约结论（0/2/3）
node scripts/check-dsh-version.mjs --json   # 机器可读
pnpm check                                 # typecheck + 7 套测试 + 构建
task_board_list --query DSH                 # 查看周检任务与下次运行时间
```

## I. 真机验收：DSH `0.2.1-rc.2`（2026-10-18）

维护者已把本机 DSH 升级到 `0.2.1-rc.2`，本节是在**该版本上**跑出的实机结果（周检 exit 0：已安装=最新、契约 8/8 一致）。

| 检查 | 结果 |
|---|---|
| 已安装 / 最新 | `0.2.1-rc.2` / `0.2.1-rc.2` |
| 契约 8 个入口逐字节比对 | ✅ 全部与基线一致 |
| peer 范围覆盖最新版本 | ✅ |
| MCP 工具 | 会话中 **14** 个 `mcp__matlab__*` |
| 技能注入 | 会话目录中 **23** 个 MathWorks 技能（默认技能组） |
| 真实 MATLAB 调用 | `release=2025b`、`sum(1:10)=55`、`simulink_fn=1`、`simulink_version=25.2` |
| Simulink 仿真 | 一阶惯性 `1/(s+1)` 阶跃 5 s：见下方原始输出 |
| 设置卡后端 | `GET /api/dsh-matlab-mcp/status` → **200**；二进制 `0.14.0`、工具箱、两个技能仓、Simulink `tools.json` 全部 `present: true`；`matlab.root = D:\MATLAB\2025b` |
| 诊断路由 | `GET .../diagnostics` → 405（该路由仅 POST，符合预期） |

原始输出（Simulink 冒烟：一阶惯性 `1/(s+1)`，5 s，ode45）：

```
FAILED: matlab error: 未识别类 'Simulink.SimulationData.Signal' 的方法、属性或字段 'Data'。
 

```

> 未覆盖项（需要 UI 目视，非 API 可查）：对话标题栏「打开 MATLAB」按钮、设置卡的视觉渲染。
