// The marketing site's build (MARKETING-SITE MS4, E465): its own root, its own public/, its own output. Nothing from
// the game's src/ or vite plugins: the sites share the repo, not a bundle (as drafts/, J15).
//   pnpm build:site   → dist-site/      pages: index.html (the home page), press/index.html (the press kit)
// Every word on every page comes from site/COPY.md (site/tools/copy.ts fills the {{…}} slots; Jake edits that file):
// a slot with no entry, or an entry no page uses, stops the build. Two blocks are filled from elsewhere:
//   <!--gen:shardfile-->  the template's real shard.json, fetched from the live game (MS15)
//   <!--gen:media-->      site/media.json: the trailer and shard loops on Blob (MS11, site/tools/publish-media.ts)
// It also emits /version.json, which site/tools/deploy.sh reads back. deploy.sh builds a clean export (no .git), so it
// passes SITE_BUILD_SHA; a local build asks this checkout.
import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillCopy, parseCopy, unusedCopy } from './tools/copy.ts';

const root = import.meta.dirname;
const GAME = 'https://wildshard-singleplayer.vercel.app';
/** every page of the site, as a path under site/ */
const PAGES = ['index.html', 'press/index.html'];

const sha = process.env.SITE_BUILD_SHA
  ?? execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const BUILD = `${sha}-${Date.now().toString(36)}`;

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** a JSON object's own fields, or null when it isn't an object */
function fields(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
}

/** COPY.md, checked against every page at once: each entry must have a slot on some page */
function loadCopy(): Map<string, string> {
  const copy = parseCopy(readFileSync(join(root, 'COPY.md'), 'utf8'));
  const used = new Set<string>();
  for (const page of PAGES) for (const k of fillCopy(readFileSync(join(root, page), 'utf8'), copy).used) used.add(k);
  const unused = unusedCopy(copy, used);
  if (unused.length > 0) throw new Error(`site/COPY.md: no page uses ${unused.map((u) => `"## ${u}"`).join(', ')} (renamed or misspelled?)`);
  return copy;
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
  let copy: Map<string, string> | null = null;
  return {
    name: 'site-generated',
    async transformIndexHtml(template) {
      copy ??= loadCopy();
      const { html } = fillCopy(template, copy);
      let out = html;
      if (out.includes('<!--gen:media-->')) {
        out = out.replace('<!--gen:media-->', JSON.stringify(JSON.parse(readFileSync(join(root, 'media.json'), 'utf8'))).replaceAll('</', String.raw`<\/`));
      }
      if (out.includes('<!--gen:shardfile-->')) out = out.replace('<!--gen:shardfile-->', await shardfileHtml());
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
    rollupOptions: { input: Object.fromEntries(PAGES.map((p) => [p.replace(/\/?index\.html$/u, '') || 'main', join(root, p)])) },
  },
  plugins: [generated()],
});
