# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 变更

- **设置页布尔项改为官方同款开关**：逐字照抄 `@deepseek-ai/dsh-client-ui-primitives` 的 `Switch`（`lib/Switch.module.css` + `lib/types/Switch.js`）——36×20 轨道、`padding:2px`、16px 滑块 `translateX(16px)`、配色由 `[aria-checked]` 驱动（关：`--dsw-alias-border-l3` / 开：`--dsw-alias-brand-primary`）、禁用 `opacity:.5`、`focus-visible` 焦点环；行布局沿用官方 `settings-form`（标签左、开关右、提示在下）。覆盖 `enabled` / `announceToAgent` / `simulinkTools` / `skillsEnabled` / `allowMirrorDownload` / `telemetry` / `shutdownMatlabOnUnload` 共 7 项。未直接 `import` 官方包，因为 Web 壳只保证提供 `build.mjs` externals 里那些模块，require 失败会让整张设置卡挂掉。

### 文档

- 新增 [`docs/sessions.md`](docs/sessions.md)：**多会话与并行仿真的行为说明** —— 一个 DSH 进程 = 一个 MCP server = 一个 MATLAB（附代码位置证据）；「会话」指 MATLAB 共享会话而非 DSH 对话；四种组合（同一 DSH 内多对话 / 双实例 × new / auto / existing）的干扰矩阵；「打架」的具体表现；想并行两个仿真的推荐做法；并诚实标注未实测项与「每对话一个 MATLAB」所需的上游改动。README 特性表增加对应一行。

### 变更

- 定时检测改用 **DSH 官方会话定时任务**（`schedule`，id `schedule-67c40b87-cda4-4469-87e5-ee4b951b0523`，每周日 09:00 Asia/Shanghai，绑定维护者会话），并移除任务看板里的那张卡（第三方插件）。行为不变：契约未变+peer 未覆盖 → 自动放宽并发版；契约变化 → 汇总差异询问维护者；发布被拒不重试（回退 tag + 登记待补发）。

## [0.9.0] - 2026-10-17

### 新增

- **DSH 兼容性工具链**：新增 `scripts/check-dsh-version.mjs`（读取已安装版本 + 更新源 + 契约指纹，输出 `up-to-date` / `widen-ranges` / `review-required` 三种结论与对应退出码 0/2/3）、`docs/dsh-compat.json`（8 个宿主入口文件的 sha256 基线）与 [`docs/dsh-compat.md`](docs/dsh-compat.md)（版本矩阵、0.2.0→0.2.1 实测差异、升级与重验证流程、真机验收清单）。
- 任务看板「**DSH 更新与兼容性周检**」：每周日 09:00 自动运行检查；契约未变则自动放宽版本范围并发版，契约变化则汇总差异后询问维护者。

### 变更

- **声明支持 DSH `0.2.1-rc.2`**：`peerDependencies` 里的 4 个 `@deepseek-ai/dsh-client-*` 范围由 `^0.1.1-rc.2 || ^0.1.5-rc.2 || ^0.2.0-rc.2` 扩展为再加 `|| ^0.2.1-rc.2`。

### 验证

- **逐字节契约比对**：`dsh-mcp-client` / `dsh-client-ui-slots` / `dsh-client-locale` / `dsh-client-store` / `dsh-skill` / `dsh-settings` 六个入口文件在 `0.2.0-rc.2` 与 `0.2.1-rc.2` 之间**完全相同**（含我们 inline 的 MCP 挂载器）。
- 有变化的仅 `dsh-client-ui-settings`（19+/43-，偏好持久化内部）与 `dsh-client-ui-renderer`（141+/116-，槽位渲染内部新增 `Anchor` 与缺失槽位渲染 null）——均不在本插件调用面上。
- `dsh-mcp-client` 的挂载 `Config` 字段（`command/args/env/cwd/toolCallTimeoutMs/failOnStartupError/reconnect`）在 `0.1.5-rc.3` → `0.2.0` → `0.2.1` 三个版本中**完全一致**，`buildLaunch()` 无需改动。
- 真机验收待你升级到 `0.2.1-rc.2` 后执行（清单见 `docs/dsh-compat.md` 第 6 节）。
## [0.8.0] - 2026-10-15

### 新增

- **README 封面图**（`docs/cover.jpg`）：一份 hero 图，把「让 Agent 真正动手操作 MATLAB 与 Simulink」、14 个工具 / 32 个技能、一行安装命令与 Simulink 工作流可视化了。中文与英文 README 均置于页首；随 npm 包发布（`docs/` 在 `files` 内），因此 npm 页也会显示。

### 文档

- `docs/release.md` 补两节：**可复现构建**（esbuild 把内联模块物理路径写进产物注释 → 跨机器字节不同；已由 `build.mjs` 剥离）与**在拿不到 Actions 日志时定位 CI 失败**（拆具名步骤 + `::error::` 注解，注解可用公开 API 读取）。
- README 排障表补三条实测坑：`ERR_PNPM_UNEXPECTED_STORE`（profile 树是全局 pnpm 10 装的、DSH 运行时是 pnpm 11，store 版本打架）及其完整修复命令（无 TTY 需 `confirmModulesPurge=false`；`CI=true` 会顺带打开 `--frozen-lockfile`）；以及「**插件突然不加载**」—— 插件管理器的卸载会**先删掉 `dsh.profile.bundles` 记录再跑 pnpm**，pnpm 失败时插件就静默消失。
## [0.7.3] - 2026-10-15

### 修复

- **跨平台路径解析**（`pickMatlabRoot` / `findOnPath` / `isMatlabRoot` / `releaseRank`）：此前用**宿主平台**的 `path` 规则解析「属于另一个平台」的路径 —— Linux 上 POSIX 规则不认反斜杠，`C:\MATLAB\R2025b\bin\matlab.exe` 被归一成 `..`，CI(ubuntu) 的 `paths.test.ts` 因此失败；本机 Windows 恰好正确，掩盖了这个 bug。现在按 `platform` 参数选择 `win32` / `posix` 规则（该参数此前形同虚设）。
- **构建产物跨机器不可复现**：esbuild 会把**内联模块的物理路径**写进产物注释（`// node_modules/.pnpm/@deepseek-ai+dsh-tools@0.1.5-rc.3_8f54…/lib/index.js`），而 `.pnpm` 目录名内嵌的 peer 依赖哈希因机器与 pnpm 版本而异 → 同一份源码在两台机器上构建出的 `lib/index.js` 字节不同，CI 的「lib 与全新构建一致」检查必然失败，也让产物泄露构建机路径。`build.mjs` 现在构建后剥离这类注释，并对残留发出警告。

### 发布

- `0.7.2` 由 **GitHub Actions 经 npm trusted publishing（OIDC）** 自动发布，无需 2FA 动态码，并携带 **SLSA provenance**（`dist.attestations`，发布者显示为 `GitHub Actions <npm-oidc-no-reply@github.com>`）。
- CI 同时拆成 `typecheck` / `unit tests` / `build bundles` 三段具名步骤；失败时把日志尾部以 `::error::` 注解与 job summary 输出（Actions 原始日志需要鉴权，注解可用公开 API 读取）。
## [0.7.2] - 2026-10-15

### 发布

- **已发布到 npm：`dsh-matlab-mcp@0.7.1`**（2026-10-14，35 文件 / 压缩 421.9 kB；含自包含 `lib/`、`cordis.patch.yml`、README、LICENSE；`dependencies` 为空 → 安装即用、无需构建）。
- **踩坑记录（staged publishing）**：npm 现在要求发布时提供 2FA；不带 `--otp` 时它不会直接发布，而是先建一个占位版本 `0.0.0-stage`（336 B，描述为 *Temporary package placeholder for staged publishing*）并把真实版本置于「等待分阶段发布」状态 —— 此时 `dsh-matlab-mcp-0.7.1.tgz` 仍是 404。补带 `--otp` 重发，或 `npm stage list` + `npm stage approve <id>` 后即为 `latest`。完整维护者流程见 [`docs/release.md`](docs/release.md)。
- 本机 npm 默认 registry 是只读镜像 `registry.npmmirror.com`，**发布必须显式 `--registry=https://registry.npmjs.org`**；发布后可用 `PUT https://registry.npmmirror.com/-/package/dsh-matlab-mcp/syncs` 让国内镜像立刻同步。
- 新增 `.github/workflows/publish.yml`：推 tag 即发布，优先走 **npm trusted publishing（OIDC，无 token、带 provenance）**；`workflow_dispatch` 可只打包不发布。首次发布因包尚不存在，需手动 `--otp` 完成，之后在 npmjs.com 配置 Trusted Publisher 即可交给 CI。

## [0.7.1] - 2026-10-14

### 修复

- **`deploy/proxy-config.mjs` 非默认端口漏端口**：`--port 8443` 时生成的 `proxy_redirect` 目标与 `downloadMirror` 行都不带端口（指向 80/443），客户端第一跳就会走进死路。现在引入 `authority`（默认端口省略、非默认端口补上），三处 `proxy_redirect`、镜像行与验证命令统一使用它。

### 新增

- **`deploy/DEPLOY.md`**：服务器部署详细流程 —— 现状勘察（含按发行版/宝塔/1Panel/Docker 判断配置目录）、备份、放文件、`nginx -t` + `reload`、本机 curl 判读表、安全组放行、插件填一行、回滚，以及**未备案决策树**（非标端口 / IP 直连 / 境外机器）。
## [0.7.0] - 2026-10-14

### 变更

- **划清边界：服务器侧部署工具移出插件目录**。原先放在 `scripts/` 的 `mirror-assets.mjs`（建静态镜像）与 `proxy-config.mjs`（生成 nginx 反代配置）移到 [`deploy/`](deploy/README.md)，并配独立 README 说明「这不是插件的一部分、npm 包也不包含它」。
  - `scripts/` 现在只剩插件侧内容：`install.mjs`（把插件装进 DSH）与各类验证探针。
  - 插件 README 把原来大段的 nginx/备案/端口内容压成一小节「制品获取（镜像 / 本地目录）」：只保留插件自身需要配置的 `downloadMirror` / `localAssetsDir`，其余指向 `deploy/`。
- 插件运行逻辑不变：这两个字段是插件「从哪取制品」的配置能力（默认关闭/空值），与制品如何部署到服务器上无关。
## [0.6.1] - 2026-10-14

### 修复

- **`proxy-config.mjs` 在 IP 场景不可用**：`--host` 给 IP 时原来仍生成 `listen 443 ssl` + 证书占位符，而 IP 一般拿不到公共 CA 证书（实测 `dl.159.75.130.207` 这类「前缀+IP」连 DNS 都解析不了）。现在按主机名自动选择：IP → `--scheme http`（`listen 80`，不生成 ssl 指令）并给出提示；域名 → HTTPS。新增 `--scheme` / `--port` 显式覆盖。
- **反代下 19.5 MB 二进制缓存永远 MISS**：release 资产的最终 URL 带**会轮换的签名串**（`?sp=…&se=…&sig=…`），而 nginx 默认把整个 request URI 计入 cache key。生成配置现在给 `/mp-assets/` 指定 `proxy_cache_key "$scheme$request_method$host$uri"`（仅按路径），并加 `proxy_read_timeout/send_timeout 300s`。
- 生成文件的头部注释补充放置位置说明（Debian/Ubuntu 的 `conf.d` 已在 `http{}` 内；CentOS/宝塔注意 `server{}` 上下文）。

## [0.6.0] - 2026-10-14

### 新增

- **服务器反代配置生成器 `scripts/proxy-config.mjs`**：输出可直接粘贴的 nginx 片段（三段上游 + 缓存 + Range 透传 + 安全限制）与对应的 DSH 镜像行，适合「不占磁盘、配置即用」的部署。
  - 实测跳转链决定了配置形态：`…/releases/latest/download/X` → **github.com**（同主机换 tag）→ **release-assets.githubusercontent.com**（19.5 MB 二进制终态）；`…/archive/refs/heads/main.zip` → **codeload.github.com**。nginx 不跟随跳转，因此 `codeload` 与 `release-assets` 各需独立 `location` **并**用 `proxy_redirect` 把跳转留在代理内，否则客户端会绕过代理直连 GitHub CDN。
  - 生成的配置默认包含 `limit_except GET HEAD` 与 `client_max_body_size 1m` 以**避免开放代理**，并加 `X-Mirror-Cache` 便于验证缓存命中。
- **本地制品目录 `localAssetsDir`**（可选、完全离线）：命中 `mirror-assets.mjs` 产出的目录树时**直接复制、零网络请求**；优先级 本地目录 → 镜像列表 → 直连。适合内网/断网机器与「一次拷贝、多机复用」。

### 变更

- 供给日志区分来源：`本地目录 / local`、`镜像 / via mirror` 或直连。

## [0.5.0] - 2026-10-14

### 新增

- **自建镜像工具 `scripts/mirror-assets.mjs`**：在一台网络好的机器上跑一次，产出可整体上传的静态目录树（按 GitHub 路径排布，因此一个 `{path}` 模板即可覆盖全部制品）、`mirror.json`（路径 + 字节数 + sha256）、`nginx.conf.example` 与 `README.txt`（上传/部署/验证清单）。
  - 实测：4 个文件合计 **38.4 MB**（二进制 19.5 MB + 工具箱 0.06 MB + 两个 zipball 4.1/16.4 MB），经 `gh-proxy.com` 拉取 5.22 / 0.06 / 4.12 / 13.55 MB/s。
  - 支持 `--via <模板>`：抓取时也可走镜像；`--out` / `--base-url` / `--asset` / `--force`。
- **端到端验证**：本地起静态服务器模拟「用户自己的服务器」，在**隔离的 DSH_HOME** 里跑插件的真实供给流程 —— 二进制 `v0.14.0 (via mirror)`、工具箱 `via mirror`、两个技能仓均从该服务器下载，`ready: true`。
- 文档新增「自建镜像」一节：静态模式（推荐）与反向代理模式的取舍，以及**开放代理风险**的明确警告（不得做成对全路径开放的 GitHub 代理）。

### 说明

- 静态模式对服务器零副作用：不新开端口、不访问外网、无缓存进程；磁盘占用即上表 38.4 MB，CPU/内存开销可忽略。
- 许可提示：把 MathWorks 制品放到**自己的服务器供自己使用**属于私有使用；发布到公共 registry/公开站点则构成再分发，需遵守其许可证（保留版权与许可声明、仅配合 MathWorks 产品使用）。

## [0.4.0] - 2026-10-14

### 修复

- **严重：点「一键安装 / 修复」后 DSH 客户端崩溃**（`dsh: fatal uncaught exception: Error: spawn ...bin\matlab-mcp-server-windows-x64.exe ENOENT`）。
  - **根因不是文件缺失**：libuv 在 **`cwd` 不存在**时同样报 `spawn <exe> ENOENT`（错误指向命令，实为 chdir 失败）。挂载配置的 `cwd` 指向 `<DSH_HOME>\matlab-mcp\workspace`，而全新机器上该目录从未被创建（一键安装只建了缓存根与 `logs/`）。新机器时间线：启动时还没有二进制 → 不挂载（安全）→ 点安装 → 二进制就位 → 路由 `reconnect()` → 用不存在的 `cwd` 启动 → 未捕获异常 → 宿主退出。
  - **实测对照**：同一个真实存在的 exe，`cwd` 正常 → `spawned ok`；`cwd` 不存在 → `ENOENT`，与崩溃日志逐字一致。
  - **修复（多层防护）**：① `buildLaunch` 构造启动配置时创建 `cwd` 与 `--log-folder`；② 挂载前用我们自己的 `execFile` 做 `--version` 预检，跑不起来的二进制不再交给 MCP 客户端，改为可操作报错；③ 挂载配置在 `ctx.inject(['tools'])` 回调内**现算**，压掉「检查存在」与「真正 spawn」之间的窗口；④ `probeMcp` 补上 `child.on('error')`（此前缺该监听，同样会变成未捕获异常）；⑤ 下载改为**暂存校验后再原子换入**（校验在 `.partial` 上做），失败只清理暂存文件；`ensureBinary` 不再「先删后下」，也不再对下载后跑不起来的二进制返回成功。
- **这是 DSH 侧 `dsh-mcp-client` 的健壮性缺陷**：子进程 `spawn` 失败以未捕获异常终止宿主。插件已从自身侧消除可预见的触发条件，仍建议向上游反馈「`ChildProcess` 的 `'error'` 事件必须被捕获」。

### 变更

- **多镜像 + 镜像优先**：`downloadMirror` 改为逗号分隔的模板列表（支持 `{url}` 前缀式、`{path}` 换主机式，兼容老的纯前缀写法）；开启镜像后**镜像优先、直连兜底**（实测直连 0.21 MB/s vs 镜像 2.5–9.5 MB/s）。
- **默认镜像按实测重排**：`gh-proxy.com` → `gh.llkk.cc` → `ghproxy.net`（2026-10-14 关梯子实测：gh-proxy.com 2.53 MB/s / codeload 9.51 MB/s，ghproxy.net 0.03 MB/s，其余候选全部不通）。
- **技能仓优先走 zipball**（开启镜像时）：codeload 经镜像实测 9.5 MB/s（40 MB ≈ 5 秒）；`git clone` 直连 GitHub、绕不过镜像，退居兜底。解压成功后才切换目录，失败不会毁掉已有技能仓。
- **设置卡新增「镜像测速」**：对真实制品测 TTFB 与吞吐，并可一键「把最快的排到最前」——镜像存活期常常只有几小时，写死排序必然过期。
- README 排障表补充：崩溃日志读法（`ENOENT` ≠ 文件不存在）与杀毒软件隔离的应对。

## [0.3.1] - 2026-10-14

### 修复

- **内联版在 DSH 里加载失败（`matlab-mcp (dsh-matlab-mcp): failed to import`）**：
  - **现象**：0.3.0 的 `lib/index.js` 在 `node -e`、DSH 自带 Node、Electron-as-Node 三种独立进程里都能 import，但 DSH 启动时该 entry 的 `fiber` 始终是 `undefined`（`dsh-app-boot` 把 `fiber === undefined` 归类为 `failed to import`，真实异常只打到控制台）。
  - **定位**：把 DSH 宿主的 Electron 进程当作测试环境（`run_code` 就运行在其中），用与加载器相同的 `await import(file://…)` 复现出真实异常：
    `Error: Dynamic require of "child_process" is not supported at lib/index.js:11:9`（栈上是 `cross-spawn` ← MCP SDK）。
  - **根因**：把 CJS 依赖内联进 ESM bundle 后，esbuild 会把它们的 `require('child_process')` 改写成 `__require` 垫片；ESM 里没有 `require` 绑定时该垫片直接抛错 —— 只有真正走到宿主加载路径才会触发。
  - **修复**：`build.mjs` 给宿主 bundle 加 banner，用 `createRequire(import.meta.url)` 恢复 CJS 全局（`require` / `__filename` / `__dirname`）。
  - **验证**：在宿主 Electron 进程内 `await import()` 成功，`resolveConfig` / `Config` / `buildLaunch` 均正常。
- **CI 增补**：`inlined CJS dependencies must have their globals`（检查 banner 关键字）与 `the host bundle must import cleanly`（真实 import + 导出形状断言），防止同类问题再溜过去。

## [0.3.0] - 2026-10-14

### 变更

- **插件改为「clone 下来就能用」**：
  - 宿主 bundle 现在**内联全部运行时依赖**（`@deepseek-ai/dsh-mcp-client`、`dsh-settings`、`schemastery` 等），`lib/index.js` 只依赖 Node 内置模块 —— 实测把 `node_modules` 整个移走后仍能 `import` 成功（`IMPORT OK -> Config,MATLAB_MCP_SETTINGS_NAMESPACE,apply,buildLaunch,inject,resolveConfig`）。
  - **`lib/` 随仓库提交**（移出 `.gitignore`），新客户端 `git clone` 后无需 `pnpm install` / `pnpm build` 即可加载。
  - `scripts/install.mjs` 相应简化：不再强制安装依赖与构建，只做接线（建 `%DSH_HOME%` 联接 → 写 profile → 建立/修复 `node_modules` 联接），**没有 pnpm 也能装**；新增 `--rebuild` 供开发者从源码重建。
- **CI（`.github/workflows/check.yml`）**：每次 push 跑 `typecheck` + 6 套测试 + `build`，并校验 ① `lib/` 与全新构建一致（不会悄悄过期）② `lib/index.js` 里不再残留 `@deepseek-ai/*` 外部 import（保证自包含）。
- `dependencies` 清空（依赖已内联），相关包移入 `devDependencies`。

## [0.2.1] - 2026-10-14

### 新增

- **新客户端一键安装器 `scripts/install.mjs`**：`git clone` 后在仓库里跑 `node scripts/install.mjs` 即可完成全部接线 ——
  ① 仓库内 `pnpm install`（`prepare` 顺带构建 `lib/index.js`）；
  ② 在 `%DSH_HOME%` 建 `matlab-mcp-plugin` 联接指向仓库（同盘路径，规避 pnpm 跨盘 `link:` 问题）；
  ③ 给每个存在的 profile 写 `dependencies` / `dsh.profile.bundles` / `cordis.patch.yml`；
  ④ 在 profile 内 `pnpm install`，并**统一修复所有失效的 `link:` 联接**（含其它本地插件）；
  ⑤ 打印后续步骤。支持 `--dry-run` / `--profile <name>` / `--skip-profile-install`，`pnpm` 缺失时给出 DSH 自带 pnpm 的用法。

### 修复

- **新客户端启动报 `matlab-mcp (dsh-matlab-mcp): failed to import`**：根因是仓库按惯例不提交构建产物（`lib/` 被 `.gitignore` 排除）且插件从自身 `node_modules` 解析 `@deepseek-ai/*`，全新克隆后两者都不存在。安装器与文档（README「安装」第 0 节 + 排障表）现在明确覆盖这一路径。

## [0.2.0] - 2026-10-14

### 新增

- **聊天主界面「打开 MATLAB」按钮**：注册到会话标题栏动作位 `conversation.session.header.actions`（独立于设置页的第二个 UI 入口），点击即打开 MATLAB 桌面窗口。
  - `new` 会话模式：打开独立 MATLAB 桌面窗口，按钮提示里说明 Agent 使用的是它自己启动的会话。
  - `auto` / `existing` 会话模式：以 `-r shareMATLABSession` 打开**共享**会话，MCP 服务器随后连到同一个 MATLAB —— 你能在窗口里直接看着 Agent 干活。
  - 以 `detached + unref` 启动，窗口独立于插件生命周期：插件卸载不会关掉它（脚本 `scripts/open-matlab.ts` 实测：新 MATLAB 进程出现，且归属判定为「非本插件所有」）。
  - 新增宿主路由 `POST /api/dsh-matlab-mcp/open-matlab` 与 `buildMatlabDesktopArgs` 单测。

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

[Unreleased]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.7.3...v0.8.0
[0.7.3]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MCviseron/dsh-matlab-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MCviseron/dsh-matlab-mcp/releases/tag/v0.1.0
