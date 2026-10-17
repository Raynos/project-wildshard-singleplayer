/**
 * The lagoon floor's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts; they were built inside
 * src/shards/driftwood-isle/world/Seabed.ts): faceted low-poly CORAL CLUMPS in pastel pink / orange / purple / cream (four shapes: brain
 * domes, staghorn branches, fan plates, tube clusters), SEAWEED BEDS whose fronds sway in the vertex shader (per-vertex
 * weight + phase, like the palms) and REEF STARFISH on the sand. Nothing collides (you swim through them).
 *
 * Each builds in its own space (its base on the sand at the origin, turned by `rot`, scaled by `s`, its tint picked by
 * `v`), from the rng stream it is handed: the lagoon (src/shards/driftwood-isle/world/Seabed.ts) builds its reef in scatter order from ONE
 * stream, across the three kinds, and welds every copy into one mesh on one material (one draw), then places each kind
 * `drawnInto` that mesh (its copies and card). The material (its graph sways on the frame clock) is the
 * shard's, through the model context.
 */
import type * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { reefSpecimen } from '../boot/reefGeometry';
import { lentLook, lentToon } from '@wildshard/sdk/looks/lentLooks';
import { followToon } from '../look/toon';
import { REEF_LOOK, REEF_SPECIMENS } from '../const';

/** the reef's three Explorer specimen kinds */
export type ReefKind = keyof typeof REEF_SPECIMENS;


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
export function reefMaterial(ctx: ModelContext): { material: THREE.Material; update?: () => void } {
  return ctx.once('driftwood-isle/reef:material', () => ({ material: lentLook(REEF_LOOK), update: followToon(lentToon(REEF_LOOK)) }));
}

/** The three cards differ only in their existing metadata and authored specimen rows. */
const CARDS = {
  coral: { id: 'coral', name: 'Coral clump' },
  weed: { id: 'seaweed', name: 'Seaweed bed' },
  star: { id: 'reef-starfish', name: 'Reef starfish' },
} as const;

function reefModel(kind: ReefKind) {
  const card = CARDS[kind], rows = REEF_SPECIMENS[kind];
  return defineModel<ReefParams>({
    id: `driftwood-isle/${card.id}`, name: card.name, category: 'nature', pipeline: 'code',
    file: 'src/shards/driftwood-isle/runtime/models/reef.ts', defaults: rows.defaults, variants: rows.variants,
    seed: 0x5ea1 ^ 0xc0,
    build: (ctx, p) => reefSpecimen(kind, p, reefMaterial(ctx).material),
  });
}

/** The model of each scatter kind, retaining its original order and exported identities. */
export const REEF = { coral: reefModel('coral'), weed: reefModel('weed'), star: reefModel('star') } as const;
export const { coral, weed: seaweed, star: reefStarfish } = REEF;
