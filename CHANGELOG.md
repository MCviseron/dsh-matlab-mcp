# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MCviseron/dsh-matlab-mcp/releases/tag/v0.1.0
