// Run through scripts/browser-lane.sh. Native WebKit pixels are committed; product intake is portable.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { openNativeRaster, bundleNativeRaster } from '@wildshard/sdk/bake/nativeRaster';
import { decodeBuildDeflate } from '@wildshard/sdk/bake/byteCodec';
import { byteWriter, jsonBytes, outputHash, browserBakeBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const outputData = resolve(root, 'public/assets/nine-dragon/authored/glyphs');
const code = await bundleNativeRaster({ root, entry: resolve(import.meta.dirname, 'glyphPage.ts'), format: 'iife', name: 'NineGlyphBake' });
if (code === undefined) throw new Error('Nine glyph page failed to bundle');
const session = await openNativeRaster({
  html: '<!doctype html><meta charset="utf-8"><title>Nine glyph bake</title>', source: code,
});
const tiers = {}, proof = {}, writer = byteWriter(process.argv.includes('--check'), 'nine-glyphs');
try {
  const { page } = session;
  // Optional private reference extracted from the pre-conversion runtime, for a one-time byte differential.
  const original = process.env.NINE_GLYPH_REFERENCE;
  if (original !== undefined) await page.addScriptTag({ content: readFileSync(original, 'utf8') });
  for (const tier of ['phone', 'desktop']) {
    const sink = await browserBakeBytes(page);
    let row, chunks;
    try {
      row = await page.evaluate(async ({ selected, url }) => {
        const baked = window.bakeNineGlyphs(selected), packed = [];
        for (let i = 0; i < baked.packed.length; i++) {
          const id = `part-${i}`, bytes = baked.packed[i];
          if (bytes === undefined) throw new Error('Missing glyph byte block');
          const response = await fetch(`${url}${id}`, { method: 'POST', body: bytes });
          if (!response.ok) throw new Error('Glyph byte handoff refused');
          packed.push(id);
        }
        return { ...baked, packed };
      }, { selected: tier, url: sink.url });
      chunks = row.packed.map(id => sink.take(id));
    } finally { await sink.dispose(); }
    const expected = row.size * row.size * 2, blockSize = 2_097_152;
    if (!Number.isSafeInteger(expected) || expected <= 0 || expected > 256_000_000 || chunks.length !== Math.ceil(expected / blockSize)) throw new Error('Invalid native glyph block inventory');
    const data = Buffer.concat(chunks.map((part, index) => decodeBuildDeflate(part, Math.min(blockSize, expected - index * blockSize))));
    if (original !== undefined) {
      const before = await page.evaluate(selected => window.originalNineGlyphs(selected), tier);
      if (!Buffer.from(data).equals(Buffer.from(before.base64, 'base64')) ||
        JSON.stringify(row.rects) !== JSON.stringify(before.rects) || JSON.stringify(row.layout) !== JSON.stringify(before.layout) || row.size !== before.size) throw new Error(`Nine ${tier} glyph pixels/metrics differ from runtime`);
      proof[tier] = { size: before.size, pixelHash: outputHash(Buffer.from(before.base64, 'base64')), rectHash: outputHash(jsonBytes(before.rects, 0).subarray(0, -1)) };
      console.log(`Nine ${tier}: exact original runtime pixels and metrics (zero tolerance)`);
    }
    const packed = chunks.map((part, i) => {
      const file = `glyphs-${tier}-${i}.bin`;
      writer.put(resolve(outputData, file), part);
      return file;
    });
    tiers[tier] = { ...row, packed, pixelHash: outputHash(data) };
    console.log(`Nine ${tier}: ${row.size}x${row.size} RG8, ${data.length} decoded, ${chunks.reduce((sum, part) => sum + part.byteLength, 0)} wire, ${tiers[tier].pixelHash}`);
  }
} finally { await session.dispose(); }
writer.put(resolve(outputData, 'glyphs.json'), jsonBytes(tiers, 0));
writer.finish();

if (process.env.NINE_GLYPH_PROOF !== undefined) {
  const proofWriter = byteWriter(false, 'nine-glyph-reference');
  proofWriter.put(resolve(root, process.env.NINE_GLYPH_PROOF), jsonBytes(proof)); proofWriter.finish();
}
