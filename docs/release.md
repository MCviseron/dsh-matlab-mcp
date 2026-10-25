# 发布流程（维护者）

> 现状：推 tag 即由 GitHub Actions 经 **npm trusted publishing（OIDC）** 自动发布，带 SLSA provenance，无需 2FA 动态码。首次发布（0.7.2/0.7.3）已按此走通。

> 面向仓库维护者。普通用户只需「安装」，见 [README](../README.md)。

## 一次发布：完整步骤

1. 改代码 → `pnpm check`（typecheck + 7 套测试 + build；CI 也会跑同样的检查）
2. `git status` 必须干净 —— `lib/` 是**提交进仓库的构建产物**（DSH 直接加载它），CI 会校验它与全新构建一致
3. 更新 `CHANGELOG.md` 与 `package.json` 版本（SemVer）
4. 提交并打 tag，两者一致：

   ```bash
   git commit -am "feat: ..." && git tag v0.7.2 && git push origin main v0.7.2
   ```

5. 发布到 npm（**必须带 2FA 动态码**）：

   ```powershell
   npx --yes npm@12 publish --access public --registry=https://registry.npmjs.org --otp=<6位动态码>
   ```

6. 让国内镜像立刻同步：

   ```powershell
   curl.exe -X PUT "https://registry.npmmirror.com/-/package/dsh-matlab-mcp/syncs"
   ```

7. 验证：

   ```powershell
   curl.exe -s https://registry.npmjs.org/dsh-matlab-mcp | Select-String '"latest"'
   curl.exe -sI https://registry.npmjs.org/dsh-matlab-mcp/-/dsh-matlab-mcp-<version>.tgz | Select-Object -First 1
   ```

## 坑 1：npm 要求 2FA —— 不带码会被「暂存」

不带 `--otp` 发布时，npm **不会**直接发布，而是：

- 建一个占位版本 `0.0.0-stage`（336 B，描述 *Temporary package placeholder for staged publishing*），并把它设为 `latest`；
- 你的真实版本进入「等待分阶段发布」状态 —— 此时 `.../<version>.tgz` **是 404**。

补救二选一：

```powershell
npx --yes npm@12 publish --access public --registry=https://registry.npmjs.org --otp=<码>   # 带码重发
npx --yes npm@12 stage list                        # 或先看暂存了什么
npx --yes npm@12 stage approve <stage-id>          # 批准即发布（会要码）
```

`npm stage` 需要 npm ≥ 11.6（本机 10.9.3 没有该命令 → 用 `npx npm@12`；npm 12 要求 Node ≥ 22.22.2）。
发布成功后可选清理占位版：

```powershell
npx --yes npm@12 unpublish dsh-matlab-mcp@0.0.0-stage --registry=https://registry.npmjs.org
```

## 坑 2：本机默认 registry 是只读镜像

`npm config get registry` 是 `registry.npmmirror.com`（只读镜像，**不能发布**）→ 发布命令必须显式带
`--registry=https://registry.npmjs.org`。

## 以后：交给 CI（推荐）

首次发布完成后，到 npmjs.com → 该包 → **Settings → Trusted Publisher → GitHub Actions**：

| 字段 | 值 |
|---|---|
| Organization/user | `MCviseron` |
| Repository | `dsh-matlab-mcp` |
| Workflow filename | `publish.yml` |

之后推 tag 即自动发布：`.github/workflows/publish.yml` 会先 `pnpm check`、校验 tag 与 `package.json` 版本一致，再 `npm publish --provenance`（OIDC，无 token，带来源证明）。手动触发该 workflow 默认只 `npm pack --dry-run`。

## 发布被拒：npm 账号冻结 / 403 / 2FA

npm 账号可能被临时冻结（例如安全事件后的 72 小时冻结期）。症状是 `npm publish` 返回 403 或提示账号受限；
**只读操作不受影响**（`npm view`、CI 的 `npm pack` 都能正常跑）。

处理原则：

1. **只读检查照常**：`npm view dsh-matlab-mcp version --registry=https://registry.npmjs.org` 用于确认线上版本。
2. **发布被拒不要反复重试**：回退刚推的 tag，保持 main 已提交、无悬挂 tag：

   ```bash
   git tag -d v<version>
   git push origin :refs/tags/v<version>
   ```

3. **登记待发版本**：写 `docs/release-pending.md`（版本、原因、预计可发时间）。下一次周检任务会先读它，
   过期后自动补发（打 tag → 推 → 确认 npm → 删除该文件）。
4. **不要为此重复 bump 版本号**；冻结解除后直接用已提交的那个版本发布。

## 自动化发布 vs 对话中发布

| 场景 | 是否可直接发版 |
|---|---|
| 会话定时任务（每周日 09:00 的周检） | **可以** —— 该任务的目的就是检查并更新：自行 bump 版本 → `pnpm check` → 提交 → 打 tag → 推送，CI 自动发布 |
| 人类在对话中要求「先不要发版」之后 | **不可以** —— 需要人类明确说「发版 / 打 tag」 |

判定方式：只有在**人类显式提出**发布约束时才暂停自动发版；自动化任务自身不受该约束影响。

若某个定时任务的 prompt 仍写着「只本地提交 / 等确认」，用脚本补齐（幂等、自动备份）：

```powershell
node scripts/fix-schedule-autonomy.mjs            # 只审计
node scripts/fix-schedule-autonomy.mjs --apply    # 写入 <DSH_HOME>\storages\schedule.json
```

写入后需**重启 DSH**，schedule 服务才会从磁盘重新加载。

## 产物与版本约定

- **npm 版本 = git tag = `package.json` 版本**（CI 强制校验）
- `lib/` 随仓库提交（DSH 直接加载）；CI 校验其与全新构建一致，且宿主 bundle 依然是自包含的
- `files` 只含 `lib/ src/ test/ docs/ README* CHANGELOG cordis.patch.yml` ——
  `deploy/`（服务器部署工具）与 `scripts/`（本地安装/验证脚本）**不进包**
- `dependencies` 为空：bundle 自包含，安装即用、无需构建

## 可复现构建（踩过的坑）

`lib/` 是**提交进仓库**的构建产物，CI 会用「重新构建后 `git diff -- lib` 必须为空」来守卫。两个真实踩坑：

1. **esbuild 会把内联模块的物理路径写进产物注释**：

   ```js
   // node_modules/.pnpm/@deepseek-ai+dsh-tools@0.1.5-rc.3_8f54d72f…/node_modules/@deepseek-ai/dsh-tools/lib/index.js
   ```

   `.pnpm` 目录名里的 peer 依赖哈希随**机器与 pnpm 版本**变化 → 同源码在两台机器上构建出的字节不同，
   「lib 必须一致」必然失败，还泄露构建机路径。`build.mjs` 现在构建后剥离这类注释（约 19.5 KB / 228 行）。
2. **平台相关的路径语义**：`pickMatlabRoot` / `findOnPath` / `isMatlabRoot` 曾用宿主平台的 `path` 规则解析
   「属于另一平台」的路径 —— Linux 上 POSIX 规则不认反斜杠，Windows 路径被归一成 `..`。现在按 `platform`
   参数选择 `win32` / `posix`。**教训：本机 Windows 全绿 ≠ CI(ubuntu) 全绿。**

## 在拿不到 Actions 日志时定位 CI 失败

Actions 的原始日志需要鉴权，但 **check-runs 的注解可以匿名读取**。因此 workflow 里：

- 把门禁拆成具名步骤（`Typecheck` / `Unit tests` / `Build bundles`），jobs API 直接告诉你是哪一段失败；
- 各段 `2>&1 | tee /tmp/<leg>.log`，失败时用 `::error title=…::<tail>` 输出注解（换行转义为 `%0A`），
  并同时写入 `$GITHUB_STEP_SUMMARY`。

读取方式（公开 API）：

```bash
curl -s "https://api.github.com/repos/<owner>/<repo>/commits/<sha>/check-runs" | grep -o '"id": [0-9]*'
curl -s "https://api.github.com/repos/<owner>/<repo>/check-runs/<id>/annotations"
```
