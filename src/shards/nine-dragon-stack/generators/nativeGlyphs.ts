import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { NineNativeSignInputs } from './nativeSignMetadata';
import { parseNativeGlyphs } from './sections';

/** Original native raster files, with explicit author-input ownership. */
export interface NineNativeGlyphFile {
  readonly name: string;
  readonly input: string;
  readonly bytes: number;
  readonly hash: string;
}
export interface NineNativeGlyphSource {
  readonly glyphs: NineNativeSignInputs['glyphs'];
  readonly files: ReadonlyMap<string, Uint8Array>;
}

function inventory(reference: readonly NineNativeGlyphFile[]): void {
  if (reference.length !== 6 || new Set(reference.map(row => row.name)).size !== 6 || new Set(reference.map(row => row.input)).size !== 6
    || reference.some(row => !/^[a-zA-Z0-9.-]+$/u.test(row.name) || !/^[a-f0-9]{64}$/u.test(row.hash)
      || !Number.isSafeInteger(row.bytes) || row.bytes <= 0)) throw new Error('Nine native glyph inventory differs');
}

/** Check all immutable source bytes before interpreting native metrics or raster references. */
export function admitNativeGlyphs(files: ReadonlyMap<string, Uint8Array>, reference: readonly NineNativeGlyphFile[]): NineNativeGlyphSource {
  inventory(reference);
  if (files.size !== reference.length) throw new Error('Nine native glyph file inventory differs');
  for (const row of reference) {
    const bytes = files.get(row.name);
    if (bytes === undefined || bytes.byteLength !== row.bytes || hashImmutableBytes(bytes) !== row.hash) throw new Error(`Nine native glyph bytes differ: ${row.name}`);
  }
  const bytes = files.get('glyphs.generated.json'); if (bytes === undefined) throw new Error('Missing Nine native glyph metadata');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const glyphs = parseNativeGlyphs(value);
  const names = new Set(['glyphs.generated.json']);
  for (const selected of ['phone', 'desktop'] as const) {
    const row = glyphs[selected], size = selected === 'phone' ? 1024 : 2048;
    if (row.size !== size || row.packed.length !== size * size * 2 / 2_097_152) throw new Error('Nine native glyph raster dimensions differ');
    for (const [index, name] of row.packed.entries()) {
      if (name !== `glyphs-${selected}-${index}.bin` || names.has(name) || !files.has(name)) throw new Error('Nine native glyph references differ');
      names.add(name);
    }
    for (const rect of Object.values(row.rects)) if (rect.u0 >= rect.u1 || rect.v0 >= rect.v1) throw new Error('Nine native glyph rectangle differs');
  }
  if (names.size !== reference.length) throw new Error('Nine native glyph reference inventory differs');
  return { glyphs, files };
}

/** Cache hits re-read and re-admit all six owned native inputs. */
export async function nineNativeGlyphs(ctx: Pick<ProjectGenerationContext, 'cached'>, reference: readonly NineNativeGlyphFile[]): Promise<NineNativeGlyphSource> {
  inventory(reference);
  const files = await ctx.cached({ id: 'native-glyphs', inputs: reference.map(row => row.input) }, inputs => new Map(reference.map(row => {
    const bytes = inputs.get(row.input); if (bytes === undefined) throw new Error(`Missing Nine native glyph input ${row.input}`);
    return [row.name, bytes];
  })));
  return admitNativeGlyphs(files, reference);
}
