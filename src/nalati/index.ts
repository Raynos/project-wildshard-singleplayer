/**
 * The Nalati Grasslands wiring — everything this shard adds on top of the shared boot (docs/plans/NALATI.md).
 *
 * `main.ts` calls `wireNalati(ctx)` once, inside its `props` step, when `chunk.style === 'painterly'`, and
 * `nalati.update(dt, t)` every frame. Nothing here runs for Pine Hollow or Driftwood Isle.
 *
 * Already done by the shared boot for this shard (driven by `src/chunks/nalati-grasslands.ts`):
 *   · the painted terrain + slab (Terrain.ts painterly branch), the painted sky / sun / planet / clouds (Sky.ts),
 *     the Nalati horizon ring (Horizon.ts, `ChunkDef.horizon`), fog + grade (the def's values)
 *   · grass: main.ts still builds `Grass` for every dry shard — the grass agent's painterly mode lives in Grass.ts
 *   · trees: bootstrap's Forest from `trees.factory` (the spruce agent's `'spruce'` factory + `forest.mask`)
 *   · animals: AnimalManager from `fauna` (wolves / horses / sheep register as species)
 *   · the weapon: `ChunkDef.weapon` (the Driftwood sword until the bow / sabre land)
 *
 * Each section below is one system; its owner fills it in. Keep main.ts untouched — add here.
 */
import { Color, type Object3D } from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { ChunkDef } from '../chunks/ChunkDef';
import { syncPainterlySun, updatePainterly, setPainterlyLook } from '../world/painterly';
import { NalatiWater } from './water';
import { macrotask } from '../boot/plan';

export interface NalatiCtx { game: Game; sky: Sky; player: Player; forest: Forest; chunk: ChunkDef }

export interface Nalati {
  /** every frame (main.ts game.onUpdate) */
  update: (dt: number, t: number) => void;
  /** the river, brook and waterfall (world agent) */
  water: NalatiWater;
  /** anything a later system wants to find: named groups added to the scene by this wiring */
  groups: Record<string, Object3D>;
}

export async function wireNalati(ctx: NalatiCtx): Promise<Nalati> {
  const { game, sky } = ctx;
  const updates: ((dt: number, t: number) => void)[] = [];
  const groups: Record<string, Object3D> = {};

  // ── look (world agent, B0): the painterly material's shared uniforms — sun, painted shadow tint, rim light ──
  syncPainterlySun(sky);
  setPainterlyLook({ shadeTint: new Color(0.1, 0.16, 0.36), rimColor: new Color(1.5, 1.28, 0.95), wind: { x: 1, z: 0.35, strength: 1 } });
  updates.push((dt) => updatePainterly(dt));

  // ── water (world agent, B0): the braided Kunes, the plateau brook, the waterfall ──
  const water = new NalatiWater(sky).build();
  game.scene.add(water.group);
  groups['water'] = water.group;
  updates.push((dt) => water.update(dt));
  await macrotask();

  // ── grass + wind (grass agent, B1): the painterly carpet is Grass.ts (main.ts builds it); the Wind object goes here ──

  // ── spruce (spruce agent, B6): the Forest is built by bootstrap from `trees.factory`; anything extra goes here ──

  // ── POIs (poi agent, B5): yurts + camp, bridge, fences, kurgans, balbals, Eagle Rock, the cairn, the Crags rocks ──

  // ── creatures (creatures agent, B4): wolves / horses / sheep come from `fauna` via AnimalManager; herd / pack brains here ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ChunkDef.weapon`; the Nalati kit hooks in here ──

  return {
    water, groups,
    update(dt, t) { for (const u of updates) u(dt, t); },
  };
}
