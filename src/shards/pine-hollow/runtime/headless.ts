import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { parseNavmesh } from '@wildshard/engine/physics/navmesh';
import { bakedSamplers, parseBakedTerrain, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { PINE_GROUND_RES, pineBake, type PineBake } from './baked';
import { installPineRoster, type PineRosterPorts } from './roster';
import { installPineElites } from './elites';
import { installPineKing } from './king';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { PINE_DAY } from '../look/dayKeys';

/** The native bakes the page reads before its herds, handed to the trusted runtime by path: the terrain grid (the hunting
 *  brain's ground, the bodies' ground follow) and the navmesh (the brain's paths). Pine's shardfile admits no assets. */
export const PINE_TERRAIN_ASSET = 'public/assets/baked/pine-hollow/terrain.bin', PINE_NAVMESH_ASSET = 'public/assets/baked/pine-hollow/navmesh.bin';

const buffer = (bytes: Uint8Array): ArrayBuffer => { const copy = new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes); return copy; };

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield (the
 *  crag cave's cuts included) and the 2082 solid WORLD colliders the page built (cuboids, capsules, meshes, convex hulls). */
export function addPineWorld(host: SimHost, bake: PineBake): void {
  const { R, world } = host.physics, g = bake.ground, n = PINE_GROUND_RES - 1;
  withOwner(host.scope, () => {
    const ground = world.createCollider(R.ColliderDesc.heightfield(n, n, g.heights, g.scale).setTranslation(g.at.x, g.at.y, g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground, 'ground');
    bake.solids.forEach(solid => {
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0], solid.half[1], solid.half[2])
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 6 && solid.points !== undefined && solid.indices !== undefined ? R.ColliderDesc.trimesh(solid.points, solid.indices)
            : solid.shape === 9 && solid.points !== undefined ? R.ColliderDesc.convexHull(solid.points) : null;
      if (desc === null) throw new Error(`Unbuildable baked Pine collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0], solid.at[1], solid.at[2]).setRotation({ x: solid.rot[0], y: solid.rot[1], z: solid.rot[2], w: solid.rot[3] })
        .setCollisionGroups(solid.groups).setFriction(solid.friction));
    });
  });
}

/** The page's terrain grid from its trusted bytes, refused unless it is Pine's own 256² lattice over the 500 m chunk. */
export function pineTerrainGrid(bytes: Uint8Array | undefined): BakedGrid {
  const grid = bytes === undefined ? null : parseBakedTerrain(buffer(bytes));
  if (grid === null || grid.res !== PINE_GROUND_RES || grid.size !== 500 || grid.seed !== 1337) throw new Error(`Pine headless needs its baked terrain grid (${PINE_TERRAIN_ASSET})`);
  return grid;
}

/**
 * Pine Hollow's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the browser-baked native world
 * (the terrain heightfield as Rapier built it and every solid WORLD collider; `ground: false`), the page's terrain grid as the
 * height query (the ground the herds read and walk), and the creature manager's 164 load-time bodies with their stream,
 * herds, decisions, hit reactions and charges (runtime/roster.ts), restored exactly by an identical install (the roster is
 * the stream's, the same every boot) before the host restores, and the four named elites' fights under the game's elite rules
 * (runtime/elites.ts: the page's own scripts), with their live spawns (an elite's respawn, the Imperial Bull's rivals) and the
 * roar's stun, and the Antler King on the boss row (runtime/king.ts: the page's own fight, combat/kingFight.ts, his prewarm
 * body, his thralls as live spawns). The page's day clock steps on the host (`useDayClock`). Not yet owned (fail-closed, see the SF72 handoff): the player's
 * weapons, the quest and its facts, and the entry proof; `finish` refuses.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  const bake = pineBake(), grid = pineTerrainGrid(assets.get(PINE_TERRAIN_ASSET)), navBytes = assets.get(PINE_NAVMESH_ASSET);
  const nav = navBytes === undefined ? null : parseNavmesh(buffer(navBytes));
  if (nav === null) throw new Error(`Pine headless needs its baked navmesh (${PINE_NAVMESH_ASSET})`);
  // this host configures no level and shifts nothing: the navmesh's queries stand in the bake's own (authored) frame
  nav.datum = () => 0;
  const heightAt = bakedSamplers(grid).heightAt;
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
    player: { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never a crossbow: the weapons are declared items (data/items.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  return { level, ports: { ground: false, heightAt }, install: (host, context) => { installPine(host, { bake, grid, nav, heightAt, spawnY: shard.spawn.y, saved: context.snapshot }); } };
};

export interface PineInstall {
  readonly bake: PineBake; readonly grid: BakedGrid; readonly nav: NonNullable<PineRosterPorts['nav']>; readonly heightAt: (x: number, z: number) => number;
  /** the level's authored spawn height (the manager's spawn ray) */
  readonly spawnY: number;
  /** a restoring host's decoded continuation (its live spawns are reinstalled at install) */
  readonly saved?: PineRosterPorts['saved'];
  /** PineDayNight's dusk / night, held by a test (absent: the host's day clock, the page's own) */
  readonly dusk?: () => number; readonly night?: () => number;
}

/** Install Pine's world, elites, King and roster on a host, in the page's order (the trusted runtime's `install`). */
export function installPine(host: SimHost, parts: PineInstall): { roster: ReturnType<typeof installPineRoster>; elites: ReturnType<typeof installPineElites>; king: ReturnType<typeof installPineKing> } {
  const { bake, grid, nav, heightAt } = parts;
  // the page's own day clock (look/dayKeys.ts PINE_DAY, as PineDayNight builds it), stepped by the host before every step and
  // restored from the snapshot's `day` (a restoring install installs it again); `SimLevel.day.start` starts a witness near dusk
  const day = host.useDayClock(new DayCycle(PINE_DAY));
  const dusk = parts.dusk ?? ((): number => day.dusk), night = parts.night ?? ((): number => day.night);
  // the roster's creature floor casts into this world at install, restoring too (the saved physics then replaces it)
  addPineWorld(host, bake);
  // the elites' step first (the page's elites tick before its creature manager), on the roster's lair bodies
  let roster: ReturnType<typeof installPineRoster> | null = null;
  const live = (): ReturnType<typeof installPineRoster> => { if (roster === null) throw new Error('Pine roster is not installed'); return roster; };
  const elites = installPineElites(host, { bodies: () => roster?.bodies() ?? [], heightAt, spawn: (kind, x, z, yaw, variant) => live().spawn(kind, x, z, yaw, variant),
    retire: a => { live().retire(a); }, dusk, night });
  // the King's steps next (the page ticks him after the elites, before its creature manager), before any live spawn
  const king = installPineKing(host, { heightAt, parked: () => live().parked(), adoptParked: (id, x, z, yaw) => live().adoptParked(id, x, z, yaw),
    spawn: (kind, x, z, yaw, variant) => live().spawn(kind, x, z, yaw, variant), retire: a => { live().retire(a); }, find: id => live().actor(id),
    night });
  roster = installPineRoster(host, { bake, grid, nav, spawnY: parts.spawnY, saved: parts.saved });
  elites.initialize();
  return { roster, elites, king };
}
