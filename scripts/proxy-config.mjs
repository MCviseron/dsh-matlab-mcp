#!/usr/bin/env node
/**
 * Emit an nginx reverse-proxy config for the MathWorks artifacts this plugin
 * downloads, plus the exact `downloadMirror` line to paste into DSH.
 *
 * Why three upstreams: verified redirect chain —
 *   github.com/.../releases/latest/download/X  -> 302 github.com/.../releases/download/vX/X
 *                                              -> 302 release-assets.githubusercontent.com/...   (the 19.5 MB binary)
 *   github.com/.../archive/refs/heads/main.zip -> 302 codeload.github.com/...
 * nginx does not follow redirects, so the two CDN hosts each need their own
 * location **and** a `proxy_redirect` rewrite, otherwise the client would leave
 * the proxy and fetch straight from GitHub's CDN (slow — the whole point).
 *
 *   node scripts/proxy-config.mjs --host dl.example.com --static-dir /srv/matlab-assets
 *   node scripts/proxy-config.mjs --host dl.example.com --out proxy.conf
 *
 * Nothing here is downloaded or uploaded: this mode only needs the config.
 */
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = argv.indexOf('--' + name)
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback
}

const host = flag('host', '你的域名')
const prefix = ('/' + flag('prefix', 'mp').replace(/^\/+|\/+$/g, '') + '/')
const staticPrefix = ('/' + flag('static', 'matlab-static').replace(/^\/+|\/+$/g, '') + '/')
const staticDir = flag('static-dir', '/srv/matlab-assets')
const cacheDir = flag('cache-dir', '/var/cache/nginx/matlab-proxy')
const cacheSize = flag('cache-size', '2g')
const cacheKey = 'matlab_proxy'
const out = flag('out', '')

const conf = `# ============================================================================
# MATLAB 制品反代 —— 独立配置文件，例如 /etc/nginx/conf.d/matlab-proxy.conf
# 生成参数: host=${host}  prefix=${prefix}  static=${staticPrefix}->${staticDir}
#
# 部署（不影响服务器上其它服务）：
#   1) 把下面的 proxy_cache_path 那一行放到 http { } 里（或单独的 conf.d 文件里）
#   2) 把 server { } 挂到你现有域名的 server 块里（或作为子域名）
#   3) nginx -t && systemctl reload nginx        # reload，不要 restart
# ============================================================================

# ---- 放到 http { } 作用域（缓存目录 + 上限）--------------------------------
proxy_cache_path ${cacheDir} levels=1:2 keys_zone=${cacheKey}:10m max_size=${cacheSize} inactive=60d use_temp_path=off;

server {
    listen 443 ssl;
    server_name ${host};                      # 复用你现有的证书即可
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

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

        proxy_cache ${cacheKey};
        proxy_cache_valid 200 206 30d;
        proxy_cache_lock on;
        proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504 updating;
        proxy_cache_background_update on;
        add_header X-Mirror-Cache $upstream_cache_status always;

        # 关键：把跳转**留在代理内**，否则客户端会绕过你直连 GitHub CDN
        proxy_redirect https://codeload.github.com/ ${'https://' + host}${('' + prefix).replace(/\/$/, '')}-codeload/;
        proxy_redirect https://release-assets.githubusercontent.com/ ${'https://' + host}${('' + prefix).replace(/\/$/, '')}-assets/;
        proxy_redirect https://objects.githubusercontent.com/ ${'https://' + host}${('' + prefix).replace(/\/$/, '')}-objects/;
    }

    # ② zipball 跳到这里（codeload.github.com）
    location ${prefix.replace(/\/$/, '')}-codeload/ {
        limit_except GET HEAD { deny all; }
        client_max_body_size 1m;
        proxy_pass https://codeload.github.com/;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host codeload.github.com;
        proxy_set_header Connection "";
        proxy_cache ${cacheKey};
        proxy_cache_valid 200 206 30d;
        proxy_cache_lock on;
        add_header X-Mirror-Cache $upstream_cache_status always;
    }

    # ③ release 资产（那个 19.5 MB 的 exe / mltbx）最终跳到这里
    location ${prefix.replace(/\/$/, '')}-assets/ {
        limit_except GET HEAD { deny all; }
        client_max_body_size 1m;
        proxy_pass https://release-assets.githubusercontent.com/;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host release-assets.githubusercontent.com;
        proxy_set_header Connection "";
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_cache ${cacheKey};
        proxy_cache_valid 200 206 30d;
        proxy_cache_lock on;
        add_header X-Mirror-Cache $upstream_cache_status always;
    }

    # ④（可选，但很推荐）本地静态目录：把 19.5 MB 二进制 + mltbx 放这里，
    #    省掉「asset 跳 CDN」这一跳；两个技能仓仍走上面的反代。
    location ${staticPrefix} {
        alias ${staticDir}/;
        autoindex off;
        default_type application/octet-stream;    # .exe/.mltbx 没有内置 MIME
        add_header Cache-Control "public, max-age=86400";
    }
}
`

const mirrorLine = `https://${host}${staticPrefix}{path},https://${host}${prefix}{path}`

const notes = `
# ============================================================================
# 在 DSH 里怎么填（设置 → MATLAB / Simulink MCP → 镜像列表）
#   allowMirrorDownload: true
#   downloadMirror: ${mirrorLine}
#
# 第一个（静态）负责 exe/mltbx —— 有就命中，没有就 404 自动回退；
# 第二个（反代）负责两个技能仓 zipball 与其余请求。
# 想只用一个反代、不做静态目录，就删掉前半段：
#   downloadMirror: https://${host}${prefix}{path}
#
# 验证（在慢机器上执行）：
#   curl -IL "https://${host}${prefix}matlab/matlab-mcp-server/releases/latest/download/matlab-mcp-server-windows-x64.exe" | grep -iE "HTTP/|location|x-mirror-cache"
#     → 期望最终 200，且中间的 Location 指向 https://${host}${prefix.replace(/\/$/, '')}-assets/...
#       （若 Location 指向 release-assets.githubusercontent.com，说明 proxy_redirect 没生效）
#   curl -o /dev/null -w "%{speed_download}\\n" "https://${host}${prefix}matlab/simulink-agentic-toolkit/archive/refs/heads/main.zip"
#     → 第一次是回源速度，第二次应显著更快（命中缓存，响应头 X-Mirror-Cache: HIT）
#
# 注意
#   * 必须保留 limit_except / client_max_body_size，否则就是一个开放代理，
#     会被刷流量、甚至导致你的 IP 被 GitHub 限流。
#   * 缓存上限用 max_size 控制（默认 2g，够缓存全部制品很多个版本）。
#   * Github 改跳转目标主机时（例如新增 CDN 域名），补一条 proxy_redirect 与对应
#     location 即可；用 curl -IL 看 Location 就能发现。
#   * 只想要最稳、零外网：用 scripts/mirror-assets.mjs 做静态镜像，把 38.4 MB
#     整体上传即可（那条路径已端到端验证过）。
`

process.stdout.write(conf + notes)
if (out !== '') {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(out, conf + notes, 'utf8')
  console.error('[proxy-config] written: ' + out)
}
