#!/usr/bin/env node
// Rebuild labelled dome sheets from completed receipts, without a game/browser.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import * as v from 'valibot';

const name = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const receipt = v.object({
  source: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u)), slug: name, instance: name,
  milestone: v.picklist(['RM2', 'RM3', 'END', 'OP4']),
  domes: v.pipe(v.array(v.object({
    dome: v.pipe(v.string(), v.regex(/^[A-D][12]-[a-z0-9-]+$/u)), complete: v.literal(true),
    errors: v.pipe(v.array(v.string()), v.length(0)),
    cameras: v.object({convention:v.string()}),
    views: v.pipe(v.array(v.object({ n: v.pipe(v.number(), v.integer()), name: v.string(), imageSha256: hash })), v.length(9)),
  })), v.minLength(1)),
});

/** Refuse partial/stale captures before making anything that could look like a passing sheet.
 * @param {unknown} value */
export function admitBoardCapture(value) {
  const result = v.parse(receipt, value);
  if (new Set(result.domes.map(row => row.dome.slice(0, 2))).size !== result.domes.length) throw new Error('Duplicate board dome');
  for (const dome of result.domes) if (!dome.views.every((view, index) => view.n === index + 1)) throw new Error('Board needs ordered views 1..9');
  return result;
}

/** Escape labels as text, never markup from a plot registry or camera name. @param {string} text */
export const boardText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

/** @param {string} folder */
export async function makeDomeBoards(folder) {
  const capture = admitBoardCapture(JSON.parse(readFileSync(join(folder, 'capture.json'), 'utf8')));
  const sheets = [];
  for (const dome of capture.domes) {
    const directory = join(folder, dome.dome), images = [];
    for (const view of dome.views) {
      const file = join(directory, `view-${view.n}.jpg`), bytes = readFileSync(file);
      if (createHash('sha256').update(bytes).digest('hex') !== view.imageSha256) throw new Error(`Changed capture image: ${file}`);
      const meta = await sharp(bytes).metadata();
      if (meta.width !== 402 || meta.height !== 603) throw new Error(`Changed capture dimensions: ${file}`);
      const caption = `<svg width="402" height="28"><rect width="402" height="28" fill="#071521"/><text x="8" y="19" fill="white" font-family="sans-serif" font-size="12">${boardText(`${view.n} ${view.name}`)}</text></svg>`;
      images.push({ input: await sharp(bytes).composite([{ input: Buffer.from(caption), left: 0, top: 575 }]).toBuffer(), left: ((view.n - 1) % 3) * 402, top: 40 + Math.floor((view.n - 1) / 3) * 603 });
    }
    const heading = `<svg width="1206" height="40"><rect width="1206" height="40" fill="#071521"/><text x="12" y="17" fill="white" font-family="sans-serif" font-size="15">${boardText(`${capture.slug} · ${dome.dome} · ${capture.source.slice(0, 7)} · phone 2× · ${capture.milestone} NOW`)}</text><text x="12" y="33" fill="white" font-family="sans-serif" font-size="11">${boardText(dome.cameras.convention)}</text></svg>`;
    const canvas = sharp({ create: { width: 1206, height: 1849, channels: 3, background: '#071521' } }).composite([{ input: Buffer.from(heading), left: 0, top: 0 }, ...images]);
    let bytes;
    for (const quality of [72, 60, 48, 36, 24]) {
      bytes = await canvas.clone().jpeg({ quality }).toBuffer();
      if (bytes.byteLength <= 500000) break;
    }
    if (bytes === undefined || bytes.byteLength > 500000) throw new Error('Dome sheet exceeds 500 KB');
    const sheetName = capture.milestone === 'RM2' ? 'sheet-baseline-3x3.jpg' : capture.milestone === 'RM3' ? 'sheet-kit-3x3.jpg' : capture.milestone === 'END' ? 'sheet-end-3x3.jpg' : 'sheet-3x3.jpg';
    const file = join(directory, sheetName); writeFileSync(file, bytes);
    sheets.push({ dome: dome.dome, file, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  writeFileSync(join(folder, 'boards.json'), `${JSON.stringify({ source: capture.source, slug: capture.slug, sheets }, null, 2)}\n`);
  return sheets;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const folders = process.argv.find(arg => arg.startsWith('--captures='))?.slice('--captures='.length).split(',');
  if (folders === undefined || folders.length === 0 || folders.some(folder => folder === '') || new Set(folders).size !== folders.length) throw new Error('Requires unique --captures=DIR[,DIR...]');
  for (const folder of folders) console.info(JSON.stringify({ folder, sheets: await makeDomeBoards(folder) }));
}
