import { unzlibSync } from 'fflate';
import * as v from 'valibot';
import type { readBakedGeometry } from '@wildshard/game/plugin/geometry';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import bake from '../data/creatureBodies.generated.json' with { type: 'json' };

const n = v.pipe(v.number(), v.finite()), whole = v.pipe(v.number(), v.integer(), v.minValue(0));
const Part = v.nullable(v.strictObject({ offset: whole, row: v.strictObject({
  attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8']), whole, v.boolean()])),
  count: whole, index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: whole, box: v.boolean() }) }));
const Body = v.strictObject({ kind: v.string(), variant: v.string(),
  bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([n, n, n]) })),
  dims: v.strictObject({ bodyY: n, bodyHalfLen: n, bodyRadius: n, headRadius: n, legLen: n, feet: v.array(v.tuple([n, n])), halfWidth: n, capsuleAxis: v.optional(v.picklist(['y', 'z'])) }),
  fur: Part, hard: Part, eye: Part });
const BAKE = v.parse(v.strictObject({ file: v.pipe(v.string(), v.regex(/^\/assets\/driftwood-isle\/creatures\/bodies-[0-9a-f]{64}\.bin$/u)), bytes: whole, bodies: v.array(Body) }), bake);

/** The deflated bake as fetched (kept: each build inflates its own copy, as the old builders ran on every model). */
let deflated: Uint8Array | null = null, loading: Promise<void> | null = null;
let readGeometry: typeof readBakedGeometry | null = null;

/**
 * Fetch the island's baked creature bodies (generators/bake-driftwood-creatures.mjs) once; a failed fetch rejects. The
 * geometry module carries shader patches, so it loads here, never with the species rows the headless keeper imports.
 */
export function preloadCreatureBodies(): Promise<void> {
  loading ??= import('@wildshard/game/plugin/geometry').then(async (geometry) => {
    readGeometry = geometry.readBakedGeometry;
    deflated = await geometry.fetchBuildFile(BAKE.file);
    return undefined;
  });
  return loading;
}

/** A species look's `build`: the baked (kind, variant) body, fresh parts the factory owns. Refuses before the preload. */
export function creatureBody(kind: string, variant: string): AnimalSpecies {
  const body = BAKE.bodies.find((row) => row.kind === kind && row.variant === variant);
  if (body === undefined) throw new Error(`[driftwood-isle] no baked creature body ${kind}.${variant}`);
  if (deflated === null || readGeometry === null) throw new Error(`[driftwood-isle] creature bodies are not loaded (${kind}.${variant})`);
  const read = readGeometry;
  const bytes = unzlibSync(deflated);
  if (bytes.length !== BAKE.bytes) throw new Error('[driftwood-isle] the creature bodies bake does not match its rows');
  const part = (p: v.InferOutput<typeof Part>): AnimalSpecies['furParts'] => (p === null ? [] : [read(bytes, p.offset, p.row)]);
  const { capsuleAxis, ...dims } = body.dims;
  return { bones: body.bones.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })),
    furParts: part(body.fur), hardParts: part(body.hard), eyeParts: part(body.eye),
    dims: { ...dims, feet: dims.feet.map((f): [number, number] => [f[0], f[1]]), ...(capsuleAxis === undefined ? {} : { capsuleAxis }) } };
}
