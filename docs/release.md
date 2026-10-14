# 发布流程（维护者）

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

## 产物与版本约定

- **npm 版本 = git tag = `package.json` 版本**（CI 强制校验）
- `lib/` 随仓库提交（DSH 直接加载）；CI 校验其与全新构建一致，且宿主 bundle 依然是自包含的
- `files` 只含 `lib/ src/ test/ docs/ README* CHANGELOG cordis.patch.yml` ——
  `deploy/`（服务器部署工具）与 `scripts/`（本地安装/验证脚本）**不进包**
- `dependencies` 为空：bundle 自包含，安装即用、无需构建
