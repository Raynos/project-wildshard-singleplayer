import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { castRay } from '@wildshard/engine/physics/query';
import { bakedSamplers, parseBakedTerrain, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { NALATI_GROUND_RES, NALATI_GROUND_SIZE, nalatiBake, type NalatiBake, type NalatiBakedActor } from './baked';
import { nalatiBootRoster, type NalatiBootBody, type NalatiBootClock } from './bootRoster';
import { TERRAIN } from '../world/terrain';
import { nalatiWetAt } from '../wet';
import { installNalatiGroups } from './groups';

/** The page's terrain grid, handed to the trusted runtime by path (the boot roster's ground, the bodies' height query). */
export const NALATI_TERRAIN_ASSET = 'public/assets/baked/nalati-grasslands/terrain.bin';
/** The day at boot the headless runtime models: Aqbars and Argymaq hold their lairs, no storm (combat/elites.ts rules). */
export const NALATI_HEADLESS_CLOCK: NalatiBootClock = { phase: 'day', storm: false };

const buffer = (bytes: Uint8Array): ArrayBuffer => { const copy = new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes); return copy; };

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield and
 *  every solid WORLD collider the page built (cuboids, capsules, meshes, convex hulls). */
export function addNalatiWorld(host: SimHost, bake: NalatiBake): void {
  const { R, world } = host.physics, g = bake.ground, n = NALATI_GROUND_RES - 1;
  withOwner(host.scope, () => {
    const ground = world.createCollider(R.ColliderDesc.heightfield(n, n, g.heights, g.scale).setTranslation(g.at.x, g.at.y, g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground, 'ground');
    bake.solids.forEach(solid => {
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0], solid.half[1], solid.half[2])
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 6 && solid.points !== undefined && solid.indices !== undefined ? R.ColliderDesc.trimesh(solid.points, solid.indices)
            : solid.shape === 9 && solid.points !== undefined ? R.ColliderDesc.convexHull(solid.points) : null;
      if (desc === null) throw new Error(`Unbuildable baked Nalati collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0], solid.at[1], solid.at[2]).setRotation({ x: solid.rot[0], y: solid.rot[1], z: solid.rot[2], w: solid.rot[3] })
        .setCollisionGroups(solid.groups).setFriction(solid.friction));
    });
  });
}

/** The page's terrain grid from its trusted bytes, refused unless it is Nalati's own 256² lattice over the 500 m chunk. */
export function nalatiTerrainGrid(bytes: Uint8Array | undefined, seed: number): BakedGrid {
  const grid = bytes === undefined ? null : parseBakedTerrain(buffer(bytes));
  if (grid === null || grid.res !== NALATI_GROUND_RES || grid.size !== NALATI_GROUND_SIZE || grid.seed !== seed) throw new Error(`Nalati headless needs its baked terrain grid (${NALATI_TERRAIN_ASSET})`);
  return grid;
}

/** One manager body in the host: the roster's recipe, its baked native spec, the live actor. */
export interface NalatiBody { readonly boot: NalatiBootBody; readonly baked: NalatiBakedActor; readonly actor: AnimalSim }

/**
 * The creature manager's load-time bodies in a renderer-free host (SF72): the boot roster (runtime/bootRoster.ts, the
 * manager's and Wildlife's streams over the page's terrain grid), every id, kind, coat, seed, scale and herd checked against
 * the trusted bake, each at its tick-0 spot and heading (the bake's, which the roster reproduces) on the manager's creature
 * floor (the first WORLD hit under a ray from a metre over the higher of the level's spawn height and the terrain; the
 * terrain itself when that is the ground's heightfield). The Golden King stays parked (no body), as the page parks him.
 * The host runs on the page's distance bands, installed before any spawn (and before a restoring host restores its clocks).
 */
export function installNalatiRoster(host: SimHost, ports: { bake: NalatiBake; grid: BakedGrid; spawnY: number }): readonly NalatiBody[] {
  const { bake } = ports, s = bakedSamplers(ports.grid);
  host.useBodyBands();
  const roster = nalatiBootRoster({ normalY: (x, z) => s.normalAt(x, z)[1], heightAt: s.heightAt, waterLevel: () => TERRAIN.waterLevel(), wetAt: nalatiWetAt }, NALATI_HEADLESS_CLOCK);
  if (roster.bodies.length !== bake.actors.length || JSON.stringify(roster.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.id) }))) !== JSON.stringify(bake.herds))
    throw new Error('Nalati roster diverges from the page\'s list');
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const;
  const creatureFloor = (x: number, z: number, fromY: number): { y: number; structure: boolean } => {
    const terrain = s.heightAt(x, z);
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - terrain + 1), sees);
    if (hit === null || (hit.material === 'ground' && hit.collider.shape.type === host.physics.R.ShapeType.HeightField)) return { y: terrain, structure: false };
    return { y: hit.point.y, structure: true };
  };
  return roster.bodies.map((boot, i) => {
    const row = bake.actors[i];
    // the bake is the page's own roll: a divergent draw anywhere refuses the roster rather than simulating another world
    if (row?.id !== boot.id || row.kind !== boot.kind || row.variant !== boot.variant.id || row.seed !== boot.seed || row.scale !== boot.scale || row.herd !== boot.herd) throw new Error(`Nalati roster diverges from the page at ${boot.id}`);
    const { x, z } = boot.position, at = creatureFloor(x, z, Math.max(ports.spawnY, s.heightAt(x, z)) + 1);
    const actor = host.spawn({ id: boot.id, spec: row.spec, seed: boot.seed, scale: boot.scale, at: { x, y: at.y, z }, yaw: boot.yaw });
    actor.levelGround = at.structure;
    if (at.structure) actor.groundHeight = (px, pz, py) => creatureFloor(px, pz, py).y;
    actor.herd = boot.herd; actor.scripted = row.scripted;
    return { boot, baked: row, actor };
  });
}

/**
 * Nalati Grasslands' renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the browser-baked native
 * world (the terrain heightfield as Rapier built it and every solid WORLD collider; `ground: false`), the page's terrain grid
 * as the height query, and the creature manager's 35 load-time bodies at their tick-0 spots on the page's distance bands,
 * restored exactly by an identical install before the host restores, and the declared groups (runtime/groups.ts: the pack,
 * the wild herd and Argymaq's herd, seeded on the 'ai' stream as the page seeds them). Not yet owned (fail-closed, see
 * progress/shard-platform/handoffs/sf72-nalati4.md): the groups' decisions (their wild view: the grass field, its trample
 * map, the wind and the day's light), the flock and its dog, the elites, the Golden King and the Storm Titan, the mounted player and the
 * weapons, the day clock past the boot's day, the quests and their facts, and the entry proof; `finish` refuses.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  const bake = nalatiBake(), grid = nalatiTerrainGrid(assets.get(NALATI_TERRAIN_ASSET), shard.identity.seed), heightAt = bakedSamplers(grid).heightAt;
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: NALATI_GROUND_SIZE, height: 0 },
    player: { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never the sabre or the bow: the weapons are declared items (data/items.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  return { level, ports: { ground: false, heightAt }, install: host => {
    // the creature floor casts into this world at install, restoring too (the saved physics then replaces it)
    addNalatiWorld(host, bake);
    const bodies = installNalatiRoster(host, { bake, grid, spawnY: shard.spawn.y }), normal = bakedSamplers(grid).normalAt;
    // the groups' setup draws on the 'ai' stream, restoring too (the host then restores the stream and the bodies' memories)
    installNalatiGroups(host, { bodies, herds: bake.herds, normalY: (x, z) => normal(x, z)[1] });
  } };
};
