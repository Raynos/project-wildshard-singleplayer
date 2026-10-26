import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { parseGlb, parseKtx2 } from '@wildshard/sdk/assets';
import { bakeRawColourPixels } from '@wildshard/sdk/bake/rawTexture';
import { MODEL_FILES, bakeModelPaint } from './modelPaint.mjs';
import { nalatiModelSourceParts } from './modelSourceParts';

const inputPrefix = '/assets/nalati/models/';

/** Owned geometry/atlas cache from the defining painter; no public painted-model handoff. */
export async function nalatiModelPartsProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'readImagePixels'>, selected: readonly string[] = MODEL_FILES): Promise<ReadonlyMap<string, Uint8Array>> {
  const names = [...selected];
  if (names.length === 0 || new Set(names).size !== names.length || names.some(file => !MODEL_FILES.includes(file))) throw new Error('Invalid Nalati model-part selection');
  const expected = names.flatMap(file => file.endsWith('.far.glb') ? [file] : [file, file.replace(/\.glb$/u, '.ktx2')]);
  const files = await ctx.cached({ id: 'model-parts', native: true, inputs: names.map(file => `${inputPrefix}${file}`) }, async inputs => {
    const out = new Map<string, Uint8Array>();
    for (const file of names) {
      const input = inputs.get(`${inputPrefix}${file}`), name = file.split('.')[0];
      if (input === undefined || name === undefined) throw new Error(`Missing authored Nalati model: ${file}`);
      const parts = nalatiModelSourceParts(await bakeModelPaint(input, name));
      out.set(file, parts.geometry);
      if (parts.webp !== null) out.set(file.replace(/\.glb$/u, '.ktx2'), bakeRawColourPixels(await ctx.readImagePixels(parts.webp), { colourSpace: 'srgb' }));
    }
    return out;
  });
  if (files.size !== expected.length || [...files.keys()].some(file => !expected.includes(file))) throw new Error('Nalati model-part inventory differs');
  for (const file of expected) {
    const bytes = files.get(file);
    if (bytes === undefined) throw new Error(`Missing Nalati model part: ${file}`);
    if (file.endsWith('.ktx2')) parseKtx2(bytes); else parseGlb(bytes);
  }
  return files;
}
