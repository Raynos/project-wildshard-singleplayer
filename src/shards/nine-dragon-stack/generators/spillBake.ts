import { BufferAttribute, type BufferGeometry, Color, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { nineLayoutSource } from './layout';
import { bakeFixedKits, readFixedSlots } from './casts';
import { canopyGeometries } from './canopyGeometry';
import { bakeSpill, type Emitter } from './lightSpill';
import rawSignRows from '../data/signView.json' with { type: 'json' };
import { parseSignView } from './sections';
import lantern from '../data/lantern.json' with { type: 'json' };
import atlas from '../data/signAtlas.generated.json' with { type: 'json' };
import { portalPlanRows } from './portalEntries';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

const signRows = parseSignView(rawSignRows);

/** Only the native atlas fields the original spill law consumes. */
export interface NineSpillAtlas {
  readonly phone: NineSpillTier;
  readonly desktop: NineSpillTier;
}
interface NineSpillTier {
  readonly placed: readonly { readonly neon: boolean; readonly p: {
    readonly at: readonly (string | number)[]; readonly normal: readonly (string | number)[];
    readonly size: number; readonly gain?: number | undefined;
    readonly spec: { readonly text: string; readonly color: string | number; readonly vertical: boolean };
  } }[];
  readonly lights: readonly { readonly at: readonly (string | number)[]; readonly color: readonly (string | number)[];
    readonly w: number; readonly h: number; readonly power: number; readonly spill: number }[];
}

/** JSON's signed-zero/non-finite words follow the live layout reviver. */
function vector(words: readonly (number | string)[]): Vector3 {
  const [x, y, z] = words;
  if (x === undefined || y === undefined || z === undefined || words.length !== 3) throw new Error('Invalid spill vector');
  return new Vector3(Number(x), Number(y), Number(z));
}

/** Final vertex streams, after the same named solid/swept merges as native boot.
 * Both deck choices retain their own entry geometry and ordered light list. */
function prepareSpillGeometry() {
  const layout = nineLayoutSource(), fixed = bakeFixedKits(readFixedSlots({ rows: layout.rows }));
  const crown = canopyGeometries(layout.rows.banyan?.lumps.map(({ c, r, up, seed, wash }) => ({ c: vector(c), r: vector(r), up, seed, wash })) ?? []);
  return { layout, fixed, crown };
}

/** A draw shares only its unshaded source inputs; each tier/deck receives detached geometry. */
function spillInputsPrepared(caps: boolean, tier: 'phone' | 'desktop', input: NineSpillAtlas,
  prepared: ReturnType<typeof prepareSpillGeometry>): { geometry: Map<string, BufferGeometry>; emitters: Emitter[] } {
  return withPortableMath(() => {
    const { layout, fixed, crown } = prepared;
    const take = (index: number): BufferGeometry => {
      const geometry = layout.geometries[index];
      if (geometry === undefined) throw new Error('Missing spill layout geometry');
      return geometry.clone();
    };
    const solid = new Map(layout.rows.kits.map(row => [row.name, row.geo === null ? null : take(row.geo)]));
    const swept = new Map(layout.rows.kitxs.map(row => [row.name, take(row.geo)]));
    const entries = fixed.geometries.get(caps ? 'entries-capped' : 'entries-open')?.clone(), boards = fixed.geometries.get('facade-signs')?.clone();
    if (entries === undefined || boards === undefined) throw new Error('Missing spill fixed geometry');
    solid.set('entries', entries); solid.set('facade-signs', boards);
    const geometry = new Map<string, BufferGeometry>();
    for (const [name, base] of solid) {
      const extra = swept.get(name);
      if (base !== null) geometry.set(name, extra === undefined ? base : mergeGeometries([base, extra], false));
      else if (extra !== undefined) geometry.set(name, extra);
      swept.delete(name);
    }
    for (const [name, extra] of swept) geometry.set(name, extra);
    geometry.set('canopy-cards', crown.cards.clone()); geometry.set('canopy-core', crown.core.clone());
    const row = input[tier];
    const emitters: Emitter[] = row.placed.filter(sign => sign.neon).map(({ p }) => {
      const count = Array.from(p.spec.text).length, em = p.size;
      const w = p.spec.vertical ? em * 1.42 : em * (count + 0.62), h = p.spec.vertical ? em * (count + 0.58) : em * 1.42;
      const facing = vector(p.normal).setY(0).normalize();
      const gain = ((p.gain ?? signRows.model.calligraphyGain) / signRows.model.calligraphyGain) * signRows.model.tubeGain;
      const k = (1.4 * gain) / signRows.model.tubeGain;
      return { at: vector(p.at).addScaledVector(facing, 0.09 / 2), color: new Color(p.spec.color), w, h, power: k, spill: 0.3 * k };
    });
    emitters.push(...row.lights.map(light => {
      const rgb = vector(light.color);
      return { at: vector(light.at), color: new Color(rgb.x, rgb.y, rgb.z), w: light.w, h: light.h, power: light.power, spill: light.spill };
    }));
    const offset = (layout.rows.counts.walkers + layout.rows.counts.sitters) * 16;
    const lamps = Array.from({ length: layout.rows.counts.lanterns }, (_, i) => new Matrix4().fromArray(layout.records, offset + i * 16));
    if (caps) lamps.push(...fixed.lanterns.map(words => new Matrix4().fromArray(words)));
    // buildPortals appends these eight lamps after the fixed entry additions.
    const portals = portalPlanRows();
    for (const p of portals.decks) for (const s of [-1, 1]) {
      const back = 1.75, side = portals.ring.r + 0.9;
      lamps.push(new Matrix4().compose(new Vector3(p.x + p.nx * back - p.nz * side * s, 4.4, p.z + p.nz * back + p.nx * side * s), new Quaternion(), new Vector3(1.1, 1.1, 1.1)));
    }
    const at = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), g = lantern.glow;
    for (const matrix of lamps) {
      matrix.decompose(at, rotation, scale);
      const center = at.clone(); center.y -= lantern.drop * scale.x;
      emitters.push({ at: center, color: new Color(g.color), w: g.w * scale.x, h: g.h * scale.x, power: g.power, spill: g.spill * scale.x });
    }
    emitters.push(...layout.rows.emitters.map(light => ({ at: new Vector3(...light.at), color: new Color(...light.color), w: light.w, h: light.h, power: light.power, spill: light.spill })));
    return { geometry, emitters };
  });
}

/** Prepare a standalone tier/deck with the same source and per-vertex input order. */
export function spillInputs(caps: boolean, tier: 'phone' | 'desktop', input: NineSpillAtlas = atlas): { geometry: Map<string, BufferGeometry>; emitters: Emitter[] } {
  return withPortableMath(() => spillInputsPrepared(caps, tier, input, prepareSpillGeometry()));
}

/** The old grid acceleration retains exactly the original per-vertex light order. */
export function bakedSpill(caps: boolean, tier: 'phone' | 'desktop', atlasRows: NineSpillAtlas = atlas): ReturnType<typeof spillInputs> {
  const input = spillInputs(caps, tier, atlasRows);
  bakeSpill([...input.geometry.values()], input.emitters);
  return input;
}

/** Each draw's spill, baked into its geometry: every tier and deck ending lights a shared draw identically (refused
 *  otherwise), and each ending's own entry decks are their own draw. */
export function drawSpill(atlasRows: NineSpillAtlas = atlas): ReadonlyMap<string, BufferAttribute> {
  const spill = new Map<string, BufferAttribute>();
  const shaded = new Map<string, ReadonlyMap<string, BufferAttribute>>();
  const prepared = withPortableMath(prepareSpillGeometry);
  for (const tier of ['phone', 'desktop'] as const) for (const caps of [false, true]) {
    const input = spillInputsPrepared(caps, tier, atlasRows, prepared), identity = spillInputIdentity(input), cached = shaded.get(identity);
    if (cached === undefined) {
      bakeSpill([...input.geometry.values()], input.emitters);
      shaded.set(identity, new Map([...input.geometry].map(([name, geometry]) => {
        const attribute = geometry.getAttribute('aSpill');
        if (!(attribute instanceof BufferAttribute)) throw new Error(`Nine spill ${name} is not a buffer`);
        return [name, attribute];
      })));
    } else for (const [name, geometry] of input.geometry) {
      const attribute = cached.get(name);
      if (attribute === undefined) throw new Error(`Missing identical Nine spill ${name}`);
      geometry.setAttribute('aSpill', attribute);
    }
    for (const [name, geometry] of input.geometry) {
      const key = name === 'entries' ? (caps ? 'entries-capped' : 'entries-open') : name, value = geometry.getAttribute('aSpill');
      if (!(value instanceof BufferAttribute)) throw new Error(`Nine spill ${key} is not a buffer`);
      const known = spill.get(key);
      if (known === undefined) spill.set(key, value);
      else if (known.array.length !== value.array.length || known.array.some((word, i) => !Object.is(word, value.array[i]))) throw new Error(`Nine spill differs by tier or deck ending: ${key}`);
    }
  }
  return spill;
}

/** Complete ordered inputs read by bakeSpill: typed position/normal words and every emitter scalar.
 * Local to one draw bake; no prior program, atlas or edited input can satisfy this identity. */
export function spillInputIdentity(input: ReturnType<typeof spillInputs>): string {
  const attribute = (value: BufferAttribute | undefined) => value === undefined ? null : [value.array.constructor.name, value.count, value.itemSize,
    hashImmutableBytes(new Uint8Array(value.array.buffer, value.array.byteOffset, value.array.byteLength))];
  const geometry = [...input.geometry].map(([name, row]) => {
    const position = row.getAttribute('position'), normal = row.getAttribute('normal');
    return [name, attribute(position instanceof BufferAttribute ? position : undefined), attribute(normal instanceof BufferAttribute ? normal : undefined)];
  });
  const emitters = new Float64Array(input.emitters.flatMap(row => [...row.at, ...row.color.toArray(), row.w, row.h, row.power, row.spill]));
  return hashImmutableBytes(new TextEncoder().encode(JSON.stringify([geometry, hashImmutableBytes(new Uint8Array(emitters.buffer))])));
}

/** Put a draw's baked spill on its geometry (its vertex count must match). */
export function withSpill(geometry: BufferGeometry, spill: ReadonlyMap<string, BufferAttribute>, name: string): BufferGeometry {
  const value = spill.get(name);
  if (value === undefined || value.count !== geometry.getAttribute('position').count) throw new Error(`Nine spill does not fit ${name}`);
  return geometry.setAttribute('aSpill', value);
}
