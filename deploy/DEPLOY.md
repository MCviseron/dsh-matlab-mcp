# 部署到服务器：详细流程

> 目标：**只新增一个文件，绝不动你现有的 nginx 配置**。任何一步出问题都能 30 秒回滚。
> 生成配置见 [`README.md`](README.md)：`node deploy/proxy-config.mjs --host <域名或IP> ...`

---

## 步骤 0 · 先勘察现状（只读，不改任何东西）

```bash
nginx -v                                   # 版本
nginx -T | grep -nE 'include' | head -20   # 最终生效的配置里 include 了哪些目录（决定文件放哪）
ls -l /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null
nginx -T | grep -nE 'server_name|listen |ssl_certificate ' | head -40   # 现有站点与证书路径
ss -ltnp | grep -E ':(80|443|8443)\b'      # 谁在监听、监听的进程
```

按发行版/面板决定放置位置：

| 环境 | 配置目录 | 做法 |
|---|---|---|
| Debian / Ubuntu | `/etc/nginx/conf.d/*.conf`（本身在 `http{}` 内）或 `sites-enabled/` | 整个文件丢进 `conf.d/` 即可 |
| CentOS / RHEL / Rocky | `/etc/nginx/conf.d/*.conf`（在 `http{}` 内） | 同上 |
| 宝塔面板 | `/www/server/panel/vhost/nginx/*.conf` | 面板「网站 → 添加站点」更稳妥；也可放 `conf.d` 后 reload |
| 1Panel | `/www/server/openresty/nginx/conf/conf.d/` | 用面板添加站点 |
| Docker 里的 nginx | 挂载目录（`docker inspect` 看 mounts） | 放进被挂载进来的 `conf.d` |

> 你已有的 403 说明 nginx 正常、只是没有匹配该 Host 的站点 —— 我们的新文件补上 `server_name` 后就会接管该域名，**原有站点不受影响**（不同 `server_name` 互不干扰）。

## 步骤 1 · 备份（回滚就靠它）

```bash
tar czf ~/nginx-backup-$(date +%F-%H%M).tar.gz /etc/nginx/
```

## 步骤 2 · 放入新配置

```bash
# 本地生成（示例：未备案时用非标端口 8443 + 明文）
node deploy/proxy-config.mjs --host www.oriformc.top --scheme http --port 8443 --out proxy.conf

# 上传
scp proxy.conf root@<服务器IP>:/etc/nginx/conf.d/matlab-proxy.conf
```

**检查两处**：

1. `server_name` 必须是你要用的域名/主机；
2. `listen` 的端口与你打算使用的端口一致；并且 `proxy_cache_path` 那一行若不在 `http{}` 内，需要挪进去（`proxy-config.mjs` 的头部注释已说明）。

首次部署建议**先不写静态目录段**（不带 `--static-dir`），跑通反代再加。

## 步骤 3 · 语法检查 + 平滑重载（不中断线上服务）

```bash
nginx -t                     # 必须出现 syntax is ok / test is successful
systemctl reload nginx       # 是 reload，不是 restart
```

> `nginx -t` 报错就把文件删掉再 reload，原配置毫发无损：
> `rm /etc/nginx/conf.d/matlab-proxy.conf && systemctl reload nginx`

## 步骤 4 · 在服务器本机验证（绕开 DNS 与备案干扰）

```bash
# 直连本地端口 + 伪造 Host，能排除 DNS/备案/安全组的一切干扰
curl -IL -H 'Host: www.oriformc.top' http://127.0.0.1:8443/mp/matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe \
  | grep -iE 'HTTP/|location|x-mirror-cache'
```

判读：

| 看到 | 含义 |
|---|---|
| 最终 `HTTP/1.1 200` + `content-length: 19502944` | ✅ 反代到 GitHub 成功 |
| 中间 `Location: http(s)://www.oriformc.top/mp-assets/...` | ✅ `proxy_redirect` 生效（客户端不会绕过代理） |
| `Location: https://release-assets.githubusercontent.com/...` | ✗ `proxy_redirect` 没生效，检查是否有 `server_name` 不匹配/被别的 server 块先命中 |
| `404` / `403` | 路径或 `location` 前缀写错；对照生成文件里的 `location` 与小节末尾的镜像行 |
| 第二次请求 `X-Mirror-Cache: HIT` | ✅ 缓存生效（第一次 MISS 属正常） |

技能仓（走 codeload 那一跳）也验一下：

```bash
curl -o /dev/null -w "%{http_code} %{speed_download}\n" -H 'Host: www.oriformc.top' \
  http://127.0.0.1:8443/mp/matlab/simulink-agentic-toolkit/archive/refs/heads/main.zip
```

## 步骤 5 · 放行端口（云厂商安全组）

腾讯云 / 阿里云控制台：**防火墙 / 安全组 → 入站规则 → 放行 TCP 8443**（80/443 一般已放行）。

## 步骤 6 · 从你自己的电脑验证（真实网络路径）

```bash
curl -IL "http://www.oriformc.top:8443/mp/matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe" | grep -iE "HTTP/|location|x-mirror-cache"
curl -o /dev/null -w "%{speed_download}\n" "http://www.oriformc.top:8443/mp/matlab/simulink-agentic-toolkit/archive/refs/heads/main.zip"
```

## 步骤 7 · 插件里填一行

DSH 设置 → MATLAB / Simulink MCP → 镜像列表（`downloadMirror`）：

```yaml
allowMirrorDownload: true
downloadMirror: "http://www.oriformc.top:8443/mp/{path}"
```

然后点「**镜像测速**」→ 应看到你的域名排第一；再点「一键安装 / 修复」。

## 回滚

```bash
rm /etc/nginx/conf.d/matlab-proxy.conf && systemctl reload nginx          # 常态回滚
tar xzf ~/nginx-backup-*.tar.gz -C / && systemctl reload nginx            # 极端情况
```

---

## 中国大陆 / 未备案的情形（决策树）

```
域名是否已备案？
├─ 已备案 → 正常用 80/443 + HTTPS（--host 域名，自动生成 ssl 配置）
└─ 未备案（大陆机器）
   ├─ 用非标端口（推荐）→ --scheme http --port 8443   ← 拦截基本只针对 80/443
   ├─ 只用 IP 直连        → --host <IP>                ← 不涉及域名
   └─ 或换香港/境外机器    → 无需备案
```

判断是否被「未备案拦截」：`curl -I http://www.oriformc.top/` 若返回腾讯云/阿里云的提示页（页面里有「备案」字样、或 `Server` 不是你的 nginx 版本），就是被拦了 —— 换端口或换 IP 直连即可。

> 个人也能备案（个人备案），条件通常是：域名实名主体 = 备案主体 = 服务器购买主体，且账号下有符合时长要求的云资源；`.top` 是否在批复列表以控制台校验为准。周期数天到数周，建议并行推进，但不影响你**今天**先用非标端口把链路跑通。
