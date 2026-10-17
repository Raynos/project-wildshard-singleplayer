// Run through scripts/browser-lane.sh. Native WebKit pixels are committed; product intake is portable.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { unzlibSync } from 'fflate';
import { byteWriter, jsonBytes, outputHash } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const result = await build({
  configFile: false, logLevel: 'silent', publicDir: false, root,
  build: { write: false, target: 'esnext', minify: false,
    lib: { entry: resolve(import.meta.dirname, 'glyphPage.ts'), formats: ['iife'], name: 'NineGlyphBake' },
    rolldownOptions: { output: { codeSplitting: false } } },
});
const code = (Array.isArray(result) ? result : [result]).flatMap(b => 'output' in b ? b.output : []).find(c => c.type === 'chunk')?.code;
if (code === undefined) throw new Error('Nine glyph page failed to bundle');
const browser = await webkit.launch({ headless: true });
const tiers = {}, proof = {};
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  const page = await context.newPage();
  // Blank, silent page. It uses the exact system font stack the existing Nine runtime uses.
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Nine glyph bake</title>');
  await page.addScriptTag({ content: code });
  // Optional private reference extracted from the pre-conversion runtime, for a one-time byte differential.
  const original = process.env.NINE_GLYPH_REFERENCE;
  if (original !== undefined) await page.addScriptTag({ content: readFileSync(original, 'utf8') });
  for (const tier of ['phone', 'desktop']) {
    const row = await page.evaluate(selected => window.bakeNineGlyphs(selected), tier);
    const data = Buffer.concat(row.packed.map(part => unzlibSync(Buffer.from(part, 'base64'))));
    if (original !== undefined) {
      const before = await page.evaluate(selected => window.originalNineGlyphs(selected), tier);
      if (!Buffer.from(data).equals(Buffer.from(before.base64, 'base64')) ||
        JSON.stringify(row.rects) !== JSON.stringify(before.rects) || JSON.stringify(row.layout) !== JSON.stringify(before.layout) || row.size !== before.size) throw new Error(`Nine ${tier} glyph pixels/metrics differ from runtime`);
      proof[tier] = { size: before.size, pixelHash: outputHash(Buffer.from(before.base64, 'base64')), rectHash: outputHash(jsonBytes(before.rects, 0).subarray(0, -1)) };
      console.log(`Nine ${tier}: exact original runtime pixels and metrics (zero tolerance)`);
    }
    tiers[tier] = { ...row, pixelHash: outputHash(data) };
    console.log(`Nine ${tier}: ${row.size}x${row.size} RG8, ${data.length} decoded, ${row.packed.reduce((sum, part) => sum + Buffer.from(part, 'base64').length, 0)} wire, ${tiers[tier].pixelHash}`);
  }
} finally { await browser.close(); }
const writer = byteWriter(process.argv.includes('--check'), 'nine-glyphs');
writer.put(resolve(root, 'src/shards/nine-dragon-stack/data/glyphs.generated.json'), jsonBytes(tiers, 0));
writer.finish();

if (process.env.NINE_GLYPH_PROOF !== undefined) {
  const proofWriter = byteWriter(false, 'nine-glyph-reference');
  proofWriter.put(resolve(root, process.env.NINE_GLYPH_PROOF), jsonBytes(proof)); proofWriter.finish();
}
