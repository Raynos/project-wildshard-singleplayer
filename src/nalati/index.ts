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
import { syncPainterlySun, updatePainterly, setPainterlyLook, painterlyUniforms } from '../world/painterly';
import { wind } from '../world/Wind';
import { windUniforms } from '../world/TreeFactory';
import { NalatiWater } from './water';
import { NalatiPOIs } from '../world/nalati';
import { wireKurgan, type KurganBoss } from './kurganBoss';
import { macrotask } from '../boot/plan';

export interface NalatiCtx { game: Game; sky: Sky; player: Player; forest: Forest; chunk: ChunkDef }

export interface Nalati {
  /** every frame (main.ts game.onUpdate) */
  update: (dt: number, t: number) => void;
  /** the river, brook and waterfall (world agent) */
  water: NalatiWater;
  /** every POI (poi agent, B5): camp, bridge, roads, summer camp, kurgans, balbals, Eagle Rock, cairn, Crags */
  pois: NalatiPOIs;
  /** the great kurgan's dungeon + the Golden King (boss agent, B13; src/nalati/kurganBoss.ts): `boss.bind(play)` from main.ts
   *  once the animals, the kit and the HUD exist; `boss.onPlayerDeath()` in main's death check (true = the boss fight
   *  handled it: the player is back at the phase checkpoint); `boss.inside` while the player is in the dungeon */
  boss: KurganBoss;
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
  updates.push((dt) => {
    updatePainterly(dt);
    // painterly sway (spruce, flags) follows the one Wind (the painterly grass calls wind.update each frame)
    painterlyUniforms.uPWind.value.set(wind.dirX, wind.dirZ, windUniforms.uWindStrength.value);
  });

  // ── water (world agent, B0): the braided Kunes, the plateau brook, the waterfall ──
  const water = new NalatiWater(sky).build();
  game.scene.add(water.group);
  groups['water'] = water.group;
  updates.push((dt) => water.update(dt));
  await macrotask();

  // ── grass + wind (grass agent, B1): the painterly carpet is Grass.ts (main.ts builds it); the Wind object goes here ──

  // ── spruce (spruce agent, B6): the Forest is built by bootstrap from `trees.factory`; anything extra goes here ──

  // ── POIs (poi agent, B5): yurts + camp, bridge, fences, kurgans, balbals, Eagle Rock, the cairn, the Crags rocks ──
  const pois = new NalatiPOIs(sky).build();
  pois.addTo(game.scene, ctx.player);
  groups['pois'] = pois.group;
  updates.push((dt) => pois.update(dt));
  await macrotask();

  // ── creatures (creatures agent, B4): wolves / horses / sheep come from `fauna` via AnimalManager; herd / pack brains here ──

  // ── weapons (bow agent B2, sabre agent B3): main.ts hands out `ChunkDef.weapon`; the Nalati kit hooks in here ──

  // ── the great kurgan + the Golden King (boss agent, B13): the dungeon interior, the doors, the boss fight — src/nalati/kurganBoss.ts ──
  const boss = wireKurgan({ game, sky, player: ctx.player, entrance: pois.kurganEntrance });
  groups['kurgan'] = boss.dungeon.group;
  updates.push((dt, t) => boss.update(dt, t));
  await macrotask();

  return {
    water, pois, groups, boss,
    update(dt, t) { for (const u of updates) u(dt, t); },
  };
}
