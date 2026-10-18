import { createNativeBakeReader } from '@wildshard/sdk/headlessRuntime';
import * as v from 'valibot';
import type { RngState } from '@wildshard/engine/core/rng';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { ForagerContinuation as MarmotContinuation } from '@wildshard/format/ambientLife';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The baked floor's lattice: Rapier's own 256² heightfield over the 500 m chunk, as the page built it. */
export const NALATI_GROUND_RES = 256, NALATI_GROUND_SIZE = 500;

const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.exactOptional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite,
    headAt: v.exactOptional(triple), bodyAt: v.exactOptional(triple), bodyPitch: v.exactOptional(finite),
    fore: v.exactOptional(v.strictObject({ bone: v.string(), at: triple, halfLen: finite, radius: finite })) }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }) });
const Solid = v.strictObject({ shape: v.picklist([1, 2, 6, 9]), groups: finite, friction: finite, body: v.nullable(finite), at: triple, rot: v.tuple([finite, finite, finite, finite]),
  half: v.exactOptional(triple), halfHeight: v.exactOptional(finite), radius: v.exactOptional(finite), vertices: v.exactOptional(v.string()), indices: v.exactOptional(v.string()) });
const Metadata = v.object({
  trees: v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), tops: v.array(finite),
  yurts: v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])),
  spawns: v.array(v.strictObject({ id: v.string(), at: triple, yaw: finite, mem: v.record(v.string(), v.nullable(finite)) })),
  groups: v.array(v.strictObject({ kind: v.picklist(['pack', 'herd']), members: v.array(v.string()), state: v.string() })),
  flocks: v.array(v.strictObject({ n: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(256)), cx: finite, cz: finite, members: v.array(v.strictObject({ at: triple, yaw: finite })) })),
  ledges: v.pipe(v.array(v.strictObject({ x: finite, y: finite, z: finite, r: v.pipe(finite, v.minValue(0)) })), v.maxLength(6)),
  marmots: MarmotContinuation, grass: v.array(triple) });

const reader = createNativeBakeReader(baked, { label: 'Nalati', resolution: NALATI_GROUND_RES, size: NALATI_GROUND_SIZE, parked: false,
  spec: BakedSpec, solid: Solid, extra: Metadata });
const decode = () => {
  const bake = reader.read();
  const ids = new Set(bake.actors.map(actor => actor.id));
  if (ids.size !== bake.actors.length || !bake.herds.every(herd => herd.members.every(id => ids.has(id)))
    || bake.spawns.length !== bake.actors.length || bake.spawns.some((spawn, i) => spawn.id !== bake.actors[i]?.id)
    || !bake.groups.every(group => group.members.every(id => ids.has(id)))) throw new Error('Nalati baked roster is not one id per body');
  if (bake.flocks.some(f => f.members.length !== f.n)) throw new Error('Nalati baked flock is not one pose per sheep');
  if (bake.tops.length !== bake.trees.length) throw new Error('Nalati baked trees and tops differ in count');

  // JSON encodes a never-hit body's -Infinity hit time as null.
  return { ...bake, spawns: bake.spawns.map(spawn => ({ id: spawn.id, at: spawn.at, yaw: spawn.yaw,
    mem: Object.fromEntries(Object.entries(spawn.mem).map(([key, value]) => [key, value ?? -Infinity])) })) };
};
/** Strict SDK-decoded bake plus admitted owner metadata; the schema is the single type source. */
export type NalatiBake = ReturnType<typeof decode>;
export type NalatiBakedActor = NalatiBake['actors'][number];
let parsed: NalatiBake | null = null;
/** Decode only after every collider, actor and metadata check passes. */
export function nalatiBake(): NalatiBake { parsed ??= decode(); return parsed; }

/** Retained boot metadata before any native actor or controller is installed. */
export interface NalatiBootBody {
  readonly id: string; readonly kind: string; readonly variant: { readonly id: string }; readonly seed: number; readonly scale: number;
  readonly herd: number; readonly position: { readonly x: number; readonly z: number }; readonly yaw: number;
  readonly adopted: { readonly stream: RngState; readonly x: number; readonly z: number };
}
export interface NalatiBootHerd { readonly kind: string; readonly cx: number; readonly cz: number; readonly members: readonly NalatiBootBody[] }
/** The product's deterministic boot and deferred native recipe rows. */
export interface NalatiBootRows {
  readonly admission: unknown;
  readonly streamSeed: number; readonly phases: readonly string[];
  readonly roster: { readonly bodies: readonly NalatiBootBody[]; readonly herds: readonly NalatiBootHerd[];
    readonly stream: RngState; readonly wildStream: RngState };
  readonly species: Readonly<Record<string, unknown>>; readonly recipes: readonly AnimalSimSpec[];
}
