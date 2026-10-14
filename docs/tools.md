# 工具参考 / Tool reference

会话中每个工具都以 `mcp__matlab__` 为前缀（例如 `mcp__matlab__evaluate_matlab_code`）。前缀来自本插件在 `@deepseek-ai/dsh-mcp-client` 中注册的 `serverName: matlab`。

所有工具的超时由插件的 `toolCallTimeoutMs` 控制（默认 600000 ms，上限 1800000 ms）。

---

## 内置工具（官方 MATLAB MCP Server，5 个）

### `detect_matlab_toolboxes`

返回本机 MATLAB 及已安装产品/工具箱的版本信息。

- 入参：无（部分版本接受可选过滤）
- 返回：纯文本清单
- 用途：**动手前先探测**，确认要用的产品（Simulink、Control System Toolbox、Deep Learning Toolbox…）确实装了

### `check_matlab_code`

对一个 `.m` 文件做静态代码分析，**不执行**脚本。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `script_path` | string | ✅ | `.m` 文件绝对路径 |

返回：编码风格、潜在错误、弃用函数、性能问题、最佳实践违规等告警。文件不会被修改。

### `evaluate_matlab_code`

执行一段 MATLAB 代码并返回命令窗口输出。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | ✅ | 要执行的 MATLAB 代码 |
| `project_path` | string | ✅ | 项目目录绝对路径；MATLAB 会把它设为当前文件夹 |

用途：**最常用的工具**。脚本产物（`.mat`/`.csv`/`.png`/`.slx`）默认写到 `project_path`，便于随后用文件工具读取。

### `run_matlab_file`

执行一个 `.m` 脚本文件并返回输出。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `script_path` | string | ✅ | `.m` 脚本绝对路径 |

### `run_matlab_test_file`

执行 MATLAB 单元测试文件（`matlab.unittest` 框架）并返回测试结果。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `script_path` | string | ✅ | 测试脚本绝对路径 |

---

## Simulink 扩展工具（Simulink Agentic Toolkit，9 个）

> 由插件把 toolkit 的 `tools/tools.json` 通过 `--extension-file=` 传给 MCP 服务器后出现；对应 MATLAB 函数由一键安装的 `addpath + savepath` 注册。
>
> ⚠️ **共同点**：所有参数都是 **字符串**（包括 JSON 数组、布尔和数字），因为它们由 MCP 以文本透传给 MATLAB 函数。

### `model_overview`

模型总览：子系统层级、接口、连接关系。第一次接触一个模型时先用它看全局。

| 参数 | 说明 |
|---|---|
| `model` | 模型文件名（`MyModel.slx`）或 `.slx`/`.mdl` 绝对路径 |
| `scope` | `'root'` 表示整个模型，或 `'blk_10'` 这样的块 ID |
| `detail` | `'tree'`（仅层级）/ `'interfaces'`（层级 + 端口名）/ `'full'`（再加顶层信号连接） |

输出中的 `[x | y/z]` 表示 `x=块数, y=输入数, z=输出数`。

### `model_read`

读取模型结构与算法行为：块拓扑、连接、以及描述每个块在做什么的表达式。

| 参数 | 说明 |
|---|---|
| `model` | 同上 |
| `scope` | 起始作用域：`'root'` 或块 ID |
| `depth` | 层级深度：`'0'` 当前层、`'1'` 下一层、`'inf'` 全部 |

表达式记号：`uN(source)` = 第 N 个输入及其来源；`yN` = 第 N 个输出；`@Param(value)` = 块参数的实际设定值。`@Gain(Kp)` 里是变量名时，用 `model_resolve_params` 取数值。

### `model_query_params`

随机访问块/信号/模型配置上的任意参数（补足 `model_read` 未展示的值，如采样时间、状态名）。

| 参数 | 说明 |
|---|---|
| `model` | 同上 |
| `targets` | JSON 数组：块 `blk_5`、信号 `blk_5.y1 -> blk_8.u1`、配置 `config:ModelName` |
| `params` | JSON 数组，如 `'["Gain","SampleTime"]'`，或 `'["all"]'` |
| `compile` | `'true'`/`'false'`；查询编译期参数（如 `CompiledPortWidths`）时必须 `'true'` |

### `model_resolve_params`

把 `model_read` 表达式里的变量引用解析成实际数值（`Kp`、`cfg.gains.Ki`、`TableData`…）。

| 参数 | 说明 |
|---|---|
| `model` | 同上 |
| `expressions` | JSON 数组，如 `'["Kp","cfg.gains.Ki"]'` |

### `model_edit`

在**同一个作用域内**对 Simulink / System Composer / Stateflow 模型做结构性修改或参数配置。先用 `model_read` 拿块 ID。

| 参数 | 说明 |
|---|---|
| `model` | 同上 |
| `scope` | `'root'`、子系统块 ID `blk_5`、或 Stateflow 作用域 `sf_X` |
| `operations` | JSON 数组（**必须单行，不能有换行**），每项含 `op`：`add_block` / `connect` / `disconnect` / `set_param` / `delete_block` / `add_line` / `subsystem` … |
| `layout_mode` | `'full'`（从零搭建时）/ `'incremental'`（已存在时小幅改动） |

### `model_read_diagnostics`

读取模型最近一次诊断（编译/仿真/检查触发）产生的错误、警告与信息，块 ID 与 `model_read` 一致。

| 参数 | 默认 | 说明 |
|---|---|---|
| `model` | — | 同上 |
| `severity` | `'all'` | 或 `'error'`/`'warning'`/`'info'`，或 JSON 数组 |
| `scope` | `'root'` | 或块 ID |
| `message_id` | — | 过滤特定 MATLAB 消息标识符 |
| `detail` | `'full'` | 或 `'summary'`（只给计数与消息 ID） |
| `sort_by` | `'severity'` | 或 `'message_id'`/`'block_path'` |
| `limit` | `'50'` | 每页条数，1–200 |
| `offset` | `'0'` | 分页偏移 |
| `token_limit` | `'25000'` | 返回的最大 token 数，调小以省上下文 |

### `model_check`

结构性校验：未连接端口、悬空信号线、Stateflow 编辑期 lint 错误。改完模型后用它抓连接问题。

| 参数 | 说明 |
|---|---|
| `model` | 同上 |
| `scope` | `'root'` 或块 ID |
| `checks` | JSON 数组：`'["all"]'` 或 `'["unconnected_ports","unconnected_lines",...]'` |

### `model_scan`

对磁盘上的原始 `.slx` 做正则搜索（<100 ms），定位特定块/参数/字符串，返回可给 `model_edit` 用的块 ID。

| 参数 | 说明 |
|---|---|
| `model` | 同上 |
| `command` | `'grep'` |
| `pattern` | 正则，如 `'Gain'`、`'(?i)pid'` |

### `model_test`

用 Gherkin 规格文件对模型做行为测试，自动创建测试产物并返回 pytest 风格的测试结果。

| 参数 | 默认 | 说明 |
|---|---|---|
| `model` | — | 同上 |
| `gherkin_file` | — | `.feature` 规格文件路径（写之前建议先加载 `testing-simulink-models` 技能） |
| `scenarios` | `'[]'` | 要跑的 scenario 名 JSON 数组，`'[]'` = 全部 |
| `verbose` | `'false'` | 失败时是否包含信号轨迹 |
| `draft_mode` | — | `'true'` 跳过主模型编译，适合快速迭代 |
| `coverage` | `'none'` | 或 `'decision'`（需要 Simulink Coverage 工具箱） |

---

## 常见调用范式

```text
1) 先探测：detect_matlab_toolboxes
2) 写/改代码：check_matlab_code（静态检查）→ evaluate_matlab_code / run_matlab_file
3) 看图：代码里 exportgraphics(gcf,"out.png",Resolution=150) → read_image("out.png")
4) Simulink：model_overview → model_read → model_edit → model_check → model_test/sim
5) 报错：model_read_diagnostics 或加载 matlab-debug-code 技能
```

## 环境变量（等价于命令行参数）

MCP 服务器支持用环境变量替代参数：前缀 `MW_MCP_SERVER_`，大写并把 `-` 换成 `_`。例如 `--matlab-root` ⇄ `MW_MCP_SERVER_MATLAB_ROOT`，`--extension-file` ⇄ `MW_MCP_SERVER_EXTENSION_FILE`（Windows 多个文件用 `;` 分隔）。命令行参数优先于环境变量。
