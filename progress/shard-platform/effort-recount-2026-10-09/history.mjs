// Re-measure every shard at historical commits with TODAY's metric (scripts/shard-platform.mjs copy), from git archive exports.
import { shardLines, milestoneFlags } from './sp-files.mjs';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
const REPO = '/Users/raynos/projects/games/wildshard-singleplayer';
const SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad';
const OUT = `${SP}/history.json`;
const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const done = new Set(results.map((r) => r.sha));
const start = Date.parse('2026-10-04T07:00:00Z'), end = Date.now(), step = 3 * 3600e3;
const times = [];
for (let t = start; t < end; t += step) times.push(t);
times.push(end);
for (const t of times) {
  const iso = new Date(t).toISOString();
  const sha = execSync(`git -C ${REPO} rev-list -1 --first-parent --before=${iso} main`).toString().trim();
  if (done.has(sha)) { results.push({ ...results.find((r) => r.sha === sha), t: iso }); continue; }
  const dir = `${SP}/export`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execSync(`git -C ${REPO} archive ${sha} src test/proof lint | tar -x -C ${dir}`, { maxBuffer: 1 << 30 });
  globalThis.PF = [];
  let lines;
  try { lines = shardLines(dir); } catch (e) { console.log(iso, sha, 'ERR', String(e).slice(0, 200)); continue; }
  const row = { t: iso, sha, shards: {} };
  for (const [slug, l] of Object.entries(lines)) {
    let m = null;
    try { m = milestoneFlags(slug, l, dir); } catch { m = null; }
    row.shards[slug] = { pub: l.publicLines, cus: l.customLines, rt: l.runtimeLines, share: l.publicShare, m };
  }
  results.push(row); done.add(sha);
  console.log(iso, sha, Object.entries(row.shards).map(([s, r]) => `${s.slice(0, 6)}=${(r.share * 100).toFixed(1)}`).join(' '));
  writeFileSync(OUT, JSON.stringify(results));
}
rmSync(`${SP}/export`, { recursive: true, force: true });
writeFileSync(OUT, JSON.stringify(results));
