import { type BufferGeometry, MeshStandardMaterial, Vector3 } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { CASTS, CAST_CHANNELS, type Cast, type PreparedGeometry } from '../data/casts';
import { loadPropGlb, propGlbBox } from './propGlb';
import { guardMatrix } from './propFrame';
import { SignRecorder } from './layout';
import * as v from 'valibot';
import { Ctx } from './ctx';
import { buildEntryDecks } from './entries';
import { Rng } from '@wildshard/sdk/random';
import { WORDS } from '../data/words';

const HUES = { skin: 0xc9a58a, red: 0xa23a28, blue: 0x5d7f9e, green: 0x3e5a4a };
const DARK = [0x1f2126, 0x2a2c31, 0x3b3f4a, 0x55585f, 0x6b6f78, 0x8a8f96];
const LIGHT = [0x3a3630, 0x5a5448, 0x7a7262, 0x958c78, 0xafa590, 0xc6bea8];
const STONE = [0x2f2f33, 0x45454a, 0x5b5b60, 0x6e6e73, 0x808086, 0x94949a];
const vector = v.tuple([v.number(), v.number(), v.number()]);
const slot = v.strictObject({ at: vector, normal: vector, size: v.number(), color: v.number(), blade: v.boolean() });
const slots = v.strictObject({ early: v.array(slot), late: v.array(slot) });

/** Read only the recorded slot inputs; no runtime schema or layout recomputation enters the author. */
export function readFixedSlots(input: unknown): v.InferOutput<typeof slots> {
  return v.parse(v.object({ rows: v.object({ slots }) }), input).rows.slots;
}

/** The old prop writer, with its original intake, transform and float32 rounding order. */
export async function castGeometry(name: Cast, read: (url: string) => Uint8Array): Promise<BufferGeometry> {
  if (name === 'guard') {
    const bytes = read('/assets/nine-dragon/lab/guard.glb');
    return loadPropGlb(bytes, { kind: 20, wash: 0xba9444, lumLo: 0.2, lumHi: 1.35, ao: 0.9, clipBack: 0.2,
      matrix: guardMatrix(await propGlbBox(bytes), 0.115, -0.004, 0.006, 0) });
  }
  if (name === 'lion') return loadPropGlb(read('/assets/nine-dragon/lab/organic/lion.glb'), { kind: 9, line: 0, ao: 0.85, ramp: STONE, hues: {} });
  const [model, ramp] = name.split('-');
  return loadPropGlb(read(`/assets/nine-dragon/lab/${model}.glb`), { kind: 0, line: 0, ao: 0.6, ramp: ramp === 'dark' ? DARK : LIGHT, hues: HUES });
}

/** Each pack is independently loaded at the former conversion call, including the optional guard. */
export async function bakeCasts(read: (url: string) => Uint8Array): Promise<Map<PreparedGeometry, Uint8Array>> {
  const out = new Map<PreparedGeometry, Uint8Array>();
  for (const name of CASTS) {
    const geometry = await castGeometry(name, read);
    out.set(name, packGeometry(name, geometry));
    geometry.dispose();
  }
  return out;
}

/** Exact buffers and original bounds through the existing declared rest-pool format. */
function packGeometry(name: PreparedGeometry, geometry: BufferGeometry): Uint8Array {
  const sphere = geometry.boundingSphere, box = geometry.boundingBox;
  return staticGlb([{ name, geometry, material: new MeshStandardMaterial(),
    customAttributes: Object.fromEntries(CAST_CHANNELS.map(row => [row.source.toUpperCase(), row.name])),
    extras: { restBox: box === null ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
      restSphere: sphere === null ? null : [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], restGroups: [] },
  }], `nine-cast-${name}`);
}

/** Both reachable deck variants and the single Rng(4242) slot sequence, including lantern and sign replay rows. */
export function bakeFixedKits(recorded: v.InferOutput<typeof slots>): { packs: Map<PreparedGeometry, Uint8Array>; signs: SignRecorder['calls']; lanterns: number[][] } {
  const packs = new Map<PreparedGeometry, Uint8Array>();
  let lanterns: number[][] = [];
  for (const caps of [false, true]) {
    const ctx = new Ctx(new SignRecorder());
    buildEntryDecks(ctx, caps);
    packs.set(caps ? 'entries-capped' : 'entries-open', packGeometry(caps ? 'entries-capped' : 'entries-open', ctx.kit('entries').build()));
    if (caps) lanterns = ctx.lanterns.map(matrix => matrix.toArray());
  }
  const recorder = new SignRecorder(), ctx = new Ctx(recorder), rng = new Rng(4242);
  const kit = ctx.kit('facade-signs');
  for (const row of [...recorded.early, ...recorded.late]) {
    const word = rng.pick(WORDS), color = `#${row.color.toString(16).padStart(6, '0')}`, size = Math.min(row.size, row.blade ? 1.2 : 0.8);
    recorder.place({ at: new Vector3(...row.at), normal: new Vector3(...row.normal), size, spec: { text: word, color, vertical: row.blade,
      style: row.blade || rng.chance(0.5) ? 'tube' : 'box' }, blade: row.blade }, row.blade ? null : kit);
  }
  packs.set('facade-signs', packGeometry('facade-signs', kit.build()));
  return { packs, signs: recorder.calls, lanterns };
}
