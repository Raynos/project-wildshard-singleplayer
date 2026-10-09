import * as v from 'valibot';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan, HeadlessRuntimePreparation, PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, createSimHost, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { addPiece } from '@wildshard/engine/physics/pieces';
import { floorBelow } from '@wildshard/engine/physics/query';
import type { Material } from '@wildshard/engine/physics/surface';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';
import { installDeclaredPropColliders } from '@wildshard/engine/physics/declaredProps';
import { propColliderDescriptors } from '@wildshard/game/shardfile/props';
import { socketLiftEntries } from '@wildshard/game/shardfile/socketLift';
import { proveSocketLift } from '@wildshard/game/shardfile/socketLiftProof';
import { DECK, SPAWN } from '../layout';
import { DRIFT_RAY_VARIANTS, SKY_GOAT_VARIANTS, STORM_ROC_VARIANTS } from './variants';
import { GALE_WISP } from '../species/galeWisp';
import { installSkyFlock, SKY_ANALYTIC_FLOOR } from './flock';
import { installSkyRoc } from './roc';
import { ROC_ID } from './rocEncounter';
import { FAN_ACT, FAN_ACTOR, FAN_AIM, installSkyFan, type FanCommand } from './fan';
import { installSkyMovers, verifiedMoverModules, type SkyMovers } from './headlessMovers';
import { installSkyQuest, skyWinchPermission } from './quest';
import { WINCH_BRIDGE } from './moverRows';
import baked from './physics.baked.json' with { type: 'json' };

const finite = v.pipe(v.number(), v.finite());
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.optional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }),
  flight: v.optional(v.strictObject({ altitude: finite, above: v.optional(v.picklist(['ground', 'world'])), climbRate: finite, diveRate: finite, lockRange: v.optional(finite), bank: v.optional(finite) })) });
const Quat = v.strictObject({ x: finite, y: finite, z: finite, w: finite });
const Placed = { x: finite, y: finite, z: finite, yaw: v.optional(finite), rot: v.optional(Quat), surface: v.optional(v.string()) };
/** One baked native collider piece (scripts/bake-sky-physics.mjs): boxes and convex hulls, as the world registers them. */
const BakedPiece = v.strictObject({ id: v.string(), name: v.string(), category: v.picklist(['buildings', 'nature', 'props', 'ground']), file: v.string(),
  active: v.boolean(), surface: v.string(), colliders: v.array(v.union([
    v.strictObject({ kind: v.literal('box'), ...Placed, hx: finite, hy: finite, hz: finite }),
    v.strictObject({ kind: v.literal('hull'), ...Placed, points: v.array(finite) })])) });

/** The baked native specs by kind (scripts/bake-sky-physics.mjs); every body of a kind shares one recipe. */
export function skySpecs(): ReadonlyMap<string, AnimalSimSpec> {
  const specs = new Map<string, AnimalSimSpec>();
  baked.actors.forEach(actor => {
    const { flight, lockable, ...rest } = v.parse(BakedSpec, actor.spec);
    const spec: AnimalSimSpec = { ...rest, ...(lockable === undefined ? {} : { lockable }),
      ...(flight === undefined ? {} : { flight: { altitude: flight.altitude, climbRate: flight.climbRate, diveRate: flight.diveRate,
        ...(flight.above === undefined ? {} : { above: flight.above }), ...(flight.lockRange === undefined ? {} : { lockRange: flight.lockRange }),
        ...(flight.bank === undefined ? {} : { bank: flight.bank }) } }) };
    const known = specs.get(spec.kind);
    if (known !== undefined && JSON.stringify(known) !== JSON.stringify(spec)) throw new Error(`Divergent native Sky spec ${spec.kind}`);
    specs.set(spec.kind, spec);
  });
  return specs;
}
/** Each kind's variant scale range (the species rows' one variant each): the manager's first draw. */
export function skyScaleRanges(): ReadonlyMap<string, readonly [number, number]> {
  const rows = [['driftRay', DRIFT_RAY_VARIANTS], ['skyGoat', SKY_GOAT_VARIANTS], ['galeWisp', GALE_WISP.variants], ['stormRoc', STORM_ROC_VARIANTS]] as const;
  return new Map(rows.map(([kind, variants]) => {
    const variant = variants[0]; if (variant === undefined || variants.length !== 1) throw new Error(`Sky species ${kind} has one variant`);
    return [kind, variant.scale] as const;
  }));
}

/**
 * Sky Reach's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). A structures-only world: no terrain
 * collider (`ground: false`), the analytic placement floor at -1000 m, and every island, rope bridge, dock, lip and prop
 * the browser registers, from the browser-baked native colliders (inactive ones, the hover decks, the updraft and the
 * fallen crown bridge, stay out), with the host's layered WORLD floor queries for flight and falls. Owns the 13 declared
 * bodies and their shipping policies (runtime/flock.ts) and the Storm Roc's encounter (runtime/roc.ts: BossBrain, its
 * fact and purse) and the War Fan (runtime/fan.ts: the browser fan's own move recipe; a `player.attack` is its light
 * SWING, `far.fan` script commands its HEAVY and GUST at the `far.fan.aim` pitch; locked through the Roc's intro) and the
 * quest (runtime/quest.ts: its four steps, its fact and 10 coins once). Not yet owned (fail-closed, see the SF72 handoff):
 * the movers in the played host (islet lifts, winch bridge: a native restore re-parents every parentless static collider
 * to rigid body 0, Rapier's `coParent` miss, so a capsule on a static deck anchors to the first mover body; the engine fix
 * is the handoff's), so the crown is not yet reachable by play and the quest's winch step never completes there; a fresh
 * (never restored) host runs the same assembly with the movers (`prepareSkyRuntime(...).installWithMovers`). `finish`
 * proves all four Rising Islet entries by a real capsule traversal on fresh hosts of this world with the movers on their
 * admitted modules (runtime/headlessMovers.ts).
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async (input) => (await prepareSkyRuntime(input)).plan;

/** Sky's prepared runtime: the SDK plan, and the same install with the movers for fresh (never restored) hosts. */
export interface SkyRuntime {
  readonly plan: HeadlessRuntimePlan;
  /** The played install plus the islet and winch movers (the quest's winch drives the bridge); refuses a restore until the engine's restore-parent fix. */
  readonly installWithMovers: (host: SimHost, context: HeadlessRuntimeInstallation) => SkyMovers;
}
export async function prepareSkyRuntime({ shard, assets, rapier }: HeadlessRuntimePreparation): Promise<SkyRuntime> {
  if (shard.terrain !== null) throw new Error('Sky Reach is a structures-only world');
  // the islet and bridge modules, admitted in shard.config.ts `files`, hash-checked once here (install is synchronous)
  const modules = await verifiedMoverModules(assets);
  const specs = skySpecs(), ranges = skyScaleRanges(), pieces = baked.pieces.map(piece => v.parse(BakedPiece, piece));
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: SKY_ANALYTIC_FLOOR },
    // the shipping spawn (manifest `spawn`, layout SPAWN) standing on Sunrest's deck, not the shardfile's grid datum
    player: { at: { x: SPAWN.x, y: DECK, z: SPAWN.z }, yaw: SPAWN.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never the War Fan: the fan is a declared item (data/items.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  const colliders = (host: SimHost): void => {
    pieces.forEach(piece => {
      if (!piece.active) return;
      addPiece(host.physics, { id: piece.id, name: piece.name, category: piece.category, file: piece.file, surface: surface(piece.surface), colliderOwner: piece.id,
        colliders: piece.colliders.map(c => {
          const placed = { x: c.x, y: c.y, z: c.z, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), ...(c.rot === undefined ? {} : { rot: c.rot }), ...(c.surface === undefined ? {} : { surface: surface(c.surface) }) };
          return c.kind === 'box' ? { kind: 'box' as const, ...placed, hx: c.hx, hy: c.hy, hz: c.hz } : { kind: 'hull' as const, ...placed, points: new Float32Array(c.points) };
        }) });
    });
  };
  const ports = { ground: false, heightAt: () => SKY_ANALYTIC_FLOOR } as const;
  const play = (host: SimHost, context: HeadlessRuntimeInstallation, withMovers: boolean): SkyMovers | null => {
    if (!context.restoring) colliders(host);
    host.setFloorQuery((x, z, fromY, maxDrop) => floorBelow(host.physics, x, z, fromY, maxDrop));
    const movers = withMovers ? installSkyMovers(host, modules, context.restoring, () => skyWinchPermission(host.flags)) : null;
    const flock = installSkyFlock(host, { specs, ranges, seed: shard.identity.seed }, context.snapshot);
    const roc = flock.bodies().find(body => body.id === ROC_ID), body = roc?.brain?.roc ?? null;
    if (roc?.actor === null || roc?.actor === undefined || body === null) throw new Error('Sky Reach declares the Storm Roc\'s body');
    const encounter = installSkyRoc(host, { roc: roc.actor, body, fact: (name, actorId) => { context.emit({ kind: 'fact', name, actorId }); },
      coins: (amount, actorId) => { context.emit({ kind: 'coins', amount, actorId }); } });
    // the browser disables the player's weapons through the Roc's intro (BossPorts.lockInput)
    installSkyFan(host, () => encounter.locked() ? [] : context.commands().flatMap((command): FanCommand[] => {
      if (command.kind === 'player') return command.attack === undefined ? [] : [{ kind: 'swing', targetId: command.attack.targetId }];
      if (command.kind === 'script' && command.actorId === FAN_AIM) return [{ kind: 'aim', pitch: command.value }];
      if (command.kind !== 'script' || command.actorId !== FAN_ACTOR) return [];
      return command.value === FAN_ACT.heavy ? [{ kind: 'heavy' }] : command.value === FAN_ACT.gust ? [{ kind: 'gust' }] : [];
    }));
    installSkyQuest(host, { quests: shard.quests, fact: (name, actorId) => { context.emit({ kind: 'fact', name, actorId }); },
      coins: (amount, actorId) => { context.emit({ kind: 'coins', amount, actorId }); },
      commands: () => context.commands().flatMap(command => command.kind === 'script' ? [command] : []),
      winch: movers === null ? null : { command: () => { movers.runtime.command(WINCH_BRIDGE, 1); }, raised: () => movers.runtime.pose(WINCH_BRIDGE).enabled } });
    flock.land();
    return movers;
  };
  const installWithMovers = (host: SimHost, context: HeadlessRuntimeInstallation): SkyMovers => {
    if (context.restoring) throw new Error('Sky Reach restores its movers only after the engine restore-parent fix');
    const movers = play(host, context, true); if (movers === null) throw new Error('Sky Reach movers were not installed');
    return movers;
  };
  const plan: HeadlessRuntimePlan = { level, ports, install: (host, context) => { play(host, context, false); }, proveEntries: () => {
    // Every Rising Islet entry on a fresh host of this same world (the baked colliders, the movers), plus what the grid
    // adds around a cell: the road's entry socket decks and the shardfile's declared landing / gate-isle colliders. The
    // platform's socket-lift proof walks a real capsule in from the road, boards, rides, walks the onward route, calls both
    // stops and probes the closed road gate across all 23 lanes, on actual fixed steps of the host.
    let lanes = 0, steps = 0, liftRides = 0, liftCalls = 0;
    socketLiftEntries(shard.entryways).forEach(entry => {
      const fresh = createSimHost(level, { ...ports, rapier });
      try {
        colliders(fresh);
        installEntrySockets(fresh.physics, fresh.scope, [{ x: 0, z: 0 }]);
        installDeclaredPropColliders(shard.props === null ? [] : propColliderDescriptors(shard.props), () => fresh.physics, fresh.scope);
        const movers = installSkyMovers(fresh, modules, false, () => 0);
        const proof = proveSocketLift(entry, { physics: fresh.physics, runtime: movers.runtime, approachSource: shard,
          fixedStep: () => { fresh.step(); if (movers.failures() !== 0) throw new Error('Sky Reach mover script call failed'); } });
        lanes += 23; steps += proof.steps; liftRides += proof.rides; liftCalls += proof.calls;
      } finally { fresh.dispose(); }
    });
    return { lanes, steps, liftRides, liftCalls };
  } };
  return { plan, installWithMovers };
}
const SURFACES: readonly Material[] = ['wood', 'metal', 'stone', 'grass'];
function surface(value: string): Material {
  const known = SURFACES.find(name => name === value); if (known === undefined) throw new Error(`Unknown baked surface ${value}`); return known;
}
