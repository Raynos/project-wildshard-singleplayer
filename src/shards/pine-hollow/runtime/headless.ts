import { installNativeItems, observeNativeCombatMotion, type NativeCombatFrame, type NativeBoltItem, type NativeBowItem, type NativeCycleItem } from '@wildshard/game/plugin/nativeItems';
import type { ShardItems } from '@wildshard/format/items';
import { PINE_TERRAIN } from '../data/terrainBindings';
import * as v from 'valibot';
import { BowWeaponProfileSchema, parseNativeFirearmProfile } from '@wildshard/format/weaponProfiles';
import { bindHeadlessCommands, installNativeCollision, type PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { createSimHost, type SimHost } from '@wildshard/engine/sim';
import { readNavmesh } from '@wildshard/engine/physics/navmesh';
import { bakedSamplers, parseBakedTerrain, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { PINE_GROUND_RES, pineBake, type PineBake, type PineSolid } from './baked';
import { preparePineDirector } from './directorClock';
import { preparePineNightDirector } from './nightDirector';
import type { DirectorLane } from '@wildshard/game/plugin/director';
import { installPineRoster, type PineRosterPorts } from './roster';
import { installPineElites } from './elites';
import { installPineKing, KING_RECORD } from './king';
import { AIM_COMMAND, AIM_MIDDLE, aimShare } from './weapons/headlessRanged';
import { bindNativeLoadout, trustedLevel } from '@wildshard/game/plugin/simulation';
import { PINE_NATIVE_LOADOUT, PINE_WEAPON, WEAPON_COMMAND, LOADOUT_STEP, LEVER_FLAG } from '../data/nativeLoadout';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { PINE_DAY } from '../look/dayKeys';
import { PINE_QUESTS } from '../data/quests';
import { installHollowQuest, pineSpots, PINE_INTERACT, type PineQuestPorts } from './quest';
import { isStandaloneEdgeWall } from '@wildshard/engine/physics/terrain';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import ENTRY_WALK from '../data/entryWalk.json' with { type: 'json' }; // the entry proof's capsule walk, walk m in from each edge
import { installPineAir } from './air';
import { installPineRainShelter } from './rainShelter';
import { PineAmmunition } from './weapons/ammunition';
import { installPineNight } from './nightPopulation';
import { PINE_LODGE } from './lodge';
import type { PineWeatherMode } from '../world/weatherProfile';

/** The native bakes the page reads before its herds, handed to the trusted runtime by path: the terrain grid (the hunting
 *  brain's ground, the bodies' ground follow) and the navmesh (the brain's paths). Pine's shardfile admits no assets. */
export const PINE_TERRAIN_ASSET = PINE_TERRAIN.terrain, PINE_NAVMESH_ASSET = PINE_TERRAIN.navmesh;

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield (the
 *  crag cave's cuts included) and the 2082 solid WORLD colliders the page built (cuboids, capsules, meshes, convex hulls).
 *  `skip` leaves solids out (the entry proof's grid world: the standalone page's four edge walls, `isStandaloneEdgeWall`). */
export function addPineWorld(host: SimHost, bake: PineBake, skip?: (solid: PineSolid) => boolean): ReadonlyMap<string, object | string> {
  return installNativeCollision(host,bake,{resolution:PINE_GROUND_RES,...(skip===undefined?{}:{skip}),provenance:{field:'pineWorldOwner',step:'pine.world-tags',fallback:'wood'}});
}

/** The page's terrain grid from its trusted bytes, refused unless it is Pine's own 256² lattice over the 500 m chunk. */
export function pineTerrainGrid(bytes: Uint8Array | undefined): BakedGrid {
  const grid = bytes === undefined ? null : parseBakedTerrain(bytes, PINE_TERRAIN);
  if (grid === null) throw new Error(`Pine headless needs its baked terrain grid (${PINE_TERRAIN_ASSET})`);
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
 * the grid's world (the scatter keeps the entry canyons clear, generators/propRows.ts).
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async ({ shard, assets, rapier }) => {
  const row = shard.items.rows.find(item => item.id === 'weapon.longbow');
  if (row?.kind !== 'weapon' || row.family !== 'bow') throw new Error('Missing admitted Pine bow profile');
  v.parse(BowWeaponProfileSchema, row.profile);
  const crossbowRow = shard.items.rows.find(item => item.id === 'weapon.crossbow');
  if (crossbowRow?.kind !== 'weapon' || crossbowRow.family !== 'firearm') throw new Error('Missing admitted Pine crossbow profile');
  parseNativeFirearmProfile(crossbowRow.profile, 'bolt');
  const leverRow = shard.items.rows.find(item => item.id === 'weapon.lever');
  if (leverRow?.kind !== 'weapon' || leverRow.family !== 'firearm') throw new Error('Missing admitted Pine lever profile');
  parseNativeFirearmProfile(leverRow.profile, 'lever');
  const director = await preparePineDirector(), nightDirector = await preparePineNightDirector();
  const bake = pineBake(), grid = pineTerrainGrid(assets.get(PINE_TERRAIN_ASSET)), navBytes = assets.get(PINE_NAVMESH_ASSET);
  const nav = readNavmesh(navBytes, `Pine headless needs its baked navmesh (${PINE_NAVMESH_ASSET})`, () => 0);
  const heightAt = bakedSamplers(grid).heightAt;
  const level = trustedLevel(shard, { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z },
    yaw: shard.spawn.yaw, speed: 5 }, { size: 500, height: 0 });
  return { level, ports: { ground: false, heightAt }, proveEntries: () => {
    // on a fresh host of the grid's world (the bake without the standalone edge walls), its query pipeline built by a step
    const fresh = createSimHost(level, { ground: false, heightAt, rapier });
    try { addPineWorld(fresh, bake, isStandaloneEdgeWall); fresh.step(); return proveTerrainEntries(fresh.physics, shard.entryways, heightAt, ENTRY_WALK); } finally { fresh.dispose(); }
  }, install: (host, context) => {
    const input = bindHeadlessCommands(context), combat = context.combat;
    if (combat === undefined) throw new Error('Pine requires its native combat frame');
    installPine(host, { bake, grid, nav, heightAt, director, nightDirector, combat, items: shard.items, modes: shard.modes ?? { traverse: [] }, spawnY: shard.spawn.y, saved: context.snapshot, quests: shard.quests, fact: input.ledger.fact,
      interact: input.scripts([PINE_INTERACT, PINE_LODGE]) });
  } };
};

export interface PineInstall {
  readonly combat: NativeCombatFrame; readonly items: ShardItems;
  readonly modes: PineQuestPorts['modes'];
  /** Already admitted module factory; each installed quest consumes its own fresh author state. */
  readonly director: () => DirectorLane;
  /** Independent admitted night population handler; placement and roster owners remain native. */
  readonly nightDirector: () => DirectorLane;
  readonly bake: PineBake; readonly grid: BakedGrid; readonly nav: NonNullable<PineRosterPorts['nav']>; readonly heightAt: (x: number, z: number) => number;
  /** the level's authored spawn height (the manager's spawn ray) */
  readonly spawnY: number;
  /** a restoring host's decoded continuation (its live spawns are reinstalled at install) */
  readonly saved?: PineRosterPorts['saved'];
  /** PineDayNight's dusk / night, held by a test (absent: the host's day clock, the page's own) */
  readonly dusk?: () => number; readonly night?: () => number;
  /** Match the phone or desktop population limit; absent is the native phone tier. */
  readonly nightMax?: 3 | 4;
  /** Explicit native input setting; absent is the page's ordinary live weather. */
  readonly weatherMode?: PineWeatherMode;
  /** the platform's fact effect (the page feat law files committed flags and creature deaths) */
  readonly fact?: (name: string, entity: string) => void;
  /** the shard's declared quest rows (absent: PINE_QUESTS, the shardfile's own) */
  readonly quests?: PineQuestPorts['quests'];
  /** the tick's quest prompt presses (`pine.interact` script commands; absent: none) */
  readonly interact?: () => readonly { readonly actorId: string; readonly value: number }[];
}

/** Install Pine's world, elites, King and roster on a host, in the page's order (the trusted runtime's `install`). */
export function installPine(host: SimHost, parts: PineInstall): {
  roster: ReturnType<typeof installPineRoster>; elites: ReturnType<typeof installPineElites>; king: ReturnType<typeof installPineKing>; crossbow: NativeBoltItem;
  lever: NativeCycleItem; longbow: NativeBowItem; loadout: ReturnType<typeof bindNativeLoadout<0 | 1 | 2>>;
  quest: ReturnType<typeof installHollowQuest>;
  air: ReturnType<typeof installPineAir>;
  thralls: ReturnType<typeof installPineNight>;
  ammunition: PineAmmunition;
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
  let quest: ReturnType<typeof installHollowQuest> | null = null;
  const installedRoster = (): ReturnType<typeof installPineRoster> => { if (roster === null) throw new Error('Pine roster is not installed'); return roster; };
  const noBodies: ReturnType<ReturnType<typeof installPineRoster>['bodies']> = [];
  const elites = installPineElites(host, { bodies: () => roster?.bodies() ?? noBodies, heightAt, spawn: (kind, x, z, yaw, variant) => installedRoster().spawn(kind, x, z, yaw, variant),
    retire: a => { installedRoster().retire(a); }, dusk, night });
  // the King's steps next (the page ticks him after the elites, before its creature manager), before any live spawn
  const king = installPineKing(host, { heightAt, parked: () => installedRoster().parked(), adoptParked: (id, x, z, yaw) => installedRoster().adoptParked(id, x, z, yaw),
    spawn: (kind, x, z, yaw, variant) => installedRoster().spawn(kind, x, z, yaw, variant), spawnLoose: (kind, x, z, yaw, variant) => installedRoster().spawnLoose(kind, x, z, yaw, variant),
    retire: a => { installedRoster().retire(a); }, find: id => installedRoster().actor(id), night,
    grantTrophy: () => { if (quest === null) throw new Error('Pine quest pack is not installed'); quest.pack.add('amber-resin', 3); } });
  // the player's loadout and weapons, locked through the King's intro: installed before the roster (a restoring roster
  // reinstalls its live spawns at install, and the host keeps every adapter in registration order). Their afterBodies
  // work follows the creature manager, as on the page; the loadout swaps before every weapon updates. The roster's King
  // publication comes last, matching render propagation after equipment's cached-pose queries.
  const frame = parts.combat;
  // the quest (installed after the weapons) stows the weapons for the zipline's ride, and its lever-action pickup selects the rifle
  const loadout = bindNativeLoadout(host, PINE_NATIVE_LOADOUT, {
    owned: slot => slot === PINE_WEAPON.crossbow || (slot === PINE_WEAPON.lever && host.flags.has(LEVER_FLAG))
      || (slot === PINE_WEAPON.longbow && host.flags.has(KING_RECORD.paid)),
    locked: () => king.locked() || (quest?.riding() ?? false) || (quest?.talking() ?? false),
    step: { id: LOADOUT_STEP, phase: 'afterBodies', pick: () => {
      const picked = frame.scripts.get(WEAPON_COMMAND) ?? null, took = quest?.takeRifle() ?? false;
      return picked ?? (took ? PINE_WEAPON.lever : null);
    } },
  });
  // Input is published after the loadout swap and before all three item owners, in their original order.
  host.onStep('pine.combat-input', () => {
    frame.aim = aimShare(frame.scripts.get(AIM_COMMAND) ?? AIM_MIDDLE); frame.live.clear();
    for (let index = 0; index < 32; index++) { const slot = PINE_NATIVE_LOADOUT.slots[index]; if (slot === undefined) break; if (loadout.live(slot)) frame.live.add(slot); }
  }, undefined, 'afterBodies');
  observeNativeCombatMotion(host, frame, 7.2);
  let air: ReturnType<typeof installPineAir> | null = null;
  const atmosphere = (): ReturnType<typeof installPineAir> => { if (air === null) throw new Error('Pine air is not installed'); return air; };
  const declared = (id: string) => {
    const item = parts.items.rows.find(row => row.id === id);
    if (item?.kind !== 'weapon' || item.ranged === undefined || item.profile === undefined) throw new Error('Missing native ranged item row');
    return { policy: item.ranged, profile: item.profile };
  };
  const crossbow = installNativeItems(host, frame, { kind: 'bolt', ...declared('weapon.crossbow') });
  const lever = installNativeItems(host, frame, { kind: 'cycle', ...declared('weapon.lever') });
  const longbow = installNativeItems(host, frame, { kind: 'bow', ...declared('weapon.longbow') });
  const ammunitionOwner = new PineAmmunition({ crossbow, lever, longbow }, frame);
  host.onStep('pine.ammunition', () => { ammunitionOwner.update(); }, undefined, 'afterBodies');
  host.events.on('player.died', () => { ammunitionOwner.loadKind('iron'); }, host.scope);
  // the Warden's Hollow: its declared rows, the page's prompts at their baked points, Hale's clock on the host's day clock;
  // before the roster too (its steps keep their place ahead of any live spawn's, restoring as booting)
  quest = installHollowQuest(host, { director: parts.director(), quests: parts.quests ?? PINE_QUESTS, modes: parts.modes, spots: pineSpots(), commands: parts.interact ?? ((): readonly never[] => []),
    fact: parts.fact ?? ((): void => undefined), coins: (): void => undefined, addBolts: crossbow.addBolts, day: () => day, night,
    takeKingReward: eye => king.takeReward(eye), ammunition: ammunitionOwner, canSelectAmmo: () => loadout.live(PINE_WEAPON.crossbow) });
  // The page's quest frame advances the stag, then night thralls, before the creature manager. Late-bound roster
  // ports keep callbacks and restore adapters in that same order even when the population adds live bodies.
  const thralls = installPineNight(host, parts.nightDirector(), { night, heightAt, spawn: (kind, x, z, yaw, variant) => installedRoster().spawn(kind, x, z, yaw, variant),
    retire: actor => { installedRoster().retire(actor); }, find: id => installedRoster().actor(id), ...(parts.nightMax === undefined ? {} : { max: parts.nightMax }) });
  air = installPineAir(host, () => day.phase, parts.weatherMode, frame);
  const shelter = installPineRainShelter(host, () => roster?.hunt.herds ?? [], bake.shelterTrees, () => atmosphere().weather.rain);
  roster = installPineRoster(host, { bake, grid, nav, spawnY: parts.spawnY, saved: parts.saved,
    wanderGoal: herd => shelter.wanderGoal(herd, atmosphere().weather.rain) });
  elites.initialize();
  return { roster, elites, king, crossbow, lever, longbow, loadout, quest, air, thralls, ammunition: ammunitionOwner };
}
