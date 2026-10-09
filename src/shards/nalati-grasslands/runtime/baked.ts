import * as v from 'valibot';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { MarmotContinuation, type MarmotSnapshot } from '../creatures/marmotBrain';
import baked from './physics.baked.json' with { type: 'json' };

/** The baked floor's lattice: Rapier's own 256² heightfield over the 500 m chunk, as the page built it. */
export const NALATI_GROUND_RES = 256, NALATI_GROUND_SIZE = 500;

const finite = v.pipe(v.number(), v.finite()), xyz = v.strictObject({ x: finite, y: finite, z: finite }), triple = v.tuple([finite, finite, finite]);
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.exactOptional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite,
    headAt: v.exactOptional(triple), bodyAt: v.exactOptional(triple), bodyPitch: v.exactOptional(finite),
    fore: v.exactOptional(v.strictObject({ bone: v.string(), at: triple, halfLen: finite, radius: finite })) }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }) });
const Actor = v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, spec: BakedSpec, seed: finite, scale: finite, scripted: v.boolean() });
const Solid = v.strictObject({ shape: v.picklist([1, 2, 6, 9]), groups: finite, friction: finite, body: v.nullable(finite), at: triple, rot: v.tuple([finite, finite, finite, finite]),
  half: v.exactOptional(triple), halfHeight: v.exactOptional(finite), radius: v.exactOptional(finite), vertices: v.exactOptional(v.string()), indices: v.exactOptional(v.string()) });
const Bake = v.object({ version: v.literal(1),
  ground: v.strictObject({ rows: v.literal(NALATI_GROUND_RES - 1), cols: v.literal(NALATI_GROUND_RES - 1), scale: xyz, at: xyz, friction: finite, groups: finite, heights: v.string() }),
  solids: v.array(Solid), actors: v.array(Actor), herds: v.array(v.strictObject({ kind: v.string(), members: v.array(v.string()) })),
  trees: v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), tops: v.array(finite),
  yurts: v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])),
  spawns: v.array(v.strictObject({ id: v.string(), at: triple, yaw: finite, mem: v.record(v.string(), v.nullable(finite)) })),
  groups: v.array(v.strictObject({ kind: v.picklist(['pack', 'herd']), members: v.array(v.string()), state: v.string() })),
  flocks: v.array(v.strictObject({ n: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(256)), cx: finite, cz: finite, members: v.array(v.strictObject({ at: triple, yaw: finite })) })),
  marmots: MarmotContinuation, grass: v.array(triple) });

/** One baked fixed WORLD collider: a cuboid, a capsule, a triangle mesh or a convex hull, at its load pose (doors included). */
export interface NalatiSolid {
  readonly shape: 1 | 2 | 6 | 9; readonly groups: number; readonly friction: number;
  readonly at: readonly [number, number, number]; readonly rot: readonly [number, number, number, number];
  readonly half?: readonly [number, number, number]; readonly halfHeight?: number; readonly radius?: number;
  readonly points?: Float32Array; readonly indices?: Uint32Array;
}
/** A baked body at load: the manager's id, kind / variant, herd slot (−1: none), native spec, seed, scale, `scripted` flag. */
export interface NalatiBakedActor { readonly id: string; readonly kind: string; readonly variant: string; readonly herd: number; readonly spec: AnimalSimSpec; readonly seed: number; readonly scale: number; readonly scripted: boolean }
/** The trusted browser bake (scripts/bake-nalati-physics.mjs), parsed strictly and decoded once. */
export interface NalatiBake {
  readonly ground: { readonly heights: Float32Array; readonly friction: number; readonly groups: number; readonly scale: { x: number; y: number; z: number }; readonly at: { x: number; y: number; z: number } };
  readonly solids: readonly NalatiSolid[];
  readonly actors: readonly NalatiBakedActor[];
  readonly herds: readonly { readonly kind: string; readonly members: readonly string[] }[];
  /** the lone spruces' trunk circles (x, z, r), in the forest's order */
  readonly trees: readonly (readonly [number, number, number])[];
  /** each of those spruces' top (its base `y` + `height`), as the lightning scores it (world/installWeather.ts `exposed`) */
  readonly tops: readonly number[];
  /** the yurts' shelter circles (x, z, r) the page's lightning reads (world/weatherStep.ts yurtsOf over the POI colliders) */
  readonly yurts: readonly (readonly [number, number, number])[];
  /** every body's spot and heading at its tick 0 (the frame it first exists, before the manager moves it), in the list's order */
  readonly spawns: readonly NalatiBakedSpawn[];
  /** each declared group (Wildlife's packs, then its herds, Argymaq's last) as it stood at its tick 0: its members and its
   *  PackBrain / HerdBrain continuation (`snapshot()`), before it first decides */
  readonly groups: readonly NalatiBakedGroup[];
  /** the page's grass before trampling (grassBaseHeightAt) as [x, z, metres]: every body's tick-0 spot, then a 48² grid */
  readonly grass: readonly (readonly [number, number, number])[];
  /** Each flock's first observed frame before Wildlife advances: live positions include its native prey height offset. */
  readonly marmots: MarmotSnapshot;
  readonly flocks: readonly { readonly n: number; readonly cx: number; readonly cz: number;
    readonly members: readonly { readonly at: readonly [number, number, number]; readonly yaw: number }[] }[];
}
/** A declared group at its tick 0: 'pack' or 'herd', its members' ids in the policy's order, its continuation string. */
export interface NalatiBakedGroup { readonly kind: 'pack' | 'herd'; readonly members: readonly string[]; readonly state: string }
/** A body's tick-0 pose as the page placed it: its id, its spot (on the creature floor), its heading and its memory (the
 *  group policies' setup draws, the owned flags). */
export interface NalatiBakedSpawn { readonly id: string; readonly at: readonly [number, number, number]; readonly yaw: number; readonly mem: Readonly<Record<string, number>> }

const bytesOf = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.codePointAt(0) ?? 0);
const floats = (text: string): Float32Array => new Float32Array(bytesOf(text).buffer);
function spec(row: v.InferOutput<typeof BakedSpec>, kind: string, variant: string, id: string): AnimalSimSpec {
  if (row.kind !== kind || row.variant !== variant) throw new Error(`Divergent baked Nalati spec ${id}`);
  return row;
}

let parsed: NalatiBake | null = null;
/** Nalati Grasslands' trusted native bake, strictly parsed and decoded once. */
export function nalatiBake(): NalatiBake {
  if (parsed !== null) return parsed;
  const bake = v.parse(Bake, baked), heights = floats(bake.ground.heights);
  if (heights.length !== NALATI_GROUND_RES ** 2 || bake.ground.scale.x !== NALATI_GROUND_SIZE || bake.ground.scale.z !== NALATI_GROUND_SIZE || bake.ground.scale.y !== 1) throw new Error('Nalati baked floor is not its 256² lattice');
  const solids = bake.solids.map(({ vertices, indices, body: _body, ...rest }): NalatiSolid => {
    if ((rest.shape === 6 || rest.shape === 9) !== (vertices !== undefined) || (rest.shape === 6) !== (indices !== undefined)) throw new Error('Unbuildable baked Nalati collider');
    return { ...rest, ...(vertices === undefined ? {} : { points: floats(vertices) }), ...(indices === undefined ? {} : { indices: new Uint32Array(bytesOf(indices).buffer) }) };
  });
  const ids = new Set(bake.actors.map(actor => actor.id));
  if (ids.size !== bake.actors.length || !bake.herds.every(herd => herd.members.every(id => ids.has(id)))
    || bake.spawns.length !== bake.actors.length || bake.spawns.some((spawn, i) => spawn.id !== bake.actors[i]?.id)
    || !bake.groups.every(group => group.members.every(id => ids.has(id)))) throw new Error('Nalati baked roster is not one id per body');
  if (bake.flocks.some(f => f.members.length !== f.n)) throw new Error('Nalati baked flock is not one pose per sheep');
  if (bake.tops.length !== bake.trees.length) throw new Error('Nalati baked trees and tops differ in count');
  parsed = { ground: { heights, friction: bake.ground.friction, groups: bake.ground.groups, scale: bake.ground.scale, at: bake.ground.at }, solids,
    actors: bake.actors.map(a => ({ ...a, spec: spec(a.spec, a.kind, a.variant, a.id) })), herds: bake.herds, trees: bake.trees, tops: bake.tops, yurts: bake.yurts,
    // a never-hit body's hit time is -Infinity, which JSON writes as null (AnimalSim's own snapshot encodes it so)
    spawns: bake.spawns.map(spawn => ({ ...spawn, mem: Object.fromEntries(Object.entries(spawn.mem).map(([key, value]) => [key, value ?? -Infinity])) })), groups: bake.groups, flocks: bake.flocks, marmots: bake.marmots, grass: bake.grass };
  return parsed;
}
