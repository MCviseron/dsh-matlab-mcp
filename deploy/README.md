# deploy/ — 服务器侧部署工具

> 实际动手部署请照 [`DEPLOY.md`](DEPLOY.md)：勘察现状 → 备份 → 放文件 → `nginx -t` + `reload` → 本机 curl 验证 → 安全组放行 → 插件填一行，含未备案决策树与回滚步骤。

**这里的东西不是插件的一部分。** 它不参与插件运行，npm 包也不包含它（`package.json` 的 `files` 字段里没有 `deploy/`）。只有你决定把制品放到自己的服务器上时才需要。

插件的职责只是「从某个地方取到制品」—— 取哪里由 `downloadMirror` / `localAssetsDir` 两个配置决定；**制品怎么放到你的服务器上**，就是本目录的事。

| 文件 | 用途 |
|---|---|
| `mirror-assets.mjs` | 抓齐全部制品（二进制 + 工具箱 + 两个技能仓），产出**可直接上传的静态目录树** + `mirror.json`(sha256) + `nginx.conf.example` + 上传清单 |
| `proxy-config.mjs` | 生成 **nginx 反向代理配置**（服务器实时回源并缓存，不用上传任何文件）+ 对应的插件镜像行 |

## 两种模式怎么选

| | 静态镜像 | 反向代理 |
|---|---|---|
| 服务器磁盘 | 38.4 MB（一次） | 只有缓存（`max_size` 可控，默认 2g） |
| 服务器出网 | **不需要** | 需要能访问 GitHub 三个域名 |
| 一次安装的流量 | 从你服务器下载 | 首次回源 + 之后走缓存 |
| 依赖外部 | 无 | GitHub 的跳转链 / CDN 域名可能变 |
| 适合 | 多机器、内网、要最稳 | 只有一台机器要加速、不想传文件 |

**结论**：多机/内网 → 静态镜像；单机/图省事 → 反代。两者也可以混用（静态放二进制、反代管技能仓）。

---

## 一、静态镜像

```bash
# 在一台网络好的机器上执行
node deploy/mirror-assets.mjs --out D:\mirror --base-url https://你的域名/matlab-mirror
# 抓取慢时可走公共镜像： --via "https://gh-proxy.com/{url}"
```

产出（实测）：4 个文件 **38.4 MB** —— 二进制 19.5 MB、工具箱 0.06 MB、两个技能仓 zipball 4.1 / 16.4 MB（zipball 是压缩包，比 clone 出来的 49 MB 小）。

**上传 + 部署**（用生成的 `nginx.conf.example`，独立配置文件，不影响其它站点）：

```nginx
location /matlab-mirror/ {
    alias /srv/matlab-mirror/;
    autoindex off;
    default_type application/octet-stream;    # .exe/.mltbx 没有内置 MIME
}
```
```bash
nginx -t && systemctl reload nginx
```

**插件里填**：`downloadMirror: "https://你的域名/matlab-mirror{path}"`

---

## 二、反向代理

```bash
# 有域名（自动 HTTPS，复用现有证书）
node deploy/proxy-config.mjs --host dl.example.com --prefix mp --out proxy.conf
# 只有 IP（自动切明文 HTTP，不生成 ssl 指令）
node deploy/proxy-config.mjs --host 1.2.3.4 --prefix mp --out proxy.conf
# 非标端口（未备案域名走 80/443 常被拦时）
node deploy/proxy-config.mjs --host www.example.com --scheme http --port 8443 --out proxy.conf
```

**为什么必须覆盖三个上游**（实测跳转链）：

```
github.com/…/releases/latest/download/X  →302 github.com/…/releases/download/vX/X
                                         →302 release-assets.githubusercontent.com/…   ← 19.5 MB 二进制
github.com/…/archive/refs/heads/main.zip →302 codeload.github.com/…                   ← 两个技能仓
```

nginx **不跟随跳转**，所以 `codeload` 与 `release-assets` 各自需要独立 `location` **并配合 `proxy_redirect`** 把跳转留在代理内；否则客户端会拿到原始 302、绕过你的代理直连 GitHub CDN。

**两个已内建的坑规避**：

1. **缓存永远 MISS**：release 资产的最终 URL 带轮换签名串（`?sp=…&se=…&sig=…`），nginx 默认把整个 URI 计入 cache key → 19.5 MB 每次回源。生成配置给 `/mp-assets/` 指定了 `proxy_cache_key "$scheme$request_method$host$uri"`（只看路径）。
2. **IP 场景**：IP 一般拿不到公共 CA 证书，且「前缀+IP」（如 `dl.1.2.3.4`）连 DNS 都解析不了；生成器按主机名自动选择 HTTP/HTTPS。

**安全（必须保留）**：`limit_except GET HEAD` + `client_max_body_size 1m` —— 不加就是**开放代理**，会被刷流量、甚至导致你的 IP 被 GitHub 限流。

---

## 三、中国大陆服务器特别注意

- **未备案域名 + 大陆机器的 80/443 会被拦**（通常表现为「未备案」提示页或连接重置），与「个人账户」无关：**个人可以备案**，但要求域名实名主体 = 备案主体 = 服务器购买主体，且账号下有符合时长要求的云资源（以腾讯云/阿里云控制台校验为准），周期数天到数周。
- **不等备案也能用的三条路**：① 域名 + 非标端口（如 8443，拦截基本只针对 80/443）；② IP 直连 + 80（不涉及域名）；③ 换香港/境外机器。
- 备案是长期正规化的唯一办法，建议并行推进。

## 四、许可

把 MathWorks 制品放到**自己的服务器供自己使用**属于私有使用；发布到公共 registry 或公开站点则构成**再分发**，需遵守其许可证（BSD 三条款式：保留版权声明与免责声明；且限定「仅用于配合 MathWorks 产品」）。

---

# 附：给插件的接口（就一行）

```yaml
allowMirrorDownload: true
downloadMirror: "https://你的域名/matlab-mirror{path},https://gh-proxy.com/{url}"   # 逗号分隔，按序回退
# 完全离线也可以：
localAssetsDir: "D:\\mirror"        # 命中即本地复制，零网络请求；优先级 本地 → 镜像 → 直连
```
