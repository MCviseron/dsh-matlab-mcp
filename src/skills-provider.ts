/**
 * DSH skill provider over the two MathWorks Agentic Toolkits.
 *
 * Registered on `ctx.skills`, so the toolkit skills appear in the same catalog
 * as local/project skills and load on demand through DSH's own `skill` tool.
 * The provider is read-through: discovery parses frontmatter, every load re-reads
 * the file, and an explicit `invalidate()` (after a toolkit sync or a settings
 * change) drops the discovery cache.
 */
import type { SkillCandidate, SkillDefinition, SkillLookupOptions, SkillProvider, SkillProviderControl } from '@deepseek-ai/dsh-skill'
import { join } from 'node:path'
import { toolkitDirs } from './paths.ts'
import { listToolkitSkills, readSkillBody, type SkillEntry } from './skills-catalog.ts'

/** Provider name registered on `ctx.skills`. */
export const TOOLKIT_SKILL_PROVIDER = 'matlab-agentic-toolkit'

/**
 * Precedence rank. DSH's filesystem provider ranks project skills 100,
 * `customSkillDirs` 300, the user root 400 and the bundled root 600; a user's own
 * skill must therefore beat this provider, which in turn beats nothing else.
 */
const TOOLKIT_SKILL_RANK = 500

export interface ToolkitSkillProviderOptions {
  control: SkillProviderControl
  /** Enabled toolkit group names (already resolved from the setting). */
  getGroups: () => string[]
  /** Optional diagnostics sink (the Host logger is not always reachable). */
  log?: (message: string) => void
}

function catalogs(): Array<{ toolkit: 'matlab' | 'simulink'; root: string }> {
  const dirs = toolkitDirs()
  return [
    { toolkit: 'matlab', root: join(dirs.matlab, 'skills-catalog') },
    { toolkit: 'simulink', root: join(dirs.simulink, 'skills-catalog') },
  ]
}

/** Build the provider registered on `ctx.skills`. */
export function createToolkitSkillProvider(options: ToolkitSkillProviderOptions): SkillProvider {
  let cache: { key: string; entries: SkillEntry[] } | undefined

  const discover = (): SkillEntry[] => {
    const groups = options.getGroups()
    const key = [...groups].sort().join(',')
    if (cache !== undefined && cache.key === key) return cache.entries
    const entries: SkillEntry[] = []
    for (const catalog of catalogs()) entries.push(...listToolkitSkills(catalog.root, catalog.toolkit, groups))
    cache = { key, entries }
    options.log?.('toolkit skills discovered: ' + entries.length + ' (groups: ' + (key === '' ? 'none' : key) + ')')
    return entries
  }

  return {
    name: TOOLKIT_SKILL_PROVIDER,
    list: async (_lookup: SkillLookupOptions): Promise<SkillCandidate[]> => discover().map(entry => ({
      name: entry.name,
      description: entry.description,
      ...(entry.whenToUse === undefined ? {} : { whenToUse: entry.whenToUse }),
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'custom',
      provider: TOOLKIT_SKILL_PROVIDER,
      rank: TOOLKIT_SKILL_RANK,
      locator: entry,
      path: entry.file,
      resourceBase: { kind: 'directory', path: entry.dir },
      metadata: { group: entry.group, toolkit: entry.toolkit, requiresProducts: entry.requiresProducts },
    })),
    get: async (candidate: SkillCandidate, _lookup: SkillLookupOptions): Promise<SkillDefinition | undefined> => {
      const entry = candidate.locator as SkillEntry | undefined
      if (entry === undefined || typeof entry.file !== 'string') return undefined
      const content = readSkillBody(entry.file)
      if (content === undefined) return undefined
      return {
        name: candidate.name,
        description: candidate.description,
        ...(candidate.whenToUse === undefined ? {} : { whenToUse: candidate.whenToUse }),
        invocation: candidate.invocation,
        source: candidate.source,
        provider: candidate.provider,
        content,
        path: entry.file,
        resourceBase: { kind: 'directory', path: entry.dir },
        metadata: { group: entry.group, toolkit: entry.toolkit, requiresProducts: entry.requiresProducts },
      }
    },
  }
}
