#!/usr/bin/env node
/**
 * Backfill the "automation tasks may release on their own" rule into DSH
 * schedule prompts.
 *
 * Why: several plugin repositories run a weekly "check DSH for updates" task.
 * Those tasks were often written with a human-conversation assumption
 * ("commit locally, do not push/tag — wait for me"), which makes the weekly run
 * stop at "report only" instead of actually shipping the update. Interactive
 * sessions still need that guard; scheduled tasks do not.
 *
 * The rule is appended, never rewriting the task's own technical steps, so it is
 * safe to run repeatedly (it skips prompts that already contain it).
 *
 *   node scripts/fix-schedule-autonomy.mjs            # audit only
 *   node scripts/fix-schedule-autonomy.mjs --apply    # write (with backup)
 *   node scripts/fix-schedule-autonomy.mjs --match email-notify --apply
 *   node scripts/fix-schedule-autonomy.mjs --all-tasks --apply   # even non-weekly ones
 *   node scripts/fix-schedule-autonomy.mjs --store <path>
 *
 * Requires write access to <DSH_HOME>/storages/schedule.json. The running DSH
 * keeps an in-memory copy, so a restart is needed for the new prompt to load.
 */
import { copyFile, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const has = (flag) => argv.includes('--' + flag)
const flag = (name, fallback) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

const apply = has('apply')
const match = flag('match', '')
const allTasks = has('all-tasks')
const store = flag('store', join(homedir(), '.dsh', 'storages', 'schedule.json'))

/** Marker used both to detect the rule and to keep runs idempotent. */
const MARKER = '## 自动化发版授权（统一规则）'
const RULE = [
  '',
  '',
  MARKER,
  '',
  '- 你是**定时自动化任务**，不是人类对话：允许你自行决定版本号、bump、`git commit`、`git push`、打 tag、触发 CI 发布。',
  '- 人类在**对话**里说过的「先不要发版 / 等我确认」**不适用于定时任务**；只有当人类把限制明确写进本任务的 prompt 时才需要等待。',
  '- 你的目标是**把更新做完并发布**（检查 → 适配 → 发版 → 报告），不是只出报告。',
  '- 版本号遵循 `vX.Y.Z`：依赖/兼容性对齐 → patch；新增能力或明显行为改进 → minor；破坏性变更 → major。',
  '- 发版前必须：更新 CHANGELOG、`package.json` 版本与 tag 一致、构建与类型检查全绿。',
  '- 发布失败（账号冻结 / 403 / 2FA / staged）**不要反复重试**：回退该 tag，记录「待补发」（如仓库里的 `docs/release-pending.md`），在报告里写明。',
  '- 唯一需要停下来问人类的情况：宿主 API 发生破坏性变更、必须改功能代码。',
].join('\n')

/** Task looks like a periodic plugin/DSH check. */
const isCheckTask = (title, prompt) => /周检|巡检|版本.*检查|更新与兼容性|兼容性/.test(String(title) + String(prompt))

/**
 * The rule already present, in any of the wordings real tasks use. Detection is
 * deliberately generous: appending a duplicate block is noise, while missing an
 * existing one and appending twice is worse for the reader.
 */
const RULE_FINGERPRINTS = [
  /## 自动化发版授权/,
  /允许你自行[^\n]{0,24}(bump|版本)/,
  /允许[^\n]{0,80}(打 ?tag|推送版本 ?tag|发版|npm 发布|publish)/,
  /自行决定版本号/,
]
const alreadyHasRule = (prompt) => RULE_FINGERPRINTS.some((re) => re.test(prompt))

const raw = await readFile(store, 'utf8')
const pretty = raw.includes('\n')
const doc = JSON.parse(raw)
const table = doc.tables?.tasks
if (table === undefined) {
  console.error('✗ 存储里没有 tables.tasks：' + store)
  process.exit(1)
}
const rows = Array.isArray(table) ? table : Object.values(table)
const before = await stat(store)

let changed = 0
let skipped = 0
const report = []
for (const row of rows) {
  const record = row?.record
  if (record === undefined) continue
  const title = String(record.title ?? '')
  const prompt = String(record.prompt ?? '')
  if (match !== '' && !(title + prompt).includes(match)) continue
  if (!allTasks && !isCheckTask(title, prompt)) continue
  if (alreadyHasRule(prompt)) { skipped += 1; report.push('  · 已有规则，跳过  ' + title.slice(0, 46)); continue }
  report.push('  ' + (apply ? '✓ 追加规则  ' : '→ 需要追加  ') + title.slice(0, 46) + '  (' + record.id + ')')
  if (apply) { record.prompt = prompt + RULE; changed += 1 }
}

console.log('存储: ' + store + '  (' + before.size + ' B)')
console.log('任务总数: ' + rows.length + ' | 命中检查任务: ' + report.length + (match === '' ? '' : ' | 过滤: ' + match))
console.log(report.join('\n') || '  （没有需要处理的任务）')

if (!apply) {
  console.log('\n[audit] 未写入。加 --apply 执行（会先备份）。')
  process.exit(0)
}
if (changed === 0) {
  console.log('\n没有需要写入的任务。')
  process.exit(0)
}

const backup = store + '.bak-autonomy-' + new Date().toISOString().replace(/[:.]/g, '-')
await copyFile(store, backup)
const out = JSON.stringify(doc, undefined, pretty ? 2 : undefined)
JSON.parse(out)
const tmp = store + '.tmp'
await writeFile(tmp, out, 'utf8')
await rename(tmp, store)

const verify = JSON.parse(await readFile(store, 'utf8'))
const verifyRows = Array.isArray(verify.tables.tasks) ? verify.tables.tasks : Object.values(verify.tables.tasks)
const withRule = verifyRows.filter((r) => String(r?.record?.prompt ?? '').includes(MARKER)).length
console.log('\n已写入 ' + changed + ' 个任务（备份: ' + backup + '）')
console.log('复核：含该规则的任务 ' + withRule + ' / ' + verifyRows.length + ' 个')
console.log('\n⚠ 运行中的 DSH 仍持有内存副本：**重启 DSH** 后新 prompt 才会生效。')
