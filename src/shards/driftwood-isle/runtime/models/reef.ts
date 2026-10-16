/**
 * The lagoon floor's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts; they were built inside
 * src/shards/driftwood-isle/world/Seabed.ts): faceted low-poly CORAL CLUMPS in pastel pink / orange / purple / cream (four shapes: brain
 * domes, staghorn branches, fan plates, tube clusters), SEAWEED BEDS whose fronds sway in the vertex shader (per-vertex
 * weight + phase, like the palms) and REEF STARFISH on the sand. Nothing collides (you swim through them).
 *
 * Each builds in its own space (its base on the sand at the origin, turned by `rot`, scaled by `s`, its tint picked by
 * `v`), from the rng stream it is handed: the lagoon (src/shards/driftwood-isle/world/Seabed.ts) builds its reef in scatter order from ONE
 * stream, across the three kinds, and welds every copy into one mesh on one material (one draw), then places each kind
 * `drawnInto` that mesh (its copies and card). The material (its sway clock, `reefMaterial(ctx).uniforms.uTime`) is the
 * shard's, through the model context.
 */
import type * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { reefSpecimen } from '../boot/reefGeometry';
import { REEF_LOOK, REEF_SPECIMENS } from '../const';

/** the reef's three Explorer specimen kinds */
export type ReefKind = keyof typeof REEF_SPECIMENS;

let reefLook: { material: THREE.Material; follow: () => void } | null = null;
/** hand the reef its compiled graph (look.materials, data/reefLook.ts) and its toon look's once-a-frame follow */
export function setReefLook(materials: ReadonlyMap<string, THREE.Material>, follow: () => void): void {
  const material = materials.get(REEF_LOOK);
  if (material === undefined) throw new Error('Missing Driftwood reef look');
  reefLook = { material, follow };
}


export interface ReefParams {
  /** size, 1 = the builders' metre scale */
  readonly s: number;
  /** turn about +Y, radians */
  readonly rot: number;
  /** 0‥1: which tint of the kind's palette */
  readonly v: number;
  /** coral only: 0 brain, 1 staghorn, 2 fan, 3 tube (default: drawn from the stream, as the lagoon does) */
  readonly shape?: number;
}

/** the reef's one material: its graph (data/reefLook.ts: toon lit, the fronds swaying in the current), its toon look
 *  following the day clock once a frame; the runtime lends it before the world builds, and a reef built before that refuses */
export function reefMaterial(ctx: ModelContext): { material: THREE.Material; uniforms: { uTime: THREE.IUniform<number> }; update?: () => void } {
  return ctx.once('driftwood-isle/reef:material', () => {
    const look = reefLook;
    if (look === null) throw new Error('Driftwood reef: no graph material lent (the runtime compiles it before the world builds)');
    return { material: look.material, uniforms: { uTime: { value: 0 } }, update: look.follow };
  });
}

const reefBuild = (kind: ReefKind) => (ctx: ModelContext, p: ReefParams): ReturnType<typeof reefSpecimen> => reefSpecimen(kind, p, reefMaterial(ctx).material);

export const coral = defineModel<ReefParams>({
  id: 'driftwood-isle/coral', name: 'Coral clump', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/reef.ts',
  // the specimen is the first variant (a brain coral); the lagoon's copies draw their shape from the stream
  defaults: REEF_SPECIMENS.coral.defaults,
  variants: REEF_SPECIMENS.coral.variants,
  seed: 0x5ea1 ^ 0xc0,
  build: reefBuild('coral'),
});

export const seaweed = defineModel<ReefParams>({
  id: 'driftwood-isle/seaweed', name: 'Seaweed bed', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/reef.ts',
  defaults: REEF_SPECIMENS.weed.defaults,
  variants: REEF_SPECIMENS.weed.variants,
  seed: 0x5ea1 ^ 0xc0,
  build: reefBuild('weed'),
});

export const reefStarfish = defineModel<ReefParams>({
  id: 'driftwood-isle/reef-starfish', name: 'Reef starfish', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/reef.ts',
  defaults: REEF_SPECIMENS.star.defaults,
  variants: REEF_SPECIMENS.star.variants,
  seed: 0x5ea1 ^ 0xc0,
  build: reefBuild('star'),
});

/** the model of each scatter kind */
export const REEF = { coral, weed: seaweed, star: reefStarfish } as const;
