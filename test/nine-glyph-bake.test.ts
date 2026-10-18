import { expect, test } from 'vitest';
import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, RGFormat, UnsignedByteType } from 'three';
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import { loadGlyphField } from '../src/shards/nine-dragon-stack/runtime/signs/neonText';
import baseline from './fixtures/nine-glyphs.json' with { type: 'json' };
import { FONT_CHARS, WORDS } from '../src/shards/nine-dragon-stack/generators/words';
import signRows from '../src/shards/nine-dragon-stack/data/signView.json' with { type: 'json' };
import profiles from '../src/shards/nine-dragon-stack/data/specimenProfiles.json' with { type: 'json' };
import { GLYPH_LAYOUT } from '../src/shards/nine-dragon-stack/generators/signs';


function blob(name: string): Uint8Array {
  const row = output.namedFiles.find(file => file.name === name), bytes = row === undefined ? undefined : output.assets.get(row.hash);
  if (bytes === undefined) throw new Error(`Missing admitted Nine glyph blob ${name}`);
  return bytes;
}
const files = { file: (name: string): Promise<Uint8Array> => Promise.resolve(blob(name)) };
async function hash(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), byte => byte.toString(16).padStart(2, '0')).join('');
}

for (const tier of ['phone', 'desktop'] as const) {
  test(`${tier} admitted glyph pixels and metrics match the original runtime byte for byte`, async () => {
    const field = await loadGlyphField(tier, files), before = baseline[tier];
    const pixels = field.texture.image.data;
    if (!(pixels instanceof Uint8Array)) throw new Error('Glyph pixels must remain RG8 bytes');
    expect(await hash(pixels)).toBe(before.pixelHash);
    expect(field.texture.image.width).toBe(before.size);
    expect(field.texture.image.height).toBe(before.size);
    expect(field.layout).toEqual(GLYPH_LAYOUT[tier]); expect(field.chars).toBe(FONT_CHARS); expect(field.words).toEqual(WORDS);
    const rects = Object.fromEntries(Array.from(FONT_CHARS, char => [char, field.rect(char)]));
    expect(await hash(new TextEncoder().encode(JSON.stringify(rects)))).toBe(before.rectHash);
    const parts = tier === 'phone' ? 1 : 4;
    for (let index = 0; index < parts; index++) {
      const wire = output.namedFiles.find(file => file.name === `signs/glyphs-${tier}-${index}.rg8`);
      expect(wire?.compressed).toBeLessThan(1_000_000);
      expect(wire?.decoded).toBe(2_097_152); expect(wire?.gpu).toBe(Math.ceil(2_097_152 * 4 / 3));
    }
    expect(field.texture.format).toBe(RGFormat); expect(field.texture.type).toBe(UnsignedByteType);
    expect(field.texture.wrapS).toBe(ClampToEdgeWrapping); expect(field.texture.wrapT).toBe(ClampToEdgeWrapping);
    expect(field.texture.minFilter).toBe(LinearMipmapLinearFilter); expect(field.texture.magFilter).toBe(LinearFilter);
    expect(field.texture.generateMipmaps).toBe(true); expect(field.texture.anisotropy).toBe(4); expect(field.texture.flipY).toBe(false);
    expect(() => field.rect('🦊')).toThrow('glyph atlas has no');
    field.texture.dispose();
  });
}

test('separate worlds own separate glyph textures and decoded pixel arrays', async () => {
  const a = await loadGlyphField('phone', files), b = await loadGlyphField('phone', files);
  expect(a.texture === b.texture).toBe(false); expect(a.texture.image.data === b.texture.image.data).toBe(false);
  const left = a.texture.image.data, right = b.texture.image.data;
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) throw new Error('Glyph pixels must be RG8 bytes');
  const before = right[0]; if (before === undefined) throw new Error('Missing atlas pixel');
  left[0] = before ^ 255;
  expect(right[0]).toBe(before);
  a.texture.dispose(); b.texture.dispose();
});

// Frozen from the native value modules at 8ae50cee, before their data conversion.
test('native sign and specimen rows retain every original field and variant', async () => {
  expect(await hash(new TextEncoder().encode(JSON.stringify(signRows)))).toBe('2ddce64ffdb9b04796510400ce8a60878b29b57fb29bdd376b560f4bacb5da6a');
  expect(await hash(new TextEncoder().encode(JSON.stringify(profiles)))).toBe('a5f52084d05ed660db16e678c06dbaa4401600ec47a5de23cc842fb2094dc2aa');
});
