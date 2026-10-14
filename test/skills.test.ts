/**
 * Toolkit skill catalog test: frontmatter parsing, group selection and the
 * end-to-end discovery over a temporary skill tree.
 *
 * `node --experimental-strip-types test/skills.test.ts`
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_SKILL_GROUPS,
  isKebabSkillName,
  listToolkitSkills,
  parseFrontmatter,
  readRequiresProducts,
  readSkillBody,
  resolveSkillGroups,
} from '../src/skills-catalog.ts'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) console.log(`     got      ${JSON.stringify(actual)}\n     expected ${JSON.stringify(expected)}`)
}

const sample = [
  '---',
  'name: matlab-debug-code',
  'description: Diagnose MATLAB errors. Use when a script fails.',
  'license: https://www.mathworks.com/license',
  'metadata:',
  '  author: MathWorks',
  '  version: "1.1"',
  '---',
  '',
  '# Debug',
  '',
  'Body line one.',
].join('\n')

const parsed = parseFrontmatter(sample)
check('frontmatter name is parsed', parsed.data.name, 'matlab-debug-code')
check('description is parsed', parsed.data.description, 'Diagnose MATLAB errors. Use when a script fails.')
check('license is parsed', parsed.data.license, 'https://www.mathworks.com/license')
check('nested metadata is not mis-parsed as a scalar', parsed.data.version, undefined)
check('body keeps the content after the fence', parsed.body.trim().startsWith('# Debug'), true)
check('a file without frontmatter is all body', parseFrontmatter('# plain').body, '# plain')

check('kebab names are accepted', isKebabSkillName('matlab-debug-code'), true)
check('camelCase names are rejected', isKebabSkillName('matlabDebugCode'), false)
check('underscores are rejected', isKebabSkillName('matlab_debug'), false)

check('no configured groups means the default set', resolveSkillGroups([]), [...DEFAULT_SKILL_GROUPS])
check('explicit groups win', resolveSkillGroups(['matlab-core']), ['matlab-core'])
check('the none literal disables every group', resolveSkillGroups(['none']), [])
check('the default set covers MATLAB core', DEFAULT_SKILL_GROUPS.includes('matlab-core'), true)

const root = mkdtempSync(join(tmpdir(), 'matlab-mcp-skills-'))
mkdirSync(join(root, 'matlab-core', 'matlab-review-code'), { recursive: true })
mkdirSync(join(root, 'rf-and-mixed-signal', 'matlab-rf-budget'), { recursive: true })
mkdirSync(join(root, 'matlab-core', 'NotKebab'), { recursive: true })
writeFileSync(join(root, 'matlab-core', 'matlab-review-code', 'SKILL.md'), sample.replace('matlab-debug-code', 'matlab-review-code'))
writeFileSync(join(root, 'matlab-core', 'matlab-review-code', 'manifest.yaml'), 'requires-products:\n  - MATLAB\n  - Simulink Test\n')
writeFileSync(join(root, 'rf-and-mixed-signal', 'matlab-rf-budget', 'SKILL.md'), '---\nname: matlab-rf-budget\ndescription: RF budget analysis.\n---\nbody')
writeFileSync(join(root, 'matlab-core', 'NotKebab', 'SKILL.md'), '---\nname: NotKebab\ndescription: invalid.\n---\nbody')

const all = listToolkitSkills(root, 'matlab')
check('only valid skills are discovered', all.map(entry => entry.name), ['matlab-review-code', 'matlab-rf-budget'])
check('group filtering excludes other groups', listToolkitSkills(root, 'matlab', ['matlab-core']).map(entry => entry.name), ['matlab-review-code'])
check('requires-products is read from the sibling manifest', listToolkitSkills(root, 'matlab', ['matlab-core'])[0]?.requiresProducts, ['MATLAB', 'Simulink Test'])
check('a missing catalog is empty, not a throw', listToolkitSkills(join(root, 'nope'), 'simulink'), [])
check('readSkillBody strips the frontmatter', readSkillBody(join(root, 'matlab-core', 'matlab-review-code', 'SKILL.md'))?.startsWith('# Debug'), true)
check('readRequiresProducts tolerates a missing file', readRequiresProducts(join(root, 'nope.yaml')), [])

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
