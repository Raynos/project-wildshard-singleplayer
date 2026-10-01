/**
 * Sets (E306 / E315 M7): a named group of placements that reads as one place — a camp, a market square, a kurgan
 * field. A set owns no geometry; its members are `place` results. Registered on the shard's registry (`sets`) for the
 * sets explorer between single models and the whole world.
 *
 * Every named place is a Set (M12, Jake 2026-09-30): a shard's discovery list (Driftwood's `DRIFTWOOD_PLACES`, Nalati's
 * `NALATI_PLACES`, Pine Hollow's `PINE_HOLLOW_POIS`, Nine Dragon's `NINE_DRAGON_PLACES`) names its places, and each one's
 * set says so with `place: '<slug>/<place id>'`. The set lists the models placed there; the place's welded ground stays
 * world. scripts/check-models.mjs fails a named place no set names.
 *
 *   const yurts = place(yurt, camp.yurts, { ctx, draw: 'merged' }), props = place(cauldron, camp.props, { ctx, draw: 'instanced' });
 *   placeSet({ id: 'nalati-grasslands/spring-camp', name: 'Spring camp', file: 'src/shards/…/world/camp.ts', members: [yurts, props] });
 */
import * as THREE from 'three';
import { activeRegistry, type RegisteredSet, type WorldRegistry } from '../world/registry';
import type { Placed } from './place';

export interface SetOptions {
  /** `<slug>/<name>`, unique on the shard */
  readonly id: string;
  readonly name: string;
  /** the module that composes it */
  readonly file: string;
  readonly members: readonly Placed[];
  /** the named place this set is: `<slug>/<id>`, the id in its shard's list of named places (M12) */
  readonly place?: string;
  /** models of this place not on the contract yet (their files are held by another lane): their ids, to come */
  readonly pending?: readonly string[];
  /** default: the running shard's registry */
  readonly registry?: WorldRegistry;
}

/** Register a set of placed models; returns what was registered (members summed per model, bounds in world space). */
export function placeSet(o: SetOptions): RegisteredSet {
  const copies = new Map<string, number>();
  const bounds = new THREE.Box3(), b = new THREE.Box3();
  for (const m of o.members) {
    copies.set(m.model, (copies.get(m.model) ?? 0) + m.copies);
    for (let i = 0; i < m.copies; i++) bounds.union(m.copyBox(i, b));
  }
  const set: RegisteredSet = { id: o.id, name: o.name, file: o.file, members: [...copies].map(([model, n]) => ({ model, copies: n })), bounds, placed: o.members,
    ...(o.place === undefined ? {} : { place: o.place }), ...(o.pending === undefined ? {} : { pending: o.pending }) };
  (o.registry ?? activeRegistry()).addSet(set);
  return set;
}
