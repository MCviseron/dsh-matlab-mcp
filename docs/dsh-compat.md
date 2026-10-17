# DSH 兼容性矩阵与升级流程

> 结论先行：**本插件兼容 DSH `0.1.1-rc.2` / `0.1.5-rc.2` / `0.2.0-rc.2` / `0.2.1-rc.2`**，
> 其中 `0.2.0-rc.2` 有真机验收，`0.2.1-rc.2` 有逐字节契约比对（见下）。
> 自动化检查：`node scripts/check-dsh-version.mjs`；每周日由任务看板定时运行。

## 1. 我们依赖的「契约」是什么

本插件只在很小的面上耦合 DSH：**8 个宿主入口文件**。其余交互都经由宿主注入的 `ctx` 服务，
而服务的**调用面**（方法名/参数）在 0.2.0 → 0.2.1 之间没有变化（见第 3 节）。

| 包 | 入口文件 | 用途 |
|---|---|---|
| `@deepseek-ai/dsh-mcp-client` | `lib/index.js` | MCP 服务器挂载（**本插件 inline 的正是它**） |
| `@deepseek-ai/dsh-client-ui-slots` | `lib/index.js` | 槽位注册：标题栏「打开 MATLAB」按钮 + 设置卡片入口 |
| `@deepseek-ai/dsh-client-locale` | `lib/client.js` | `locale.register` / `bind`（全部中英文案） |
| `@deepseek-ai/dsh-client-ui-settings` | `lib/client.js` | 设置面板（设置卡片所在） |
| `@deepseek-ai/dsh-client-store` | `lib/index.js` | `createSnapshotStore`（卡片状态） |
| `@deepseek-ai/dsh-skill` | `lib/index.js` | `registerProvider`（32 个 MathWorks 技能） |
| `@deepseek-ai/dsh-settings` | `lib/index.js` | settings `configure` / `register` |
| `@deepseek-ai/dsh-client-ui-renderer` | `lib/client.js` | 槽位渲染器（按钮的宿主） |

指纹记在 [`dsh-compat.json`](dsh-compat.json)（sha256 + 字节数）。**逐字节比对强于版本号比较**：
版本升级但文件没变 → 我们调用的代码就是验证过的代码。

## 2. 版本矩阵

| DSH 版本 | 状态 | 依据 |
|---|---|---|
| `0.1.1-rc.2` / `0.1.5-rc.2` | 声明支持（peer 范围） | 插件自 0.1.x 起一直可用；`dsh-client-store` 在 0.1.5→0.2.1 期间逐字节未变 |
| `0.2.0-rc.2` | ✅ 真机验收 | 14 个 `mcp__matlab__*` 工具、32 个技能、按钮、设置卡、Simulink 冒烟全部通过 |
| `0.2.1-rc.2` | ✅ 逐字节契约比对通过 | 见第 3 节；peer 范围已包含 |

## 3. `0.2.0-rc.2` → `0.2.1-rc.2` 实测差异

逐字节相同（**我们调用的代码没有任何变化**）：

- `dsh-mcp-client/lib/index.js`
- `dsh-client-ui-slots/lib/index.js`
- `dsh-client-locale/lib/client.js`
- `dsh-client-store/lib/index.js`
- `dsh-skill/lib/index.js`
- `dsh-settings/lib/index.js`

有变化但与我们的调用面无关：

| 文件 | 改动规模 | 改的是什么 | 对我们的影响 |
|---|---|---|---|
| `dsh-client-ui-settings/lib/client.js` | 19+/43- | 偏好持久化：去掉浏览器 local（memory）分支，改为只走宿主持久化 | 无：设置卡片走的是 `ctx.settings` + 插件自己的 HTTP 路由，不碰该偏好机制 |
| `dsh-client-ui-renderer/lib/client.js` | 141+/116- | 槽位渲染内部：新增 `Anchor` 包装、`spec === undefined → 渲染 null`、`renderChainResult(..., Anchor)`、升级 `use-sync-external-store` | 无：槽位**注册**契约未变；渲染端反而更宽容（槽位不存在时不抛错） |

另外：`dsh-settings` 在 0.2.0 把 `SettingsProvider` 改名为 `SettingsForms`（**我们不使用该类**）；
`dsh-tools`/`dsh-settings` 移除了 `./invariant` 子路径（**我们不引用**）；0.2.1 新增大量 `./locale/*.json`（宿主 i18n，与我们无关）。

## 4. 升级后如何重新验证

```powershell
# 1) 版本 + 契约检查
#    0 = 插件无需改动（已最新，或新版已被 peer 范围覆盖且契约未变）
#    2 = 有新版本、契约未变、但 peer 范围未覆盖 → 放宽范围并发版
#    3 = 契约文件变化 → 人工评估
node scripts/check-dsh-version.mjs

# 2) exit 0：无需操作（若报告 DSH 有新版，升级后按第 6 节验收）
#    exit 2：放宽 peer 范围 + 重新构建 + 发版
#    exit 3：按第 5 节逐项评估
```

脚本会读：已安装版本（`~/.dsh/dsh-runtimes/*/runtime.json`）、更新源（`resources/app-update.yml` 里的
`provider.url` + `channel`）、以及 `docs/dsh-compat.json` 的指纹基线；缺省渠道为 `nightly`。

## 5. 契约真的变了怎么办

1. **定位**：`node scripts/check-dsh-version.mjs --json` 看哪些文件 `same: false`；
2. **对比**：把新旧版本的该文件取出做 `git diff --no-index`，只看与本插件调用点相关的 hunk（`inject`/`register`/`Config`/`registerProvider`/`locale`）；
3. **适配原则**：优先**特性探测 + 多版本分支**（本插件已有先例：`SettingsProviderFaces` 按 `configure → installSection → register` 从新到旧探测）；
4. **更新基线**：改完后重新生成 `docs/dsh-compat.json` 的指纹并提交；
5. **验收**：`pnpm check` + 宿主内冒烟（`import` 插件 bundle、工具数、技能数、按钮、设置卡、Simulink 仿真）；
6. **发版**：`npm version` → 推 tag → CI 自动发布（trusted publishing + provenance）。

## 6. 真机验收清单（升级 DSH 后）

- [ ] 启动日志无 `failed to import` / `failed to activate`
- [ ] 会话里出现 **14** 个 `mcp__matlab__*` 工具
- [ ] 技能目录出现 **32** 个 MathWorks 技能
- [ ] 对话标题栏有「打开 MATLAB」按钮，点击能起桌面
- [ ] 设置 → MATLAB / Simulink MCP 卡片可打开、可「一键安装 / 修复」
- [ ] `sum(1:10)` = 55；Simulink 一阶惯性仿真终值 ≈ 0.9933

## 7. 定时检测

任务看板上的 **「DSH 更新与兼容性周检」**：每周日 09:00 运行 `scripts/check-dsh-version.mjs`，
按退出码执行策略 —— **契约未变→自动放宽/发版；契约变了→汇总差异来问你**。
