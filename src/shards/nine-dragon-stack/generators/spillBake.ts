import { type BufferGeometry, Color, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { nineLayoutSource } from './layout';
import { bakeFixedKits, readFixedSlots } from './casts';
import { canopyGeometries } from './canopyGeometry';
import { bakeSpill, type Emitter } from './lightSpill';
import { SIGN_MODEL } from '../data/signs';
import lantern from '../data/lantern.json' with { type: 'json' };
import atlas from '../data/signAtlas.generated.json' with { type: 'json' };
import { portalPlanRows } from './portalEntries';

/** JSON's signed-zero/non-finite words follow the live layout reviver. */
function vector(words: readonly (number | string)[]): Vector3 {
  const [x, y, z] = words;
  if (x === undefined || y === undefined || z === undefined || words.length !== 3) throw new Error('Invalid spill vector');
  return new Vector3(Number(x), Number(y), Number(z));
}

/** Final vertex streams, after the same named solid/swept merges as native boot.
 * Both deck choices retain their own entry geometry and ordered light list. */
export function spillInputs(caps: boolean, tier: 'phone' | 'desktop'): { geometry: Map<string, BufferGeometry>; emitters: Emitter[] } {
  return withPortableMath(() => {
    const layout = nineLayoutSource(), fixed = bakeFixedKits(readFixedSlots({ rows: layout.rows }));
    const take = (index: number): BufferGeometry => {
      const geometry = layout.geometries[index];
      if (geometry === undefined) throw new Error('Missing spill layout geometry');
      return geometry;
    };
    const solid = new Map(layout.rows.kits.map(row => [row.name, row.geo === null ? null : take(row.geo)]));
    const swept = new Map(layout.rows.kitxs.map(row => [row.name, take(row.geo)]));
    const entries = fixed.geometries.get(caps ? 'entries-capped' : 'entries-open'), boards = fixed.geometries.get('facade-signs');
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
    const crown = canopyGeometries(layout.rows.banyan?.lumps.map(({ c, r, up, seed, wash }) => ({ c: vector(c), r: vector(r), up, seed, wash })) ?? []);
    geometry.set('canopy-cards', crown.cards); geometry.set('canopy-core', crown.core);
    const row = atlas[tier];
    const emitters: Emitter[] = row.placed.filter(sign => sign.neon).map(({ p }) => {
      const count = Array.from(p.spec.text).length, em = p.size;
      const w = p.spec.vertical ? em * 1.42 : em * (count + 0.62), h = p.spec.vertical ? em * (count + 0.58) : em * 1.42;
      const facing = vector(p.normal).setY(0).normalize();
      const gain = ((p.gain ?? SIGN_MODEL.calligraphyGain) / SIGN_MODEL.calligraphyGain) * SIGN_MODEL.tubeGain;
      const k = (1.4 * gain) / SIGN_MODEL.tubeGain;
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

/** The old grid acceleration retains exactly the original per-vertex light order. */
export function bakedSpill(caps: boolean, tier: 'phone' | 'desktop'): ReturnType<typeof spillInputs> {
  const input = spillInputs(caps, tier);
  bakeSpill([...input.geometry.values()], input.emitters);
  return input;
}
