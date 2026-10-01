#!/usr/bin/env node
// plan-lint (E357, decision 92): the mechanical checks on the GAME-NORMALIZATION v2 plan, so the review council spends
// its attention on judgment, not typos. Runs after every council fix; exit 1 on any violation.
//
//   node scripts/plan-lint.mjs            the report + exit code
//   node scripts/plan-lint.mjs --quiet    counts only
//
// Checks: (1) vague words; (2) every decision in E357.md is traced in 00-traceability; (3) names the council's
// resolutions retired; (4) every src/ path in an old folder exists today; (5) relative links resolve; (6) every row of
// the index has a spec that names it.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const PLAN_DIR = join(ROOT, 'docs/plans/game-normalization');
const INDEX = join(ROOT, 'docs/plans/GAME-NORMALIZATION.md');
const ASK = join(ROOT, 'docs/tasks/asks/E357.md');
const quiet = process.argv.includes('--quiet');

const files = [INDEX, ...readdirSync(PLAN_DIR).filter((f) => f.endsWith('.md')).map((f) => join(PLAN_DIR, f))];
const rel = (p) => p.slice(ROOT.length + 1);
const violations = [];
const add = (check, file, line, text) => { violations.push({ check, where: `${rel(file)}:${line}`, text }); };

// (1) vague words: outside backticks and double quotes (a quote of the rule itself is not a violation)
const VAGUE = [/\betc\b\.?/i, /\bTBD\b/, /\bas needed\b/i, /\band so on\b/i, /\bvarious\b/i];
// (3) retired names → the resolution that retired them
const RETIRED = [
  [/boot\.phone\.barrier/, 'boot.barrier (13 05/06#2)'],
  [/\bdeploy\/pin\b/, '.github/deploy-pin.json (13 G7)'],
  [/gpt-6-sol/, 'GPT 6.1 Sol (decision 90′)'],
  [/\bmapDraw\b/, 'minimap (13 05/06#1)'],
  [/style:\s*'lowpoly'/, "style: 'toon' (13 02/03#1)"],
  [/30 Hz near, 15 Hz/, 'decision 85 (AI: 20 Hz near, 10 Hz mid, paused far)'],
  [/\bspeciesTuning\b/, 'faunaTuning (13 07/08#1)'],
  [/boar, bear,? and horse/, 'the horse is Nalati\'s (13 09#5)'],
  // council round 1 / round 2 renames and retirements (R1-01, R1-24, R2-08, R2-10)
  [/\bShardRender\b/, 'LookStrategy (R1-01)'],
  [/\bShardComposeContext\b/, 'LookComposeContext (R1-01)'],
  [/\bshard\.(data|world|kit|play|loaded|unloaded)\b/, 'level.* stages / events (R1-01)'],
  [/\bapp\.shard\b/, 'game.shard (R1-01)'],
  [/\binstall\(ctx\)/, 'the staged hooks world(ctx) / kit(ctx) / play(ctx) (R1-24)'],
  [/\{ ?allowed, toggle ?\}/, '{ allowed, latched } (R1-F9 / R2-08)'],
  [/model\.bolt/, 'the bolt base formula (R1-31 / R2-10)'],
  [/manifest\.map\./, 'manifest.minimap (13 05/06#1)'],
  [/(manifest|level)\.world\.blender/, 'blender.area / blender.models (R2-02)'],
];
// a quote of Jake runs *"…"* and can wrap lines: everything after an opening *" is his words, not the plan's
const strip = (line) => line.replace(/\*"[^]*$/, '').replaceAll(/`[^`]*`/g, '').replaceAll(/"[^"]*"/g, '');
// a line that names a retired term to say it's retired / renamed is not a use of it
const NAMES_RETIREMENT = /renamed|\(was |was `|retired|Resolved|→ 13/;

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let inQuote = false;   // inside a quote of Jake that wraps lines: *"… (next line) …"*
  const isRecord = ['13-lead-resolutions.md', '00-traceability.md'].some((name) => f.endsWith(name));
  lines.forEach((raw, i) => {
    const opens = raw.includes('*"'), closes = raw.includes('"*');
    const plain = inQuote && !opens ? '' : strip(raw);
    if (opens && !closes) inQuote = true; else if (closes) inQuote = false;
    for (const re of VAGUE) if (re.test(plain)) add('vague', f, i + 1, raw.trim().slice(0, 140));
    // the resolution record and the traceability matrix name retired terms on purpose (to say they're retired)
    if (!isRecord && !NAMES_RETIREMENT.test(raw)) for (const [re, why] of RETIRED) if (re.test(raw)) add('retired', f, i + 1, `→ ${why}: ${raw.trim().slice(0, 110)}`);
    // (4) src/ paths in old folders must exist today (new-layer paths are the plan's future)
    for (const m of raw.matchAll(/`(src\/[^`\s:*]+?)(?::[\d-]+)?`/g)) {
      const p = m[1].replace(/[.,;)]+$/, '');
      if (/^src\/(engine|game|kit|shards|entry\.ts)/.test(p)) continue;
      if (!/\.[a-z]+$|\/$/.test(p) || /[{<]/.test(p)) continue;   // brace sets and <slug> placeholders
      if (!existsSync(join(ROOT, p)) && !/\bnew\b|creat|\badds?\b/i.test(raw)) add('path', f, i + 1, p);
    }
    // (5) relative markdown links
    for (const m of raw.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^[a-z]+:/.test(target)) continue;
      if (!existsSync(resolve(dirname(f), target))) add('link', f, i + 1, target);
    }
  });
}

// (2) every decision id in E357's table is traced
const askLines = readFileSync(ASK, 'utf8').split('\n');
const decisionIds = askLines.map((l) => /^\| (\d+′?) \|/.exec(l)?.[1]).filter((x) => x !== undefined);
const trace = readFileSync(join(PLAN_DIR, '00-traceability.md'), 'utf8');
for (const id of new Set(decisionIds)) {
  const re = new RegExp(String.raw`\|\s*(?:D|DEC-)?${id}\s*\|`);
  if (!re.test(trace)) add('decision', join(PLAN_DIR, '00-traceability.md'), 0, `decision ${id} is not a row of the matrix`);
}

// (6) every index row id is named by at least one spec file
const index = readFileSync(INDEX, 'utf8');
const rowIds = new Set([...index.matchAll(/^\| \*?\*?((?:F\d+(?:\.\d)?)|(?:S\d\.\d)|(?:M\d)|(?:X\d)|(?:Z\d))\*?\*? \|/gm)].map((m) => m[1]));
const specs = files.filter((f) => f !== INDEX).map((f) => readFileSync(f, 'utf8')).join('\n');
for (const id of rowIds) if (!new RegExp(String.raw`\b${id.replace('.', String.raw`\.`)}\b`).test(specs)) add('row', INDEX, 0, `${id} has no spec that names it`);

const byCheck = {};
for (const v of violations) byCheck[v.check] = (byCheck[v.check] ?? 0) + 1;
if (!quiet) for (const v of violations) console.log(`${v.check.padEnd(9)} ${v.where}  ${v.text}`);
console.log(`plan-lint: ${violations.length} violation(s) ${JSON.stringify(byCheck)} across ${files.length} files, ${new Set(decisionIds).size} decisions, ${rowIds.size} rows`);
process.exit(violations.length === 0 ? 0 : 1);
