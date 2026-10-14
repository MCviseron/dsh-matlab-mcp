/**
 * Toolkit skill catalog: parsing and selection.
 *
 * The MathWorks Agentic Toolkits ship one directory per skill
 * (`<group>/<skill-name>/SKILL.md` plus a `manifest.yaml`), which is the same
 * "directory bundle" shape DSH's own filesystem skill provider understands. We
 * read them ourselves instead of symlinking into `~/.dsh/skills` so the plugin
 * can filter by group/product and hot-refresh after a toolkit update.
 *
 * Pure helpers live here; the DSH `SkillProvider` wrapper is in
 * `./skills-provider.ts`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Frontmatter fields we consume from a toolkit `SKILL.md`. */
export interface SkillFrontmatter {
  name?: string
  description?: string
  whenToUse?: string
  license?: string
  version?: string
}

/** One discovered skill directory. */
export interface SkillEntry {
  name: string
  description: string
  whenToUse?: string
  group: string
  toolkit: 'matlab' | 'simulink'
  dir: string
  file: string
  /** `requires-products` from the sibling manifest.yaml (informational). */
  requiresProducts: string[]
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Whether a name satisfies DSH's kebab-case skill-name grammar. */
export function isKebabSkillName(name: string): boolean {
  return KEBAB.test(name) && name.length <= 64
}

/**
 * Parse a leading YAML frontmatter block. Deliberately minimal: toolkit skills
 * only use flat `key: value` scalars plus nested metadata, and a nested block is
 * skipped rather than mis-parsed.
 */
export function parseFrontmatter(text: string): { data: SkillFrontmatter; body: string } {
  const normalized = text.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) return { data: {}, body: normalized }
  const end = normalized.indexOf('\n---', 3)
  if (end < 0) return { data: {}, body: normalized }
  const block = normalized.slice(normalized.indexOf('\n', 3) + 1, end)
  const body = normalized.slice(normalized.indexOf('\n', end + 1) + 1)
  const data: Record<string, string> = {}
  for (const rawLine of block.split(/\r?\n/)) {
    if (/^\s/.test(rawLine)) continue // nested block (metadata:) — not needed
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(rawLine)
    if (match === null) continue
    const key = match[1]!
    let value = match[2]!.trim()
    if (value === '' || value === '|' || value === '>') continue
    value = value.replace(/^["']/, '').replace(/["']$/, '')
    data[key] = value
  }
  return {
    data: {
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.description === undefined ? {} : { description: data.description }),
      ...(data.whenToUse === undefined ? {} : { whenToUse: data.whenToUse }),
      ...(data.license === undefined ? {} : { license: data.license }),
      ...(data.version === undefined ? {} : { version: data.version }),
    },
    body,
  }
}

/** Read `requires-products` from a skill's sibling `manifest.yaml`. */
export function readRequiresProducts(manifestPath: string): string[] {
  if (!existsSync(manifestPath)) return []
  let text = ''
  try {
    text = readFileSync(manifestPath, 'utf8')
  } catch {
    return []
  }
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex(line => /^requires-products:\s*$/.test(line))
  if (start < 0) return []
  const products: string[] = []
  for (const line of lines.slice(start + 1)) {
    const match = /^\s+-\s+(.+?)\s*$/.exec(line)
    if (match === null) break
    products.push(match[1]!.replace(/^["']|["']$/g, ''))
  }
  return products
}

/** Skill groups that are enabled when the setting is left empty. */
export const DEFAULT_SKILL_GROUPS: readonly string[] = [
  'matlab-core',
  'matlab-programming',
  'matlab-software-development',
  'matlab-data-import-and-analysis',
  'model-based-design-core',
  'simulink-simulation',
]

/** The literal that turns every toolkit skill off. */
export const SKILL_GROUPS_NONE = 'none'

/** Resolve the effective group selection from the comma-separated setting. */
export function resolveSkillGroups(configured: readonly string[]): string[] {
  if (configured.length === 0) return [...DEFAULT_SKILL_GROUPS]
  if (configured.some(group => group.toLowerCase() === SKILL_GROUPS_NONE)) return []
  return [...configured]
}

/**
 * Discover every skill under one toolkit's `skills-catalog`, optionally
 * restricted to the enabled groups. Unreadable or malformed entries are skipped
 * (a toolkit update must never break the session catalog).
 */
export function listToolkitSkills(catalogRoot: string, toolkit: 'matlab' | 'simulink', groups?: readonly string[]): SkillEntry[] {
  if (!existsSync(catalogRoot)) return []
  const wanted = groups === undefined ? undefined : new Set(groups)
  const entries: SkillEntry[] = []
  for (const group of readdirSync(catalogRoot)) {
    if (wanted !== undefined && !wanted.has(group)) continue
    const groupDir = join(catalogRoot, group)
    try {
      if (!statSync(groupDir).isDirectory()) continue
    } catch {
      continue
    }
    for (const skill of readdirSync(groupDir)) {
      const dir = join(groupDir, skill)
      const file = join(dir, 'SKILL.md')
      if (!existsSync(file)) continue
      let parsed: { data: SkillFrontmatter; body: string }
      try {
        parsed = parseFrontmatter(readFileSync(file, 'utf8'))
      } catch {
        continue
      }
      const name = parsed.data.name ?? skill
      if (!isKebabSkillName(name)) continue
      if (typeof parsed.data.description !== 'string' || parsed.data.description.trim() === '') continue
      entries.push({
        name,
        description: parsed.data.description.trim(),
        ...(parsed.data.whenToUse === undefined ? {} : { whenToUse: parsed.data.whenToUse }),
        group,
        toolkit,
        dir,
        file,
        requiresProducts: readRequiresProducts(join(dir, 'manifest.yaml')),
      })
    }
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name))
}

/** Skill body with the frontmatter block removed. */
export function readSkillBody(file: string): string | undefined {
  try {
    return parseFrontmatter(readFileSync(file, 'utf8')).body.trim()
  } catch {
    return undefined
  }
}
