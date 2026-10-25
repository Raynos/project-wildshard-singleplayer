import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { parseGlb } from '@wildshard/sdk/assets';
import { bakeCasts, bakeFixedKits, readFixedSlots } from './casts';
import { bakeLods } from './lods';
import { hookProduct, type HookProduct } from './hookProduct';
import { nineLayoutData } from './layoutSource';
import { deckFloorRows } from './floorRows';
import { CAST_NAMES } from './castSources';

const INPUTS = ['/assets/nine-dragon/lab/walker.glb', '/assets/nine-dragon/lab/sitter.glb',
  '/assets/nine-dragon/lab/organic/lion.glb', '/assets/nine-dragon/lab/guard.glb', '/assets/nine-dragon/lab/grapple/dragon-hook.glb'];
const vector = v.tuple([v.number(), v.number(), v.number()]);
const Hook = v.strictObject({ glb: v.literal('castHook.generated.glb'), material: v.strictObject({
  color: vector, side: v.picklist([0, 1, 2]), normalScale: v.tuple([v.number(), v.number()]), emissive: vector,
  emissiveIntensity: v.number(), envMapIntensity: v.number(), metalness: v.number(), roughness: v.number(),
}), casts: v.array(v.strictObject({ name: v.string(), file: v.string() })) });
const json = (value: unknown, suffix = ''): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}${suffix}`);

/** Exact predecessor native files, returned as bytes without publishing into source or public folders. */
export async function nineCastFiles(read: (url: string) => Uint8Array): Promise<Map<string, Uint8Array>> {
  const layout = nineLayoutData(), lods = await bakeLods(read);
  const fixed = bakeFixedKits(readFixedSlots(layout)), casts = await bakeCasts(read);
  const packs = new Map([...casts, ...fixed.packs, ...lods]), hook = await hookProduct(read);
  const files = new Map<string, Uint8Array>();
  for (const [name, bytes] of packs) { files.set(`raw/${name}.glb`, bytes); files.set(`packed/${name}.glb`, compressGlb(bytes)); }
  files.set('hook.glb', hook.glb);
  files.set('hook.json', json({ glb: 'castHook.generated.glb', material: hook.material,
    casts: [...packs.keys()].map(name => ({ name, file: `data/cast-${name}.generated.glb` })) }, '\n'));
  files.set('fixed.json', new TextEncoder().encode(`${JSON.stringify({ signs: fixed.signs, lanterns: fixed.lanterns },
    (_key, value: unknown) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value)}\n`));
  files.set('floors.json', json(deckFloorRows(), '\n'));
  for (const geometry of fixed.geometries.values()) geometry.dispose();
  return files;
}

/** One invocation's owned cast geometry and the native hook's material fields. */
export interface NineSourceCasts {
  readonly blobs: readonly NamedBlob[];
  readonly raw: ReadonlyMap<string, Uint8Array>;
  readonly material: HookProduct['material'];
}

/** A cache hit re-admits and publishes every live cast; public paths are authored inputs only. */
export async function nineCastsProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<NineSourceCasts> {
  const files = await ctx.cached({ id: 'casts', inputs: INPUTS }, inputs => nineCastFiles(url => {
    const bytes = inputs.get(url); if (bytes === undefined) throw new Error(`Missing authored Nine cast ${url}`); return bytes;
  }));
  const read = (name: string): Uint8Array => { const bytes = files.get(name); if (bytes === undefined) throw new Error(`Missing owned Nine cast ${name}`); return bytes; };
  const hook = v.parse(Hook, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read('hook.json'))));
  const names = new Set([...CAST_NAMES, 'guard']);
  if (files.size !== names.size * 2 + 4 || hook.casts.length !== names.size || new Set(hook.casts.map(row => row.name)).size !== names.size
    || hook.casts.some(row => !names.has(row.name) || row.file !== `data/cast-${row.name}.generated.glb`)) throw new Error('Nine cast file inventory differs');
  const raw = new Map<string, Uint8Array>();
  for (const name of names) { const bytes = read(`raw/${name}.glb`); parseGlb(bytes); raw.set(name, bytes); parseGlb(read(`packed/${name}.glb`)); }
  read('fixed.json'); read('floors.json');
  const blobs = [...CAST_NAMES.map(name => nameBlob(`geometry/casts/${name}.glb`, 'glb', read(`packed/${name}.glb`))),
    nameBlob('geometry/dragon-hook.glb', 'glb', read('hook.glb'))];
  for (const blob of blobs) if (ctx.asset(blob.bytes) !== hashImmutableBytes(blob.bytes)) throw new Error('Nine cast publication differs');
  return { blobs, raw, material: hook.material };
}
