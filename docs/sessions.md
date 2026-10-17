# 多会话、并行仿真与 MATLAB 会话共享

> 一句话：**一个 DSH 进程 = 一个 MCP server = 一个 MATLAB**。
> 同一个 DSH 里开多个对话会共用同一个 MATLAB；要真正并行请开**两个 DSH 实例**并保持 `sessionMode=new`。
> 本文只描述**当前实现的行为**，不是"每对话一个 MATLAB"的承诺。

## 1. 「会话」指的是 MATLAB 会话，不是 DSH 对话

界面里 `sessionMode` 的提示原文（`src/client/locales.ts`）：

| 值 | 含义 |
|---|---|
| `new`（默认） | 插件**自己启动**一个 MATLAB（`--matlab-session-mode=new`），**从不共享** |
| `auto` | **优先接管已共享的 MATLAB 会话**（即先在 MATLAB 里跑过 `shareMATLABSession` 的那个），没有才新开 |
| `existing` | **只**连接已共享的会话；此模式下 `--matlab-root` / `--initial-working-folder` / `--matlab-display-mode` 会被省略（上游规定该组合非法） |

所以「优先接管已有会话」跟"多开对话"无关 —— 它说的是 MATLAB 那边的共享引擎。

## 2. 为什么一个 DSH 进程只有一个 MATLAB（代码证据）

| 事实 | 位置 |
|---|---|
| MCP server 只有**一处**挂载点；注释明确写「同一个 `serverName` 在 fiber 存活期间被占用，第二次挂载会被拒绝」 | `src/index.ts:283-336`（`remountClient` → `toolsCtx.plugin(mcpClient, …)`，仅在 `apply` 与 reconnect 路由调用） |
| 全 `src/` 无 `sessionId` / `ctx.session`，没有 per-conversation 隔离 | grep 结果（只有 `announceToAgent` 做系统提示注入） |
| `new` 模式从不共享 | `src/index.ts:356` `const shared = active.sessionMode !== 'new'`；`src/server-args.ts:111` 只有 auto/existing 才 `-r shareMATLABSession` |
| 卸载时只清理「父进程链属于本服务」的 MATLAB | `src/matlab-processes.ts`（所有权按父进程判定，测试见 `test/matlab-processes.test.ts`） |

## 3. 四种组合的结果

| 场景 | 实际使用的 MATLAB | 会不会互相干扰 |
|---|---|---|
| **同一个 DSH 里开两个对话**，各跑一个仿真 | **同一个** | **会**（见第 4 节） |
| 两个 DSH 实例 + 都用 `new` | 各自一个 | **不会** |
| 两个 DSH 实例 + 都用 `auto` | 第二个可能接管第一个共享的那个 | **会** |
| 两个 DSH 实例 + 都用 `existing` | 必然同一个共享会话 | **会** |

## 4. 「打架」具体表现

- **共享 base workspace**：A 里 `zeta = …`，B 里同名变量会互相覆盖；
- **共享 `cd` / 搜索路径 / 已加载的模型 / 图窗**；
- **长仿真会挡住另一个**：MATLAB 端只有一个解释器，同一时刻只能算一件事。客户端层面没有找到调用级互斥（`dsh-mcp-client` 里只有 `enqueueSync`，那是**工具注册同步**用的），请求会被并发转发，但到 MATLAB 里仍要排队。

## 5. 想并行跑两个仿真，怎么做

1. **开两个 DSH 实例，两边都保持 `sessionMode=new`** —— 各自独立 MATLAB，互不干扰。**推荐**。
2. 只在**一个** DSH 内并行：交给 MATLAB 自己（`parfeval` / `parfor` / `batch` / `parsim`）；但 base workspace 仍共享，需自行隔离变量名与工作目录。
3. **不要**在两个实例里都用 `auto` / `existing` —— 那是主动去抢同一个共享会话。

## 6. 已知的未实测项（诚实标注）

- 「两个 DSH 实例 + `new` 各得一个 MATLAB」是代码语义 + MATLAB 进程可多开得出的推论，**未做双实例真机实验**。
- 「同一 Host 内两个对话的工具调用是否严格串行」未实测；但即使串行，**状态共享**已足以导致干扰。

## 7. 将来若要"每个对话一个 MATLAB"

需要把 MCP server 的挂载从 **Host 级** 下移到 **会话级**，而当前 `@deepseek-ai/dsh-mcp-client` 明确拒绝同一 `serverName` 的二次挂载 —— 这是一个要先跟上游确认的改动。当前版本**没有**实现，也不承诺实现时间。
