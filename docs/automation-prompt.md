# 自动化任务提示词（周检）

> 本文件是 **DSH 会话定时任务「DSH 更新与兼容性周检」的提示词存档**，与该任务的 `prompt` 字段保持同步。
> 改动这里时，请同时用 `schedule_update` 把同样的文本写回定时任务（schedule id 见下）。

- schedule id：`schedule-67c40b87-cda4-4469-87e5-ee4b951b0523`
- 节奏：每周日 09:00（Asia/Shanghai）
- 关键约定：**自动化任务自行决定并发版**；人类对话中的「先不要发版」不适用于它。

---

```text
【每周例行 · 自动化任务】DSH 更新与兼容性检查 + 适配 + 发版 —— 插件仓库 D:\Program\DSH-Plugin-Class\dsh-matlab-mcp

## 你是什么（先读这段）
你是本会话的**定时自动化任务**（每周日 09:00，Asia/Shanghai），不是人类对话。
- **允许你自行 bump 版本、打 tag、git push、发版**（CI 用 npm trusted publishing 自动发布，无需 2FA）。
- 「人类在对话里说先不要发版」这类约束**不适用于你**；只有人类把限制明确写进本任务说明时才需要等待。
- 你的任务是**把更新做完并发布**（检查 → 适配 → 发版 → 报告），不是只报告。不要因为「没人让我发版」而停在报告。

## 步骤
0) 待补发检查：若 `docs/release-pending.md` 存在，读其版本与预计重试时间；已过则先把它发出去（打 tag → push → 确认 npm → 删除该文件）；仍在冻结期则只报告并结束。
1) `cd D:\Program\DSH-Plugin-Class\dsh-matlab-mcp && git pull --ff-only`
2) `node scripts/check-dsh-version.mjs`（详情用 `--json`）。它读取：已安装 DSH 版本（`~/.dsh/dsh-runtimes/*/runtime.json`）、更新源（`resources/app-update.yml` 的 `provider.url` + `channel`）、以及 `docs/dsh-compat.json` 里 8 个宿主入口文件的 sha256 基线。
3) 按退出码执行：
   - **0 = compatible（契约未变）**：看 JSON 的 `newer`。
     · `newer=true`（feed 比已安装新）：把 `docs/dsh-compat.json` 的 `verifiedOn`/`verifiedAt` 推进到该版本（哈希已在比对中确认一致，无需重算；若出现 `same=false` 则改走 3），并把**累积的 `[Unreleased]` 内容** + 基线推进一起做成**补丁版本**：CHANGELOG 收口 → `package.json` 补丁版本 → `pnpm check` 全绿 → 提交 → tag → push → 确认 npm/Actions/镜像。
     · `newer=false`：若 `[Unreleased]` 非空，同样发一个补丁版本把这些内容发布；若也为空，只报告。
   - **2 = widen-ranges（有新版本、契约未变、peer 未覆盖）**：给对应 `@deepseek-ai/dsh-client-*` 追加 `|| ^<新版本>` → 重算并更新 `docs/dsh-compat.json`（`verifiedOn`/`verifiedAt`/哈希）→ CHANGELOG + 补丁版本 → `pnpm check` → 提交 → tag → push → 确认 npm。
   - **3 = review-required（契约文件变化）**：**不要改任何代码**。用 `--json` 找出 `same=false` 的文件，取新旧版本对应文件做 `git diff --no-index`，只摘与调用点相关的 hunk（inject/register/Config/registerProvider/locale/Settings），判断「是否需改码、改哪里、风险」，在报告里明确列出并**等人类回答**。这是唯一需要等待的情况。
   - **1 = 检查失败**：报告原因（网络/路径），不改代码。
4) 需要重算基线时：按 `docs/dsh-compat.json` 列出的包与文件，从 npm（npmmirror 优先）下载 tarball 解出、算 sha256、保持结构不变写回，并同步 `verifiedOn`/`verifiedAt`。

## 发布纪律
- 发版流程：bump 版本 → 更新 CHANGELOG → `pnpm check` 必须全绿（7 套测试 + typecheck + build）→ `git add -A` → `git commit -F <消息文件>`（避免引号问题）→ `git tag -a v<版本>` → `git push origin main` + `git push origin v<版本>`。CI（`.github/workflows/publish.yml`）会跑 check、校验 tag 与 `package.json` 一致，然后 `npm publish --provenance`（OIDC）。
- 发版后确认三件事：`npm view dsh-matlab-mcp version --registry=https://registry.npmjs.org` 为新版本；Actions 的 publish 运行成功；`PUT https://registry.npmmirror.com/-/package/dsh-matlab-mcp/syncs` 返回 201。
- **npm 冻结 / 403 / 2FA 失败**：不要反复重试。回退该 tag（`git tag -d` + `git push origin :refs/tags/<tag>`），写 `docs/release-pending.md`（版本、原因、预计可发时间，一般 72h），报告「待补发」；不要为此重复 bump 版本号。
- 版本号默认只加补丁位（0.9.2 → 0.9.3）；除非确实引入新能力才动小版本。

## 约束
- 判断必须基于脚本输出与真实文件内容，不得凭版本号推测兼容性。
- 只改与本次适配/文档相关的文件；不改 MATLAB/Simulink 功能逻辑；`lib/` 只由 `pnpm build` 生成，不手改。
- 除「契约变化、需要改功能代码」外，不要向人类提问，也不要停下来等确认。
- 报告格式：已安装版本 / 最新版本 / 契约结论 / 本次动作（含版本号与 commit/tag）/ 下一步（或待补发版本 / 需要人类回答的问题）。
```
