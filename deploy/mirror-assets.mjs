#!/usr/bin/env node
/**
 * Build a self-hosted mirror of the MathWorks artifacts this plugin needs.
 *
 * Run it on a machine with good connectivity, upload the produced directory to
 * your own server, and point the plugin's `downloadMirror` at it. Nothing else
 * is required: the tree mirrors the GitHub paths, so a single `{path}` template
 * covers every artifact.
 *
 *   node deploy/mirror-assets.mjs                       # writes ./mirror
 *   node deploy/mirror-assets.mjs --out D:\mirror --base-url https://dl.example.com/matlab-mirror
 *   node deploy/mirror-assets.mjs --via https://gh-proxy.com/{url}   # fetch through a mirror too
 *
 * Produced:
 *   <out>/matlab/...                     static tree (upload as-is)
 *   <out>/mirror.json                    path -> url/bytes/sha256 manifest
 *   <out>/nginx.conf.example             static + path-restricted cache snippet
 *   <out>/README.txt                     upload + verify checklist
 */
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const REPO = 'https://github.com'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = argv.indexOf('--' + name)
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback
}
const outDir = resolve(flag('out', 'mirror'))
const baseUrl = flag('base-url', 'https://你的域名/matlab-mirror')
const via = flag('via', '')
const asset = flag('asset', process.platform === 'darwin' ? 'matlab-mcp-server-macos-arm64' : process.platform === 'linux' ? 'matlab-mcp-server-linux-x64' : 'matlab-mcp-server-windows-x64.exe')

/** Every artifact the plugin may request, as (github url, local path) pairs. */
const ARTIFACTS = [
  { url: `${REPO}/matlab/matlab-mcp-server/releases/latest/download/${asset}` },
  { url: `${REPO}/matlab/matlab-mcp-server/releases/latest/download/MATLABMCPServerToolbox.mltbx` },
  { url: `${REPO}/matlab/matlab-agentic-toolkit/archive/refs/heads/main.zip` },
  { url: `${REPO}/matlab/simulink-agentic-toolkit/archive/refs/heads/main.zip` },
]

const log = (message) => { console.log('[mirror] ' + message) }

/** Apply the same `{url}` / `{path}` template rules the plugin uses. */
function applyTemplate(template, url) {
  if (template === '') return url
  const parsed = new URL(url)
  if (template.includes('{url}')) return template.replaceAll('{url}', url)
  if (template.includes('{path}')) {
    const value = template.includes('/{path}') ? parsed.pathname.replace(/^\//, '') + parsed.search : parsed.pathname + parsed.search
    return template.replaceAll('{path}', value)
  }
  return (template.endsWith('/') ? template : template + '/') + url
}

/** GitHub's URL layout maps 1:1 onto the mirror's directory layout. */
function localPathFor(url) {
  return join(outDir, new URL(url).pathname.replace(/^\//, ''))
}

async function download(url, target) {
  const source = applyTemplate(via, url)
  await mkdir(dirname(target), { recursive: true })
  const partial = target + '.partial'
  await rm(partial, { force: true })
  const started = Date.now()
  const response = await fetch(source, { redirect: 'follow', signal: AbortSignal.timeout(1_800_000) })
  if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText + ' for ' + source)
  if (response.body === null) throw new Error('empty body for ' + source)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
  const written = await stat(partial)
  if (written.size === 0) throw new Error('empty download for ' + source)
  await rm(target, { force: true })
  const { rename } = await import('node:fs/promises')
  await rename(partial, target)
  const seconds = Math.max(1, (Date.now() - started) / 1000)
  log(`${(written.size / 1048576).toFixed(1)} MB  ${(written.size / 1048576 / seconds).toFixed(2)} MB/s  ${source}`)
  return written.size
}

async function sha256(path) {
  const hash = createHash('sha256')
  const { createReadStream } = await import('node:fs')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

const NGINX = `# Self-hosted MATLAB mirror — add as its OWN file, e.g.
#   /etc/nginx/conf.d/matlab-mirror.conf   (or a site in 宝塔/1Panel)
# then: nginx -t && systemctl reload nginx     <- reload, never restart
#
# Static mode (recommended): the server only serves files, never calls GitHub.
server {
    listen 443 ssl;
    server_name 你的域名;                      # reuse an existing certificate
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # A dedicated prefix keeps this completely separate from your other services.
    location /matlab-mirror/ {
        alias ${outDir.replaceAll('\\', '/')}/;
        autoindex off;
        default_type application/octet-stream;   # .mltbx / .exe have no builtin type
        add_header Cache-Control "public, max-age=86400";
    }
}

# Optional (only if you would rather proxy GitHub live instead of hosting files).
# WARNING: never expose an unrestricted GitHub proxy — that becomes an open relay
# and gets abused. Restrict it to the exact prefix, methods and size below.
#
# location /github-proxy/ {
#     limit_except GET HEAD { deny all; }
#     client_max_body_size 1m;
#     proxy_pass https://github.com/;
#     proxy_cache matlab_mirror_cache;
#     proxy_cache_valid 200 206 30d;
#     proxy_cache_lock on;
#     proxy_set_header Range $http_range;
#     proxy_set_header If-Range $http_if_range;
# }
# proxy_cache_path /var/cache/nginx/matlab_mirror levels=1:2 keys_zone=matlab_mirror_cache:10m max_size=2g inactive=60d;
`

const README = `自建 MATLAB 制品镜像 — 使用说明
=================================

1) 上传
   把这个目录（含 matlab/ 子目录）整体上传到你的服务器，例如 /srv/matlab-mirror/。
   只上传需要的文件即可：
     matlab/matlab-mcp-server/releases/latest/download/*       官方 MCP 服务器 + 工具箱
     matlab/*-agentic-toolkit/archive/refs/heads/main.zip      两个技能仓

2) 让 web 服务提供它
   用仓库里的 nginx.conf.example（静态模式），放到独立配置文件里：
     nginx -t && systemctl reload nginx        # reload，不要 restart，不影响其它服务
   不需要新开端口；挂在现有域名的 /matlab-mirror/ 前缀或子域名即可。

3) 在插件里填这一行（DSH 设置 → MATLAB / Simulink MCP → 镜像列表）
   ${baseUrl}{path}
   多写几个用逗号分隔即按顺序回退，例如把自己的放第一位、公共镜像兜底。

4) 验证（在慢机器上执行）
   curl -I "${baseUrl}/matlab/matlab-mcp-server/releases/latest/download/${asset}"
   curl -I "${baseUrl}/matlab/simulink-agentic-toolkit/archive/refs/heads/main.zip"
   期望 200（或带 Range 时 206）、Content-Length 与 mirror.json 里的 bytes 一致。
   插件内也有「一键安装 / 修复」和「镜像测速」可以直接验证。

5) 校验完整性（可选但推荐）
   mirror.json 记录了每个文件的 sha256；服务器上传后可在服务器上核对：
     sha256sum matlab/matlab-mcp-server/releases/latest/download/${asset}

6) 注意
   - 静态模式不会让服务器访问外网，也不占用额外端口，对现有服务无影响。
   - 若改做反向代理，务必按 nginx.conf.example 里注释的范围收紧：
     仅 GET/HEAD、仅 /matlab/ 前缀、限制体积；开放代理会被滥用并可能连累你的 IP。
   - 更新制品：重跑 deploy/mirror-assets.mjs，重新上传覆盖即可。
`

log('输出目录 / output: ' + outDir)
if (via !== '') log('取制品经过 / fetching via: ' + via)
else log('取制品直连 GitHub / fetching directly from GitHub')

const manifest = { generatedAt: new Date().toISOString(), baseUrl, asset, via: via === '' ? null : via, files: [] }
for (const entry of ARTIFACTS) {
  const target = localPathFor(entry.url)
  if (existsSync(target) && flag('force', '') === '') {
    const size = (await stat(target)).size
    log('已存在，跳过 / present, skipping: ' + target.replace(outDir, ''))
    manifest.files.push({ url: entry.url, path: target.replace(outDir, '').replaceAll('\\', '/'), bytes: size, sha256: await sha256(target) })
    continue
  }
  try {
    const bytes = await download(entry.url, target)
    manifest.files.push({ url: entry.url, path: target.replace(outDir, '').replaceAll('\\', '/'), bytes, sha256: await sha256(target) })
  } catch (error) {
    log('失败 / FAILED: ' + entry.url + ' -> ' + (error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  }
}

await writeFile(join(outDir, 'mirror.json'), JSON.stringify(manifest, undefined, 2) + '\n', 'utf8')
await writeFile(join(outDir, 'nginx.conf.example'), NGINX, 'utf8')
await writeFile(join(outDir, 'README.txt'), README, 'utf8')

const total = manifest.files.reduce((sum, file) => sum + file.bytes, 0)
log('')
log('完成 / done: ' + manifest.files.length + ' 个文件，合计 ' + (total / 1048576).toFixed(1) + ' MB')
log('插件镜像列表填 / paste into the plugin mirror list:')
log('  ' + baseUrl + '{path}')
log('（先上传 ' + outDir + ' 到服务器；详见 ' + join(outDir, 'README.txt') + '）')
