import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseGlb } from '@wildshard/sdk/assets';
import { CAST_NAMES } from './castSources';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap } from '@wildshard/sdk/bake/groundMap';
import { nineCastFiles } from './castsProgram';
import { nineMapAssemblyFrom } from './mapAssemblySource';
import { admitNativeSignAtlas } from './nativeSignAtlas';
import { admitNativeGlyphs } from './nativeGlyphs';
import nativeInputs from '../data/nativeSignAtlas.json' with { type: 'json' };
import glyphInputs from '../data/nativeGlyphs.json' with { type: 'json' };
import settings from '../data/map.json' with { type: 'json' };

/** Every authored model and native atlas/glyph byte consumed by the map assembly. */
export const NINE_MAP_INPUTS: string[] = ['/assets/nine-dragon/lab/walker.glb', '/assets/nine-dragon/lab/sitter.glb',
  '/assets/nine-dragon/lab/organic/lion.glb', '/assets/nine-dragon/lab/guard.glb', '/assets/nine-dragon/lab/grapple/dragon-hook.glb',
  ...nativeInputs.map(row => row.input), ...glyphInputs.map(row => row.input)];

/** Build and paint the original assembly from an exact, caller-owned input bank. */
async function paintNineMap(inputs: ReadonlyMap<string, Uint8Array>, prepared?: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  if (inputs.size !== NINE_MAP_INPUTS.length || NINE_MAP_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) throw new Error('Nine map input inventory differs');
  const read = (name: string): Uint8Array => {
    const bytes = inputs.get(name); if (bytes === undefined) throw new Error(`Missing declared Nine map input ${name}`); return bytes;
  };
  const native = admitNativeSignAtlas(new Map(nativeInputs.map(row => [row.name, read(row.input)])), nativeInputs);
  const glyphs = admitNativeGlyphs(new Map(glyphInputs.map(row => [row.name, read(row.input)])), glyphInputs);
  const casts = prepared ?? new Map([...(await nineCastFiles(read))].filter(([name]) => name.startsWith('raw/'))
    .map(([name, bytes]) => [name.slice(4, -4), bytes]));
  const { assembly } = await nineMapAssemblyFrom({ casts, native, glyphs, read });
  try {
    const packed = assembly.pack(), sources = new Map([['map/assembly.json', packed.json], ['map/geometry.bin', packed.binary]]);
    const need = (name: string): Uint8Array => {
      const bytes = sources.get(name); if (bytes === undefined) throw new Error(`Missing owned Nine map source ${name}`); return bytes;
    };
    const rows = (name: string): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(need(name)));
    const result = await rasterSceneMap({ ...settings, painter: { version: 1, scenes: {
      packs: [{ file: 'map/geometry.bin', rows: { file: 'map/assembly.json', path: ['pack'] }, names: ['names'] }],
      recipes: [{ file: 'map/assembly.json', path: ['scene'] }],
    } } }, { input: need, bytes: need, json: rows });
    return result.pixels;
  } finally { for (const shape of assembly.shapes) { shape.geometry.dispose(); shape.material.dispose(); } }
}

/** Paint standalone callers from their complete native input bank. */
export function nineMapPixels(inputs: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> { return paintNineMap(inputs); }

/** Snapshot the invocation's already admitted casts, preserving independent GLB
 * admission and the identity of every byte before a cache callback can run. */
function mapCasts(source: ReadonlyMap<string, Uint8Array>): { files: ReadonlyMap<string, Uint8Array>; identity: string } {
  const names = [...new Set([...CAST_NAMES, 'guard'])].sort();
  if (source.size !== names.length || names.some(name => !source.has(name))) throw new Error('Nine map cast inventory differs');
  const files = new Map<string, Uint8Array>(), hashes: [string, string][] = [];
  for (const name of names) {
    const input = source.get(name); if (input === undefined) throw new Error(`Missing Nine map cast ${name}`);
    const bytes = new Uint8Array(input); parseGlb(bytes);
    files.set(name, bytes); hashes.push([name, hashImmutableBytes(bytes)]);
  }
  return { files, identity: hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(hashes))) };
}

/** Cache owned RGBA, preserving source-input identity without a generated file or image publisher. */
export async function nineMap(ctx: Pick<ProjectGenerationContext, 'cached'>, prepared?: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const casts = prepared === undefined ? undefined : mapCasts(prepared);
  const files = await ctx.cached({ id: casts === undefined ? 'world-map' : `world-map-${casts.identity}`, native: true, inputs: NINE_MAP_INPUTS }, async inputs =>
    new Map([['map.rgba', await paintNineMap(inputs, casts?.files)]]));
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('Nine map lattice cache inventory differs');
  return pixels;
}
