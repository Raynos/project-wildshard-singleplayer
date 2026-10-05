// SHARD-PLATFORM SF46 (G164 details, council C3-R2-C4): with the hybrid row ON every height and water source of
// Driftwood reads the same −0.8 m as `worldDrop()`, not only the scene root. In both row states, at 20 points, the
// collider under the player (the physics heightfield built from the engine's terrain, as bootstrap builds it) agrees
// with the engine's `heightAt` (the query creatures, props, spawns, audio and quests use), the waterline / sea level
// (swim / wade, the ocean's `uSeaLevel`, the map, the audio's sea) sits at the dropped level, the baked navmesh answers
// in the dropped frame, and a `?at=` pose written in one state stands on the same ground loaded in the other.
import { beforeAll, expect, it } from 'vitest';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import driftwoodBake from '../../../public/assets/baked/driftwood-isle/terrain.bin?inline';
import driftwoodNav from '../../../public/assets/baked/driftwood-isle/navmesh.bin?inline';
import { Scope } from '../../../src/engine/app/scope';
import manifest from '../../../src/shards/driftwood-isle/manifest';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { LOWERED_SEA, WORLD_DROP, droppedTerrain, lowerSea, seaLevel } from '../../../src/shards/driftwood-isle/world/sea';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { configureLevel } from '../../../src/engine/level/selection';
import { _installBakedTerrain } from '../../../src/engine/world/Heightfield';
import { terrainDatum, terrainHeight, terrainWaterLevel } from '../../../src/engine/world/terrainHeight';
import { bakedSamplers, parseBakedTerrain } from '../../../src/engine/world/BakedTerrain';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { Physics } from '../../../src/engine/physics/Physics';
import { addTerrain } from '../../../src/engine/physics/terrain';
import { parseNavmesh, type Navmesh } from '../../../src/engine/physics/navmesh';
import { reproUrl } from '../../../src/engine/ui/Feedback';

const bytesOf = async (dataUrl: string): Promise<ArrayBuffer> => (await fetch(dataUrl)).arrayBuffer();
let wasm: ArrayBuffer, bake: ArrayBuffer, nav: ArrayBuffer;
beforeAll(async () => { [wasm, bake, nav] = await Promise.all([bytesOf(wasmInline), bytesOf(driftwoodBake), bytesOf(driftwoodNav)]); });

/** 20 points: the four entry sockets' inner edges, the pier, the boat, beach, shallows, the plateau, the headland,
 *  the wreck cove, the creek, open sea and the corners */
const POINTS: readonly (readonly [number, number])[] = [
  [0, -235], [0, 235], [235, 0], [-235, 0], [0, -194], [-4.2, -203], [0, -150], [-24, -62], [24, 22], [98, 96],
  [153, 2], [-98, 108], [-180, -30], [60, -120], [-60, 60], [127.5, 18], [-200, -200], [200, 200], [-140, 160], [10, 120],
];

interface State {
  readonly datum: number; readonly ground: number[]; readonly ray: number[]; readonly water: number; readonly sea: number;
  readonly at: readonly string[]; readonly fromAt: (at: string) => number; readonly nav: readonly (number | null)[];
}

function analytic(): NonNullable<typeof manifest.ground.terrain> {
  const field = manifest.ground.terrain; if (field === undefined) throw new Error('Driftwood has an analytic terrain'); return field;
}
const authored = analytic();
const navmesh = (): Navmesh => { const n = parseNavmesh(nav); if (n === null) throw new Error('Driftwood has a navmesh'); return n; };

/** The level booted as the page boots it in one row state: the manifest's field (row OFF, this file's saved pick) or that
 *  field dropped by WORLD_DROP (row ON: the same `droppedTerrain` the manifest applies with the row saved on), the offline
 *  bake installed under its datum, the physics heightfield built from the engine's heightAt. The page-wide sea readers
 *  that key on the saved row (OCEAN.level, the map's open water) are held by g164-row-on.test.ts. */
async function boot(on: boolean): Promise<State> {
  const field = on ? droppedTerrain(authored, () => WORLD_DROP) : authored;
  configureLevel(toLevelSpec({ ...manifest, ground: { ...manifest.ground, terrain: field } }));
  const grid = parseBakedTerrain(bake); if (grid === null) throw new Error('Driftwood has a bake');
  _installBakedTerrain(bakedSamplers(grid));
  const R = await loadRapier(wasm), physics = new Physics(R);
  addTerrain(physics); physics.world.step();
  const ray = POINTS.map(([x, z]) => {
    const hit = physics.world.castRay(new R.Ray({ x, y: 300, z }, { x: 0, y: -1, z: 0 }), 1000, true);
    if (hit === null) throw new Error(`no ground under ${x}, ${z}`);
    return 300 - hit.timeOfImpact;
  });
  physics.dispose();
  // the registered sea the swim / wade body and the audio read: lowered while a hybrid resident (row ON) lives
  const owner = new Scope('g164-test'); if (on) lowerSea(owner);
  const sea = seaLevel(); owner.dispose();
  const mesh = navmesh(), d = terrainDatum(), ground = POINTS.map(([x, z]) => terrainHeight(x, z));
  return {
    datum: d, ground, ray, water: terrainWaterLevel(), sea,
    // every `?at=` writer's y (Feedback's reproUrl here) at the feet on the ground, in this state
    at: POINTS.map(([x, z], i) => new URL(reproUrl('https://x', { shard: 'driftwood-isle', pos: [x, ground[i] ?? 0, z], yaw: 0, pitch: 0 })).searchParams.get('at') ?? ''),
    // play.ts's `?at=` reader in this state: y + terrainDatum()
    fromAt: (at) => (at.split(',').map(Number)[1] ?? Number.NaN) + d,
    nav: POINTS.map(([x, z], i) => mesh.closestWalkable({ x, y: ground[i] ?? 0, z }, 0.3)?.y ?? null),
  };
}

let off: State, on: State;
beforeAll(async () => { off = await boot(false); on = await boot(true); }, 60_000);

it('row OFF: no datum, the legacy levels; row ON: the datum, the waterline and the sea at worldDrop()', () => {
  expect(off.datum).toBeCloseTo(0, 12); expect(off.water).toBe(0.8); expect(off.sea).toBe(0.8);
  expect(on.datum).toBe(-WORLD_DROP);
  // waterLevel (swim / wade / placement through the engine's terrain port) and the registered sea the audio reads
  // (runtime/audio/install.ts seaLevel())
  expect(on.water).toBeCloseTo(0, 12); expect(on.sea).toBe(0);
  // the shardfile's spawn (row ON only) stands on the lowered deck
  expect(source.spawn.y).toBeCloseTo(LOWERED_SEA + 1.2, 9);
});

it('at 20 points in both states the collider ray agrees with heightAt (one residual in both states), and ON sits exactly 0.8 m under OFF', () => {
  for (let i = 0; i < POINTS.length; i++) {
    const [x, z] = POINTS[i] ?? [0, 0];
    // the heightfield's triangles against the bake's bilinear sampler: a few cm on slopes (up to ~15 cm on the crags), the
    // same residual in both states to the millimetre (the drop moves both together)
    for (const s of [off, on]) expect(Math.abs((s.ray[i] ?? Number.NaN) - (s.ground[i] ?? Number.NaN)), `${x}, ${z}`).toBeLessThan(0.2);
    expect((on.ray[i] ?? Number.NaN) - (on.ground[i] ?? Number.NaN)).toBeCloseTo((off.ray[i] ?? Number.NaN) - (off.ground[i] ?? Number.NaN), 2);
    expect((on.ground[i] ?? Number.NaN) - (off.ground[i] ?? Number.NaN)).toBeCloseTo(-0.8, 5);
    expect((on.ray[i] ?? Number.NaN) - (off.ray[i] ?? Number.NaN)).toBeCloseTo(-0.8, 2);
  }
});

it('the baked navmesh (authored frame) answers in the dropped frame with the row ON', () => {
  let checked = 0;
  for (let i = 0; i < POINTS.length; i++) {
    const a = off.nav[i] ?? null, b = on.nav[i] ?? null;
    expect(b === null).toBe(a === null);
    if (a === null || b === null) continue;
    expect(b - a).toBeCloseTo(-WORLD_DROP, 5); checked++;
  }
  expect(checked).toBeGreaterThanOrEqual(10);
});

it('a ?at= pose saved in one row state stands on the same ground loaded in the other', () => {
  for (let i = 0; i < POINTS.length; i++) {
    const gOff = off.ground[i] ?? Number.NaN, gOn = on.ground[i] ?? Number.NaN;
    // saved ON (feet on the lowered ground), loaded OFF: on the raised ground, not 0.8 m inside it
    expect(off.fromAt(on.at[i] ?? '')).toBeCloseTo(gOff, 1);
    // saved OFF, loaded ON: on the lowered ground, not 0.8 m in the air
    expect(on.fromAt(off.at[i] ?? '')).toBeCloseTo(gOn, 1);
    // the same state round-trips (to the URL's centimetres)
    expect(on.fromAt(on.at[i] ?? '')).toBeCloseTo(gOn, 1); expect(off.fromAt(off.at[i] ?? '')).toBeCloseTo(gOff, 1);
  }
});
