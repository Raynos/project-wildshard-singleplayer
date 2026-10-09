import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { parseNavmesh, type Navmesh } from '@wildshard/engine/physics/navmesh';
import { LOWERED_SEA } from '../world/sea';
import { driftwoodBake, driftwoodSpecs, type DriftwoodBake } from './baked';
import { installIsland } from './keeper';
import navmeshBaked from './navmesh.baked.json' with { type: 'json' };

/** The browser's baked navmesh (public/assets/baked/driftwood-isle/navmesh.bin), from its exact-bytes copy
 *  (scripts/bake-driftwood-navmesh.mjs), parsed by the engine's renderer-free navmesh module. */
export function driftwoodNavmesh(): Navmesh {
  const bytes = Uint8Array.from(atob(navmeshBaked.bytes), c => c.codePointAt(0) ?? 0), nav = parseNavmesh(bytes.buffer);
  if (nav === null) throw new Error('Driftwood navmesh copy does not parse');
  return nav;
}

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield (the
 *  sea cave's cut included) and the 2067 fixed WORLD colliders (cuboids, capsules and convex hulls) the page built. */
export function addDriftwoodWorld(host: SimHost, bake: DriftwoodBake): void {
  const { R, world } = host.physics, g = bake.ground;
  withOwner(host.scope, () => {
    const ground = world.createCollider(R.ColliderDesc.heightfield(255, 255, g.heights, g.scale).setTranslation(g.at.x, g.at.y, g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground, 'ground');
    bake.solids.forEach(solid => {
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0], solid.half[1], solid.half[2])
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 9 && solid.points !== undefined ? R.ColliderDesc.convexHull(solid.points) : null;
      if (desc === null) throw new Error(`Unbuildable baked Driftwood collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0], solid.at[1], solid.at[2]).setRotation({ x: solid.rot[0], y: solid.rot[1], z: solid.rot[2], w: solid.rot[3] })
        .setCollisionGroups(solid.groups).setFriction(solid.friction));
    });
  });
}

/**
 * Driftwood Isle's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the browser-baked native
 * world (the island's heightfield as Rapier built it and every fixed WORLD collider; `ground: false`, the baked floor as
 * the height query) and the island's 34 load-time creatures with their stream, floors, herds, decisions (the fauna by the
 * browser's baked navmesh), the monkeys' coconuts, the practice crab's return and exact restore (runtime/keeper.ts). Not yet
 * owned (fail-closed, see the SF72 handoff): the captain, the swords, the quest and its facts, and the entry proof; `finish` refuses.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard }) => {
  const bake = driftwoodBake(), specs = driftwoodSpecs(bake), heightAt = bake.floorAt, nav = driftwoodNavmesh();
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
    player: { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never a sword: the swords are declared items (data/items.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  return { level, ports: { ground: false, heightAt }, install: (host, context) => {
    if (!context.restoring) addDriftwoodWorld(host, bake);
    const island = installIsland(host, { bake, specs, seed: shard.identity.seed, waterLevel: LOWERED_SEA, spawnY: shard.spawn.y, nav }, context.snapshot);
    island.settle();
  } };
};
