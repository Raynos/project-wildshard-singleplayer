// The marketing site's build (MARKETING-SITE MS4, E465): its own root, its own public/, its own output. Nothing from
// the game's src/ or vite plugins: the sites share the repo, not a bundle (as drafts/, J15).
//   pnpm build:site   → dist-site/
// Every word on the page comes from site/COPY.md (site/tools/copy.ts fills the {{…}} slots; Jake edits that file).
// It emits /version.json (site/tools/deploy.sh reads it back) and fills the page's generated blocks from the build, so
// they can't drift from the plans and the game:
//   <!--gen:road-->       the road strip, from SHARD-PLATFORM's State line at the built commit (MS6)
//   <!--gen:devlog-->     site/devlog.json plus every commit with a `Devlog: <sentence>` line (MS14)
//   <!--gen:shardfile-->  the template's real shard.json, fetched from the live game (MS15)
//   <!--gen:media-->      site/media.json: the trailer and shard loops on Blob (MS11, site/tools/publish-media.ts)
// deploy.sh builds a clean export (no .git), so it passes SITE_REPO and SITE_BUILD_SHA; a local build uses this checkout.
import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillCopy, inline, parseCopy, unusedCopy } from './tools/copy.ts';

const root = import.meta.dirname;
const GAME = 'https://wildshard-singleplayer.vercel.app';

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}
const repo = process.env.SITE_REPO ?? git(root, ['rev-parse', '--show-toplevel']).trim();
const sha = process.env.SITE_BUILD_SHA ?? git(repo, ['rev-parse', '--short', 'HEAD']).trim();
const BUILD = `${sha}-${Date.now().toString(36)}`;

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** a file as it is at the built commit, or null when it isn't there */
function atBuild(path: string): string | null {
  try { return git(repo, ['show', `${sha}:${path}`]); } catch { return null; }
}

// ---- MS6 · the road ------------------------------------------------------------------------------------------------
type RoadState = 'done' | 'now' | 'next';
interface RoadItem { readonly label: string; readonly state: RoadState; readonly note: string }
/** a COPY.md entry by heading (marks it used) */
type Words = (name: string) => string;

export function roadFrom(plan: string | null, archived: boolean, planned: (name: string) => boolean, words: Words): RoadItem[] {
  let m1 = 100, m2 = 100, ready = 7, total = 7;
  if (!archived) {
    const state = plan?.split('\n').find((l) => l.startsWith('**State:**')) ?? '';
    const pct = /M1 ≈ (\d+) %, M2 ≈ (\d+) %/u.exec(state);
    const share = /shards at 80\/20: (\d+) of (\d+)/u.exec(state);
    if (!pct || !share) throw new Error('site road: SHARD-PLATFORM\'s State line no longer says "M1 ≈ n %, M2 ≈ n %" and "shards at 80/20: n of m"; update roadFrom');
    m1 = Number(pct[1]); m2 = Number(pct[2]); ready = Number(share[1]); total = Number(share[2]);
  }
  const by = (pct: number): RoadState => (pct >= 100 ? 'done' : 'now');
  const plannedWord = words('Road · planned');
  const later = (planName: string, name: string): RoadItem => ({ label: words(name), state: planned(planName) ? 'now' : 'next', note: planned(planName) ? plannedWord : '' });
  const progress = words('Road · data progress').replaceAll('{ready}', String(ready)).replaceAll('{total}', String(total));
  return [
    { label: words('Road · seven shards'), state: 'done', note: '' },
    { label: words('Road · shard package'), state: by(m1), note: m1 >= 100 ? '' : `${m1} %` },
    { label: words('Road · the grid'), state: by(m2), note: m2 >= 100 ? '' : `${m2} %` },
    { label: words('Road · every shard as data'), state: ready >= total ? 'done' : 'now', note: ready >= total ? '' : progress },
    later('MULTIPLAYER', 'Road · multiplayer'),
    later('UPLOAD', 'Road · upload'),
    later('MMO', 'Road · the 25-shard world'),
  ];
}

function roadHtml(words: Words): string {
  const plan = atBuild('docs/plans/SHARD-PLATFORM.md');
  const archive = git(repo, ['ls-tree', '--name-only', sha, 'project/archive/']);
  const archived = plan === null && /SHARD-PLATFORM/iu.test(archive);
  if (plan === null && !archived) throw new Error('site road: docs/plans/SHARD-PLATFORM.md is missing and not archived');
  const plans = git(repo, ['ls-tree', '--name-only', sha, 'docs/plans/']);
  const planned = (key: string): boolean => new RegExp(`docs/plans/${key}[^/]*\\.md`, 'u').test(plans);
  return roadFrom(plan, archived, planned, words)
    .map((i) => `<li class="${i.state}">${inline(i.label)}${i.note ? ` <span class="pct">${esc(i.note)}</span>` : ''}</li>`).join('');
}

// ---- MS14 · the devlog ---------------------------------------------------------------------------------------------
interface Entry { readonly date: string; readonly text: string; readonly sha: string }

/** a JSON object's own fields, or null when it isn't an object */
function fields(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
}

function toEntry(v: unknown): Entry[] {
  const { date, text, sha: s } = fields(v) ?? {};
  return typeof date === 'string' && typeof text === 'string' && typeof s === 'string' ? [{ date, text, sha: s }] : [];
}

function devlogHtml(): string {
  const seed: unknown = JSON.parse(readFileSync(join(root, 'devlog.json'), 'utf8'));
  const { entries } = fields(seed) ?? {};
  const base: Entry[] = Array.isArray(entries) ? entries.flatMap(toEntry) : [];
  // any `Devlog:` line in a commit body counts, trailer block or not (a co-author block after it hides a git trailer)
  const log = git(repo, ['log', sha, '-n', '4000', '--grep=^Devlog: ', '--format=%h%x1f%cs%x1f%B%x1d']);
  const fresh: Entry[] = log.split('\u001D').flatMap((rec) => {
    const [h = '', date = '', body = ''] = rec.trim().split('\u001F');
    return body.split('\n').filter((l) => l.startsWith('Devlog: ')).map((l) => l.slice('Devlog: '.length).trim()).filter((t) => t !== '').map((text) => ({ date, text, sha: h }));
  });
  const all: Entry[] = [...fresh, ...base.filter((b) => !fresh.some((f) => f.sha === b.sha))].sort((a, b) => b.date.localeCompare(a.date));
  const day = (d: string): string => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return all.slice(0, 6).map((e) => `<li><time datetime="${esc(e.date)}">${esc(day(e.date))}</time><p>${esc(e.text)}</p></li>`).join('');
}

// ---- MS15 · the shardfile peek -------------------------------------------------------------------------------------
async function shardfileHtml(): Promise<string> {
  const res = await fetch(`${GAME}/shardfiles/_template/shard.json`);
  if (!res.ok) throw new Error(`site shardfile: ${GAME}/shardfiles/_template/shard.json answered ${res.status}`);
  const f = fields(await res.json());
  if (f === null) throw new Error('site shardfile: not a JSON object');
  const { version, identity, requires, authorCaps, serverBudget, runtime } = f;
  const { sdk } = fields(requires) ?? {};
  const pick = { version, identity, requires: { sdk }, authorCaps, serverBudget, runtime: runtime ?? null };
  for (const [k, v] of Object.entries(pick)) if (v === undefined) throw new Error(`site shardfile: the template's shard.json has no ${k}`);
  const k = (s: string): string => `<span class="k">"${esc(s)}"</span>`;
  const val = (v: unknown): string => (typeof v === 'string' ? `<span class="s">"${esc(v)}"</span>` : esc(JSON.stringify(v)));
  // a phone is ~40 mono characters wide: nested objects of three or more fields go one per line
  const obj = (o: unknown): string => {
    if (typeof o !== 'object' || o === null) return val(o);
    const parts = Object.entries(o).map(([a, b]) => `${k(a)}: ${val(b)}`);
    return parts.length < 3 ? `{ ${parts.join(', ')} }` : `{\n${parts.map((p) => `    ${p}`).join(',\n')}\n  }`;
  };
  const lines = Object.entries(pick).map(([a, b]) => `  ${k(a)}: ${obj(b)}`);
  return `<span class="c">{</span>\n${lines.join(',\n')}\n<span class="c">}</span>`;
}

function generated(): Plugin {
  return {
    name: 'site-generated',
    async transformIndexHtml(template) {
      // the words first: every {{…}} slot from COPY.md, then the road's own entries; any heading left over is a typo
      const copy = parseCopy(readFileSync(join(root, 'COPY.md'), 'utf8'));
      const { html, used } = fillCopy(template, copy);
      const words: Words = (name) => {
        const v = copy.get(name);
        if (v === undefined) throw new Error(`site/COPY.md has no entry for "## ${name}"`);
        used.add(name);
        return v;
      };
      const road = roadHtml(words);
      const unused = unusedCopy(copy, used);
      if (unused.length > 0) throw new Error(`site/COPY.md: no slot on the page uses ${unused.map((u) => `"## ${u}"`).join(', ')} (renamed or misspelled?)`);
      const media = JSON.stringify(JSON.parse(readFileSync(join(root, 'media.json'), 'utf8'))).replaceAll('</', String.raw`<\/`);
      const out = html.replace('<!--gen:media-->', media).replace('<!--gen:road-->', road).replace('<!--gen:devlog-->', devlogHtml()).replace('<!--gen:shardfile-->', await shardfileHtml());
      if (out.includes('<!--gen:')) throw new Error('site: a <!--gen:…--> block was left unfilled');
      return out;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, time: new Date().toISOString() }) });
    },
  };
}

export default defineConfig({
  root,
  publicDir: 'public',
  base: '/',
  build: {
    outDir: fileURLToPath(new URL('../dist-site', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  plugins: [generated()],
});
