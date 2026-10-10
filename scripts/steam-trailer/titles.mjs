// E168: render the trailer's typography as transparent 60 fps PNG sequences (titles.html's pose(card, t) per frame).
//   node scripts/steam-trailer/titles.mjs <outDir> <cards.json>      cards.json: [{ id, card, dur, ...opts }]
//   node scripts/steam-trailer/titles.mjs <outDir> --preview          one still per card at its settled time
//   … [--portrait]   the phone cut's 1080×1920 frame (titles.html body.portrait)
//   … [--titles-html=<path>]   another pipeline's cards page (e.g. scripts/progress-trailer/titles.html) in place of
//        ./titles.html; it must define window.pose(card, t, opts) and window.setPortrait(on), its URLs resolve from its
//        own folder
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FPS = 60;
const flag = process.argv.find((a) => a.startsWith('--titles-html='));
const argv = process.argv.filter((a) => a !== flag);
const HTML = flag ? pathToFileURL(resolve(flag.slice('--titles-html='.length))).href : new URL('titles.html', import.meta.url).href;
const OUT = argv[2];
const preview = argv[3] === '--preview';
const PORTRAIT = argv.includes('--portrait');
// --preview <cards.json>: one still per card at its `at` (the cards of a cut, e.g. the alpha trailer's)
const cards = preview && argv[4] && argv[4] !== '--portrait' ? JSON.parse(readFileSync(argv[4], 'utf8')) : preview
  ? [{ id: 'p-shard', card: 'shard', dur: 3, kicker: 'Shard I', name: 'Driftwood Isle', sub: 'Sail · Dive · Fight', at: 1.6 },
     { id: 'p-line', card: 'line', dur: 2.5, text: 'Three shards of a broken world', at: 1.4 },
     { id: 'p-end', card: 'end', dur: 4, at: 3 }]
  : JSON.parse(readFileSync(argv[3], 'utf8'));

const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: PORTRAIT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(HTML);
await page.evaluate((on) => { window.setPortrait(on); }, PORTRAIT);
await page.evaluate(() => document.fonts.ready);
for (const c of cards) {
  const dir = preview ? OUT : `${OUT}/${c.id}`;
  mkdirSync(dir, { recursive: true });
  const times = preview ? [c.at] : Array.from({ length: Math.round(c.dur * FPS) }, (_, i) => i / FPS);
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(([card, t, o]) => window.pose(card, t, o), [c.card, times[i], c]);
    await page.screenshot({ path: preview ? `${dir}/${c.id}.png` : `${dir}/${String(i).padStart(5, '0')}.png`, omitBackground: true });
  }
  console.log(`[titles] ${c.id}: ${times.length} frames`);
}
await browser.close();
