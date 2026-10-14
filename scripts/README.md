# 验证脚本 / Verification scripts

这些脚本是开发与验收时真实跑过的探针，保留下来用于回归验证。它们不属于插件运行时（`lib/` 里没有它们），也不被 `pnpm build` 打包。

| 脚本 | 用途 | 用法 |
|---|---|---|
| `install.mjs` | **新客户端一键安装**：装依赖→建联接→写 profile→修复失效联接 | `node scripts/install.mjs [--dry-run] [--profile web]` |
| `mirror-assets.mjs` | **自建镜像**：抓齐全部制品，产出可上传的静态目录树 + `mirror.json`(sha256) + nginx 片段 | `node scripts/mirror-assets.mjs --out D:\mirror --base-url https://dl.你的域名/matlab [--via https://gh-proxy.com/{url}]` |
| `proxy-config.mjs` | **服务器反代配置生成**：输出覆盖 github/codeload/release-assets 三段上游的 nginx 片段 + 镜像行 | `node scripts/proxy-config.mjs --host dl.你的域名 [--prefix mp] [--static-dir /srv/matlab-assets] [--out proxy.conf]` |
| `plugin-probe.ts` | 用插件自己的模块做一次真实探测：供给状态 + MCP 握手列出工具 | `node --experimental-strip-types scripts/plugin-probe.ts` |
| `open-matlab.ts` | 聊天主界面按钮的等价验证：以 detached 方式打开 MATLAB 桌面，并确认它不属于插件清理范围 | `node --experimental-strip-types scripts/open-matlab.ts [new\|auto\|existing]` |
| `setup.ts` | 跑一遍供给流程（二进制/工具箱/技能仓 + 可选 MATLAB 侧安装），并列出带扩展文件的工具数 | `node --experimental-strip-types scripts/setup.ts [--mirror] [--matlab]` |
| `mcp-sim.ts` | 端到端：MCP → MATLAB 建 Simulink 模型并仿真 + 调 SATK 工具 | `node --experimental-strip-types scripts/mcp-sim.ts` |
| `build-model.m` | 上面脚本用的建模+仿真脚本（Step → Transfer Fcn → Out1） | 由 `mcp-sim.ts` 复制到工作区 |
| `mcp-probe.mjs` | 最底层：对任意 MCP stdio 服务器做 initialize + tools/list | `node scripts/mcp-probe.mjs <server-exe> [args...]` |
| `mcp-call.mjs` | 最底层：调用一个 MCP 工具并打印完整结果 | `node scripts/mcp-call.mjs <server-exe> <tool> @args.json [timeoutMs]` |
| `args-evaluate.json` | 上面脚本的示例参数 | — |

`--mirror` 表示允许使用设置的镜像前缀（默认关闭）；`--matlab` 会调用 `matlab -batch` 安装 MATLAB 端工具箱并注册 Simulink 工具包路径（会修改 MATLAB 环境，可重跑，幂等）。

验收时的原始输出见 [`../docs/acceptance-2026-10-14.md`](../docs/acceptance-2026-10-14.md)。
