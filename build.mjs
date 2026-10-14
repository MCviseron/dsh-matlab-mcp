import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * The host bundle is **fully self-contained**: every runtime import is inlined
 * so a `git clone` + profile link works with no `pnpm install` in the plugin
 * directory. That is deliberate — DSH links the plugin by path, so it never
 * installs the plugin's dependencies for it, and a missing `node_modules` used
 * to surface as `dsh-matlab-mcp: failed to import`.
 *
 * The DSH seams themselves are type-only imports (erased) or objects the host
 * injects at runtime (`ctx`), so nothing needs to stay external for identity:
 * the sibling plugin already runs its `@deepseek-ai/*` copies from its own
 * `node_modules`, i.e. a separate copy from the host's is the normal case.
 */
const selfContained = []

/**
 * CJS dependencies inlined into the ESM bundle (the MCP SDK pulls `cross-spawn`)
 * call `require()` at module scope. esbuild rewrites those into a `__require`
 * shim that throws `Dynamic require of "child_process" is not supported` unless
 * a `require` binding exists — verified failing inside the DSH host process,
 * which is exactly what surfaced as `dsh-matlab-mcp: failed to import`.
 * The banner restores the CJS globals in terms of `import.meta.url`.
 */
const cjsGlobals = [
  "import { createRequire as __dshCreateRequire } from 'node:module';",
  "import { fileURLToPath as __dshFileURLToPath } from 'node:url';",
  "import { dirname as __dshDirname } from 'node:path';",
  'const require = __dshCreateRequire(import.meta.url);',
  'const __filename = __dshFileURLToPath(import.meta.url);',
  'const __dirname = __dshDirname(__filename);',
].join('\n')

await mkdir('lib', { recursive: true })

// Host half: one ESM bundle, dependencies inlined, built output committed so a
// fresh clone is loadable as-is.
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: selfContained,
  banner: { js: cjsGlobals },
  sourcemap: false,
  logLevel: 'info',
})

// Browser half: bundle as CommonJS, then wrap it in the DSH module-loader
// format the Web shell executes. External runtime modules are provided by the
// shell's require(), exactly like the official dsh-* client bundles.
const client = await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-locale/client',
    '@deepseek-ai/dsh-client-ui-settings/client',
    '@deepseek-ai/dsh-client-ui-renderer/client',
    '@deepseek-ai/dsh-client-connection/client',
  ],
  sourcemap: false,
  write: false,
  logLevel: 'info',
})

let code = client.outputFiles[0]?.text ?? ''
const useStrict = code.startsWith('"use strict";\n') ? '"use strict";\n' : code.startsWith("'use strict';\n") ? "'use strict';\n" : ''
if (useStrict !== '') code = code.slice(useStrict.length)
const wrapped = [
  'window.__ModuleLoader__.load({',
  '  id: "dsh-matlab-mcp",',
  '  factory: (require) => {',
  useStrict,
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  code,
  '    return module.exports;',
  '  }',
  '});',
  '',
].filter(line => line !== '').join('\n')

await writeFile('lib/client.js', wrapped, 'utf8')

console.log('built lib/index.js and lib/client.js')
