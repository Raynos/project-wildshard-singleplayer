// Run through browser-lane.sh: retain the exact canvas raster, without a runtime canvas or font dependency.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { deflateSync } from 'node:zlib';
import { paintSignAtlas } from './signLettering.ts';
import { byteWriter, outputHash, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const read = file => JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data', file), 'utf8'));
const roads = read('places.json').rows.find(row => row.name === 'roads').anchors.signposts;
const specimen = read('campCatalogue.json').find(row => row.key === 'signpostBaked').model.defaults;
const labels = { roads: roads.flatMap(post => post.boards.map(board => board.text)), specimen: specimen.boards.map(board => board.text) };
const writer = byteWriter(process.argv.includes('--check'), 'nalati-sign-atlases');
const atlases = {};
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  const page = await context.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Nalati sign bake</title>');
  await page.addScriptTag({ content: `window.paintSignAtlas = ${paintSignAtlas.toString()};` });
  const referencePath = process.env.NALATI_SIGN_REFERENCE;
  if (referencePath !== undefined) await page.addScriptTag({ content: readFileSync(referencePath, 'utf8') });
  for (const [key, boardLabels] of Object.entries(labels)) {
    const result = await page.evaluate(({ paintLabels, hasReference }) => {
      const canvas = document.createElement('canvas');
      window.paintSignAtlas(canvas, paintLabels);
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      if (hasReference) {
        const original = window.originalSignAtlas(paintLabels), before = original.getContext('2d').getImageData(0, 0, original.width, original.height).data;
        if (pixels.length !== before.length || pixels.some((value, i) => value !== before[i])) throw new Error('Sign atlas differs from parent pixels');
      }
      return { pixels: Array.from(pixels), width: canvas.width, height: canvas.height };
    }, { paintLabels: boardLabels, hasReference: referencePath !== undefined });
    atlases[key] = { width: result.width, height: result.height, data: deflateSync(new Uint8Array(result.pixels), { level: 9 }).toString('base64') };
    console.log(`${key}: ${result.width}x${result.height}, RGBA ${outputHash(new Uint8Array(result.pixels))}, ${referencePath === undefined ? 'no parent reference' : 'exact parent pixels'}`);
  }
} finally { await browser.close(); }
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/signAtlases.json'), jsonBytes(atlases));
writer.finish();
