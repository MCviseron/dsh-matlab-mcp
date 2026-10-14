# 验证脚本 / Verification scripts

这些脚本是开发与验收时真实跑过的探针，保留下来用于回归验证。它们不属于插件运行时（`lib/` 里没有它们），也不被 `pnpm build` 打包。

| 脚本 | 用途 | 用法 |
|---|---|---|
| `plugin-probe.ts` | 用插件自己的模块做一次真实探测：供给状态 + MCP 握手列出工具 | `node --experimental-strip-types scripts/plugin-probe.ts` |
| `setup.ts` | 跑一遍供给流程（二进制/工具箱/技能仓 + 可选 MATLAB 侧安装），并列出带扩展文件的工具数 | `node --experimental-strip-types scripts/setup.ts [--mirror] [--matlab]` |
| `mcp-sim.ts` | 端到端：MCP → MATLAB 建 Simulink 模型并仿真 + 调 SATK 工具 | `node --experimental-strip-types scripts/mcp-sim.ts` |
| `build-model.m` | 上面脚本用的建模+仿真脚本（Step → Transfer Fcn → Out1） | 由 `mcp-sim.ts` 复制到工作区 |
| `mcp-probe.mjs` | 最底层：对任意 MCP stdio 服务器做 initialize + tools/list | `node scripts/mcp-probe.mjs <server-exe> [args...]` |
| `mcp-call.mjs` | 最底层：调用一个 MCP 工具并打印完整结果 | `node scripts/mcp-call.mjs <server-exe> <tool> @args.json [timeoutMs]` |
| `args-evaluate.json` | 上面脚本的示例参数 | — |

`--mirror` 表示允许使用设置的镜像前缀（默认关闭）；`--matlab` 会调用 `matlab -batch` 安装 MATLAB 端工具箱并注册 Simulink 工具包路径（会修改 MATLAB 环境，可重跑，幂等）。

验收时的原始输出见 [`../docs/acceptance-2026-10-14.md`](../docs/acceptance-2026-10-14.md)。
