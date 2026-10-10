// titles-check.mjs — §2.3's legibility rule measured on the rendered cards (row PT7; E468): every read block on screen
// is ≥ 56 px cap height at 1080, ≤ 7 words, fits its slot, and stays ≥ 1.2 s (receipts.mjs readSchedule).
//   node scripts/progress-trailer/receipts.mjs --out=<dir>
//   scripts/browser-lane.sh --max 5 node scripts/progress-trailer/titles-check.mjs <dir>/cards.json
// Poses every card in titles.html every 0.1 s (and at each read's first frame) and reads window.legibility().
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSchedule, wordCount } from './receipts.mjs';

const require = createRequire(join(import.meta.dirname, '../../package.json'));
const { chromium } = require('playwright');
const cardsPath = process.argv[2];
if (!cardsPath) throw new Error('usage: titles-check.mjs <cards.json>');
const cards = JSON.parse(readFileSync(resolve(cardsPath), 'utf8'));
const CAP = 56, WORDS = 7, HOLD = 1.2;

const fails = [];
for (const r of readSchedule(cards)) {
  if (r.to - r.from < HOLD - 1e-6) fails.push(`${r.card} "${r.text}" on screen ${(r.to - r.from).toFixed(2)} s < ${HOLD}`);
  if (wordCount(r.text) > WORDS) fails.push(`${r.card} "${r.text}" ${wordCount(r.text)} words > ${WORDS}`);
}
const browser = await chromium.launch({ headless: true, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(import.meta.dirname, 'titles.html')).href);
await page.evaluate(() => document.fonts.ready);
const minCap = new Map();
for (const c of cards) {
  const times = new Set();
  for (let i = 0; i * 0.1 < c.dur; i++) times.add(Math.round(i * 100) / 1000);
  for (const r of readSchedule([c])) times.add(r.from);
  for (const t of times) {
    const L = await page.evaluate(([card, tt, o]) => { window.pose(card, tt, o); return window.legibility(); }, [c.card, t, c]);
    for (const b of L) {
      const key = `${c.id} · ${b.block}`;
      const m = minCap.get(key);
      if (!m || b.capPx < m.capPx) minCap.set(key, { ...b, t });
      if (b.capPx < CAP) fails.push(`${c.id} t=${t} "${b.text}" cap ${b.capPx} px < ${CAP}`);
      if (!b.fits) fails.push(`${c.id} t=${t} "${b.text}" does not fit its slot`);
    }
  }
}
await browser.close();
for (const [k, b] of minCap) console.log(`[titles-check] ${k}: min cap ${b.capPx} px (${b.font}) · "${b.text}"`);
const uniq = [...new Set(fails)];
if (uniq.length > 0) throw new Error(`[titles-check] ${uniq.length} failures:\n${uniq.slice(0, 40).join('\n')}`);
console.log(`[titles-check] ok: ${cards.length} cards, every read ≥ ${CAP} px cap, ≤ ${WORDS} words, ≥ ${HOLD} s`);
