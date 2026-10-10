// The marketing site's build (MARKETING-SITE MS4, E465): its own root, its own public/, its own output. Nothing from
// the game's src/ or vite plugins: the sites share the repo, not a bundle (as drafts/, J15).
//   pnpm build:site   → dist-site/      pages: index.html (the home page), play/, build/ and mmo/ (the three sagas,
//                                       MS29–MS31), press/index.html (the press kit), 404.html
// Every word on every page comes from site/COPY.md (site/tools/copy.ts fills the {{…}} slots; Jake edits that file):
// a slot with no entry, or an entry no page uses, stops the build. Two blocks are filled from elsewhere:
//   <!--gen:shardfile-->  site/shardfile.json: an excerpt of the template's real shard.json (MS15), checked in, so the
//                         site builds when the game is down
//   <!--gen:media-->      site/media.json: the trailer and shard loops on Blob (MS11, site/tools/publish-media.ts);
//                         %TRAILER_WIDE% / %TRAILER_PHONE% put the trailer encodes straight into its <source> tags
// It also emits /version.json, which site/tools/deploy.sh reads back, and press/wildshard-press-kit.zip: the files in
// public/press/ and a README whose words are the press page's (so the kit never drifts from the site; needs `zip`). deploy.sh builds a clean export (no .git), so it
// passes SITE_BUILD_SHA; a local build asks this checkout.
import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillCopy, parseCopy, plain, unusedCopy } from './tools/copy.ts';

const root = import.meta.dirname;
/** every page of the site, as a path under site/ */
const PAGES = ['index.html', 'play/index.html', 'build/index.html', 'mmo/index.html', 'press/index.html', '404.html'];

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
function shardfileHtml(): string {
  const pick = fields(JSON.parse(readFileSync(join(root, 'shardfile.json'), 'utf8')));
  if (pick === null) throw new Error('site/shardfile.json: not a JSON object');
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

// ---- MS20 · the press kit ------------------------------------------------------------------------------------------
const KIT = ['logo.svg', 'logo-mono.svg', 'logo.png', 'mark.svg', 'mark.png', 'shot-driftwood-isle.jpg', 'shot-pine-hollow.jpg',
  'shot-nalati-grasslands.jpg', 'shot-signal-dunes.jpg', 'shot-sky-reach.jpg', 'shot-nine-dragon-stack.jpg'];
function pressKit(outDir: string, copy: Map<string, string>): void {
  const words = (k: string): string => plain(copy.get(k) ?? '');
  const readme = ['PROJECT WILDSHARD - PRESS KIT', 'https://wildshard.io', '', words('Press · one-line blurb'), '',
    words('Press · paragraph blurb'), '', words('Press · colours and type'), '', words('Press · kit contents label').toUpperCase(),
    ...(copy.get('Press · kit contents') ?? '').split('\n').map(plain), '', 'project.wildshard@gmail.com', ''].join('\n');
  const press = join(outDir, 'press');
  const dir = join(press, 'wildshard-press-kit');
  mkdirSync(dir, { recursive: true });
  for (const f of KIT) copyFileSync(join(root, 'public', 'press', f), join(dir, f));
  writeFileSync(join(dir, 'README.txt'), readme);
  execFileSync('zip', ['-qrX', 'wildshard-press-kit.zip', 'wildshard-press-kit'], { cwd: press });
  rmSync(dir, { recursive: true });
}

function generated(): Plugin {
  let copy: Map<string, string> | null = null;
  const media = fields(JSON.parse(readFileSync(join(root, 'media.json'), 'utf8')));
  return {
    name: 'site-generated',
    transformIndexHtml(template) {
      copy ??= loadCopy();
      const { html } = fillCopy(template, copy);
      let out = html;
      if (out.includes('<!--gen:media-->')) {
        out = out.replace('<!--gen:media-->', JSON.stringify(media).replaceAll('</', String.raw`<\/`));
      }
      if (out.includes('%TRAILER_PHONE%')) {
        // the trailer is a plain <video>: both encodes go straight into its <source> tags
        const { trailer } = media ?? {};
        const { mp4, mp4Phone } = fields(trailer) ?? {};
        if (typeof mp4 !== 'string' || typeof mp4Phone !== 'string') throw new Error('site/media.json has no trailer.mp4 / mp4Phone');
        out = out.replace('%TRAILER_PHONE%', esc(mp4Phone)).replace('%TRAILER_WIDE%', esc(mp4));
      }
      if (out.includes('<!--gen:shardfile-->')) out = out.replace('<!--gen:shardfile-->', shardfileHtml());
      if (out.includes('<!--gen:')) throw new Error('site: a <!--gen:…--> block was left unfilled');
      return out;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, time: new Date().toISOString() }) });
    },
    writeBundle({ dir }) {
      if (dir !== undefined) pressKit(dir, copy ?? loadCopy());
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
    rolldownOptions: { input: Object.fromEntries(PAGES.map((p) => [p.replace(/\/?index\.html$/u, '').replace(/\.html$/u, '') || 'main', join(root, p)])) },
  },
  plugins: [generated()],
});
