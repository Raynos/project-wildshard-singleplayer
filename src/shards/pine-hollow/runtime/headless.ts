import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { parseNavmesh } from '@wildshard/engine/physics/navmesh';
import { bakedSamplers, parseBakedTerrain, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { PINE_GROUND_RES, pineBake, type PineBake, type PineSolid } from './baked';
import { installPineRoster, type PineRosterPorts } from './roster';
import { installPineElites } from './elites';
import { installPineKing } from './king';
import { installPineCrossbow } from './weapons/headlessCrossbow';
import { installPineLever } from './weapons/headlessLever';
import { installPineLongbow } from './weapons/headlessLongbow';
import { installPineLoadout, PINE_WEAPON, WEAPON_COMMAND } from './weapons/headlessLoadout';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { PINE_DAY } from '../look/dayKeys';
import { PINE_QUESTS } from '../data/quests';
import { installHollowQuest, pineSpots, PINE_INTERACT, type PineQuestPorts } from './quest';
import { isPineEdgeWall, provePineEntries } from './entries';

/** The native bakes the page reads before its herds, handed to the trusted runtime by path: the terrain grid (the hunting
 *  brain's ground, the bodies' ground follow) and the navmesh (the brain's paths). Pine's shardfile admits no assets. */
export const PINE_TERRAIN_ASSET = 'public/assets/baked/pine-hollow/terrain.bin', PINE_NAVMESH_ASSET = 'public/assets/baked/pine-hollow/navmesh.bin';

const buffer = (bytes: Uint8Array): ArrayBuffer => { const copy = new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes); return copy; };

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield (the
 *  crag cave's cuts included) and the 2082 solid WORLD colliders the page built (cuboids, capsules, meshes, convex hulls).
 *  `skip` leaves solids out (the entry proof's grid world: the standalone page's four edge walls, `isPineEdgeWall`). */
export function addPineWorld(host: SimHost, bake: PineBake, skip?: (solid: PineSolid) => boolean): void {
  const { R, world } = host.physics, g = bake.ground, n = PINE_GROUND_RES - 1;
  withOwner(host.scope, () => {
    const ground = world.createCollider(R.ColliderDesc.heightfield(n, n, g.heights, g.scale).setTranslation(g.at.x, g.at.y, g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground, 'ground');
    bake.solids.forEach(solid => {
      if (skip?.(solid) === true) return;
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
 * body, his thralls as live spawns, his record on the shard's flags, a fallen King's next night, his damage rule), and
 * the player's three weapons as real projectile items (runtime/weapons/: a command's attack pulls the held crossbow's or
 * lever-action's trigger at that body, its HEAVY hold draws the longbow, a `pine.weapon` script command swaps), and the
 * Warden's Hollow (runtime/quest.ts: its declared rows and every beat's prompt at the page's baked point, by `pine.interact`
 * script commands; the stag's walk; Hale's night and the dawn on the host's day clock; its feats' facts). The page's day
 * clock steps on the host (`useDayClock`). The entry proof (runtime/entries.ts) walks a real capsule through all 92 lanes of
 * the grid's world (the scatter keeps the entry canyons clear, world/entryLanes.ts).
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets, rapier }) => {
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
  return { level, ports: { ground: false, heightAt }, proveEntries: () => {
    // on a fresh host of the grid's world (the bake without the standalone edge walls), its query pipeline built by a step
    const fresh = createSimHost(level, { ground: false, heightAt, rapier });
    try { addPineWorld(fresh, bake, isPineEdgeWall); fresh.step(); return provePineEntries(fresh.physics, shard.entryways, heightAt); } finally { fresh.dispose(); }
  }, install: (host, context) => {
    installPine(host, { bake, grid, nav, heightAt, spawnY: shard.spawn.y, saved: context.snapshot, quests: shard.quests, fact: (name, actorId) => { context.emit({ kind: 'fact', name, actorId }); },
      // a player command's attack pulls the held weapon's trigger at that body; its HEAVY hold draws the longbow; a
      // `pine.weapon` script command picks a weapon (the tick's last)
      shots: () => context.commands().flatMap(command => command.kind === 'player' && command.attack !== undefined ? [command.attack.targetId] : []),
      heavy: () => { const held = context.commands().find(command => command.kind === 'player' && command.heavy !== undefined); return held?.kind === 'player' ? held.heavy ?? null : null; },
      pick: () => context.commands().reduce<number | null>((pick, command) => command.kind === 'script' && command.actorId === WEAPON_COMMAND ? command.value : pick, null),
      // a `pine.interact` script command presses a quest prompt (runtime/quest.ts PINE_ACT)
      interact: () => context.commands().flatMap(command => command.kind === 'script' && command.actorId === PINE_INTERACT ? [command] : []) });
  } };
};

export interface PineInstall {
  readonly bake: PineBake; readonly grid: BakedGrid; readonly nav: NonNullable<PineRosterPorts['nav']>; readonly heightAt: (x: number, z: number) => number;
  /** the level's authored spawn height (the manager's spawn ray) */
  readonly spawnY: number;
  /** a restoring host's decoded continuation (its live spawns are reinstalled at install) */
  readonly saved?: PineRosterPorts['saved'];
  /** PineDayNight's dusk / night, held by a test (absent: the host's day clock, the page's own) */
  readonly dusk?: () => number; readonly night?: () => number;
  /** the platform's fact effect (the Antler King's fall files his ledger fact) */
  readonly fact?: (name: string, entity: string) => void;
  /** the tick's trigger pulls on the held weapon (the bodies they are aimed at; absent: none) */
  readonly shots?: () => readonly string[];
  /** the tick's HEAVY hold (the longbow's draw; null when up; absent: never held) */
  readonly heavy?: () => { readonly targetId?: string | undefined } | null;
  /** the tick's weapon pick (a PINE_ITEMS slot; null: none; absent: never) */
  readonly pick?: () => number | null;
  /** the shard's declared quest rows (absent: PINE_QUESTS, the shardfile's own) */
  readonly quests?: PineQuestPorts['quests'];
  /** the tick's quest prompt presses (`pine.interact` script commands; absent: none) */
  readonly interact?: () => readonly { readonly actorId: string; readonly value: number }[];
}

/** Install Pine's world, elites, King and roster on a host, in the page's order (the trusted runtime's `install`). */
export function installPine(host: SimHost, parts: PineInstall): {
  roster: ReturnType<typeof installPineRoster>; elites: ReturnType<typeof installPineElites>; king: ReturnType<typeof installPineKing>; crossbow: ReturnType<typeof installPineCrossbow>;
  lever: ReturnType<typeof installPineLever>; longbow: ReturnType<typeof installPineLongbow>; loadout: ReturnType<typeof installPineLoadout>;
  quest: ReturnType<typeof installHollowQuest>;
} {
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
    spawn: (kind, x, z, yaw, variant) => live().spawn(kind, x, z, yaw, variant), spawnLoose: (kind, x, z, yaw, variant) => live().spawnLoose(kind, x, z, yaw, variant),
    retire: a => { live().retire(a); }, find: id => live().actor(id), night, ...(parts.fact === undefined ? {} : { fact: parts.fact }) });
  // the player's loadout and weapons, locked through the King's intro: installed before the roster (a restoring roster
  // reinstalls its live spawns at install, and the host keeps every step in registration order), so their shots fly before
  // the creatures move this tick where the page's weapons update after them (a tick's lag on a moving body); the loadout
  // steps first (the page's EquipmentService swaps, then updates every weapon)
  const shots = parts.shots ?? ((): readonly string[] => []), heavy = parts.heavy ?? ((): null => null), pick = parts.pick ?? ((): null => null);
  // the quest (installed after the weapons) stows the weapons for the zipline's ride, and its lever-action pickup selects the rifle
  let quest: ReturnType<typeof installHollowQuest> | null = null;
  const loadout = installPineLoadout(host, { locked: () => king.locked() || (quest?.riding() ?? false),
    pick: () => { const picked = pick(), took = quest?.takeRifle() ?? false; return picked ?? (took ? PINE_WEAPON.lever : null); } });
  // the bodies a bolt can hit: every host body (the roster's list, a fight's own), one buffer refilled a tick
  const bodyBuffer: AnimalSim[] = [];
  const bodies = (): readonly AnimalSim[] => { bodyBuffer.length = 0; host.entities.forEach(body => { bodyBuffer.push(body); }); return bodyBuffer; };
  const crossbow = installPineCrossbow(host, { shots, enabled: () => loadout.live(PINE_WEAPON.crossbow), bodies });
  const lever = installPineLever(host, { shots, enabled: () => loadout.live(PINE_WEAPON.lever), bodies });
  const longbow = installPineLongbow(host, { heavy, enabled: () => loadout.live(PINE_WEAPON.longbow), bodies });
  // the Warden's Hollow: its declared rows, the page's prompts at their baked points, Hale's clock on the host's day clock;
  // before the roster too (its steps keep their place ahead of any live spawn's, restoring as booting)
  quest = installHollowQuest(host, { quests: parts.quests ?? PINE_QUESTS, spots: pineSpots(), commands: parts.interact ?? ((): readonly never[] => []),
    fact: parts.fact ?? ((): void => undefined), coins: (): void => undefined, day: () => day, night });
  roster = installPineRoster(host, { bake, grid, nav, spawnY: parts.spawnY, saved: parts.saved });
  elites.initialize();
  return { roster, elites, king, crossbow, lever, longbow, loadout, quest };
}
