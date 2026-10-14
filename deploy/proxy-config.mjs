#!/usr/bin/env node
/**
 * Emit an nginx reverse-proxy config for the MathWorks artifacts this plugin
 * downloads, plus the exact `downloadMirror` line to paste into DSH.
 *
 * Three upstreams, because of the verified redirect chain:
 *   github.com/.../releases/latest/download/X  -> 302 github.com/.../releases/download/vX/X
 *                                              -> 302 release-assets.githubusercontent.com/...   (the 19.5 MB binary)
 *   github.com/.../archive/refs/heads/main.zip -> 302 codeload.github.com/...
 * nginx does not follow redirects, so the two CDN hosts each need their own
 * location **and** a `proxy_redirect` rewrite, otherwise the client would leave
 * the proxy and fetch straight from GitHub's CDN (slow — the whole point).
 *
 * And one caching subtlety: the final asset URL carries a *rotating* signature
 * (`?sp=…&se=…&sig=…`), and nginx keys its cache on the full request URI — with
 * the default key the 19.5 MB binary would be re-fetched on every single
 * install. The generated `/mp-assets/` location therefore keys on the path only.
 *
 *   node deploy/proxy-config.mjs --host dl.example.com
 *   node deploy/proxy-config.mjs --host 159.75.130.207            # IP => plain HTTP by default
 *   node deploy/proxy-config.mjs --host dl.example.com --scheme http --port 8080
 *   node deploy/proxy-config.mjs --host dl.example.com --static-dir /srv/matlab-assets --out proxy.conf
 */
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = argv.indexOf('--' + name)
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback
}
const has = (name) => argv.includes('--' + name)

const host = flag('host', '你的域名')
const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
const scheme = flag('scheme', isIp ? 'http' : 'https')
const port = flag('port', scheme === 'https' ? '443' : '80')
const prefix = '/' + flag('prefix', 'mp').replace(/^\/+|\/+$/g, '') + '/'
const staticPrefix = '/' + flag('static', 'matlab-static').replace(/^\/+|\/+$/g, '') + '/'
const staticDir = flag('static-dir', '')
const cacheDir = flag('cache-dir', '/var/cache/nginx/matlab-proxy')
const cacheSize = flag('cache-size', '2g')
const out = flag('out', '')
const cacheKey = 'matlab_proxy'
const trim = prefix.replace(/\/$/, '')

const tls = scheme === 'https'
  ? `    listen ${port} ssl;\n    ssl_certificate     /path/to/fullchain.pem;      # 复用你现有证书\n    ssl_certificate_key /path/to/privkey.pem;`
  : `    listen ${port};                                    # 明文 HTTP（IP 场景通常只能这样）`

const staticLocation = staticDir === ''
  ? ''
  : `
    # ④（可选）本地静态目录：把 19.5 MB 二进制 + mltbx 放这里，
    #    省掉「asset 跳到 CDN」这一跳；两个技能仓仍走下面的反代。
    location ${staticPrefix} {
        alias ${staticDir}/;
        autoindex off;
        default_type application/octet-stream;    # .exe/.mltbx 没有内置 MIME
        add_header Cache-Control "public, max-age=86400";
    }
`

const conf = `# ============================================================================
# MATLAB 制品反代 —— 独立配置文件，例如 /etc/nginx/conf.d/matlab-proxy.conf
# 生成参数: host=${host}  scheme=${scheme}  port=${port}  prefix=${prefix}${staticDir === '' ? '' : '  static=' + staticPrefix + '->' + staticDir}
#
# 放置位置：
#   Debian/Ubuntu：conf.d/*.conf 本身就在 http { } 里 —— 整份文件直接放进去即可。
#   CentOS / 宝塔 / 自定义 nginx.conf：把 proxy_cache_path 那行放进 http { }，
#   把 server { } 放进（或替换成）你自己的 server 块 / 站点配置里。
# 生效：nginx -t && systemctl reload nginx     # reload，不要 restart
# ============================================================================

# ---- 放到 http { } 作用域（缓存目录 + 上限）--------------------------------
proxy_cache_path ${cacheDir} levels=1:2 keys_zone=${cacheKey}:10m max_size=${cacheSize} inactive=60d use_temp_path=off;

server {
${tls}
    server_name ${host};
${isIp && tls ? '    # 注意：IP 地址一般拿不到公共 CA 证书 —— 想用 HTTPS 请改成真实域名（或 --scheme http）\n' : ''}
    # ---------------------------------------------------------------------
    # ① 主入口：github.com（版本资产、仓库文件）
    #    只放行 GET/HEAD，并限制体积 —— 绝不能做成对全路径开放的开放代理
    # ---------------------------------------------------------------------
    location ${prefix} {
        limit_except GET HEAD { deny all; }
        client_max_body_size 1m;

        proxy_pass https://github.com/;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host github.com;
        proxy_set_header Connection "";

        # 保留 Range，让「镜像测速」与大文件续传正常工作
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        proxy_cache ${cacheKey};
        proxy_cache_valid 200 206 30d;
        proxy_cache_lock on;
        proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504 updating;
        proxy_cache_background_update on;
        add_header X-Mirror-Cache $upstream_cache_status always;

        # 关键：把跳转**留在代理内**，否则客户端会绕过你直连 GitHub CDN
        proxy_redirect https://codeload.github.com/ ${scheme}://${host}${trim}-codeload/;
        proxy_redirect https://release-assets.githubusercontent.com/ ${scheme}://${host}${trim}-assets/;
        proxy_redirect https://objects.githubusercontent.com/ ${scheme}://${host}${trim}-objects/;
    }

    # ② zipball 跳到这里（codeload.github.com）
    location ${trim}-codeload/ {
        limit_except GET HEAD { deny all; }
        client_max_body_size 1m;
        proxy_pass https://codeload.github.com/;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host codeload.github.com;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_cache ${cacheKey};
        proxy_cache_valid 200 206 30d;
        proxy_cache_lock on;
        add_header X-Mirror-Cache $upstream_cache_status always;
    }

    # ③ release 资产（那个 19.5 MB 的 exe / mltbx）最终跳到这里
    location ${trim}-assets/ {
        limit_except GET HEAD { deny all; }
        client_max_body_size 1m;
        proxy_pass https://release-assets.githubusercontent.com/;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host release-assets.githubusercontent.com;
        proxy_set_header Connection "";
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        # 该 URL 带**会变**的签名串（?sp=&se=&sig=），nginx 默认用整个 URI 做 key
        # → 每次都是新 key、缓存永远 MISS。路径本身即内容唯一标识，故只按路径缓存。
        proxy_cache_key "$scheme$request_method$host$uri";
        proxy_cache ${cacheKey};
        proxy_cache_valid 200 206 30d;
        proxy_cache_lock on;
        add_header X-Mirror-Cache $upstream_cache_status always;
    }
${staticLocation}}
`

const base = `${scheme}://${host}`
const mirrorLine = staticDir === ''
  ? `${base}${prefix}{path}`
  : `${base}${staticPrefix}{path},${base}${prefix}{path}`

const notes = `
# ============================================================================
# 在 DSH 里怎么填（设置 → MATLAB / Simulink MCP → 镜像列表）
#   allowMirrorDownload: true
#   downloadMirror: ${mirrorLine}
#
# 验证（在慢机器上执行）：
#   curl -IL "${base}${prefix}matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe" | grep -iE "HTTP/|location|x-mirror-cache"
#     → 期望最终 200；中间 Location 应指向 ${base}${trim}-assets/...
#       （若仍指向 release-assets.githubusercontent.com，说明 proxy_redirect 没生效）
#   curl -o /dev/null -w "%{speed_download}\\n" "${base}${prefix}matlab/simulink-agentic-toolkit/archive/refs/heads/main.zip"
#     → 第二次应显著更快，响应头 X-Mirror-Cache: HIT 即为命中
#
# 注意
#   * 必须保留 limit_except / client_max_body_size，否则就是一个开放代理，
#     会被刷流量、甚至导致你的 IP 被 GitHub 限流。
#   * 缓存上限用 max_size 控制（默认 2g，够缓存全部制品很多个版本）。
#   * 只想要最稳、零外网：用 deploy/mirror-assets.mjs 做静态镜像（38.4 MB 上传），
#     那条路径已端到端验证过；本反代是「不占磁盘、配置即用」的替代。
#   * GitHub 若更换 CDN 域名，用 curl -IL 看 Location，补一条 proxy_redirect
#     与对应 location 即可。
`

process.stdout.write(conf + notes)
if (out !== '') {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(out, conf + notes, 'utf8')
  console.error('[proxy-config] written: ' + out)
}
if (has('help')) {
  console.error('usage: node deploy/proxy-config.mjs --host <域名或IP> [--scheme http|https] [--port N] [--prefix mp] [--static-dir /srv/...] [--static matlab-static] [--cache-dir /var/cache/nginx/matlab-proxy] [--cache-size 2g] [--out file]')
}
