import * as v from 'valibot';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { addBakedTerrainCollider } from '@wildshard/engine/physics/terrainTiles';
import { addPiece } from '@wildshard/engine/physics/pieces';
import type { Material } from '@wildshard/engine/physics/surface';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';
import { SCOUT_FLAG } from '../data/flags';
import { installSignalHomes } from './homes';
import { installSignalWhip, WHIP_ID, type WhipCommand } from './whip';
import baked from './physics.baked.json' with { type: 'json' };

/** `fight.attackers` in manifest.ts (E297); the headless test holds the two equal (the manifest itself imports views). */
export const SIGNAL_ATTACKERS = 2;

const finite = v.pipe(v.number(), v.finite());
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.optional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }),
  flight: v.optional(v.strictObject({ altitude: finite, above: v.optional(v.picklist(['ground', 'world'])), climbRate: finite, diveRate: finite, lockRange: v.optional(finite), bank: v.optional(finite) })) });

/** The baked native specs by kind (scripts/bake-signal-physics.mjs); every home of a kind shares one recipe. */
export function signalSpecs(): ReadonlyMap<string, AnimalSimSpec> {
  const specs = new Map<string, AnimalSimSpec>();
  [...baked.actors, ...baked.bosses].forEach(actor => {
    const { flight, lockable, ...rest } = v.parse(BakedSpec, actor.spec);
    const spec: AnimalSimSpec = { ...rest, ...(lockable === undefined ? {} : { lockable }),
      ...(flight === undefined ? {} : { flight: { altitude: flight.altitude, climbRate: flight.climbRate, diveRate: flight.diveRate,
        ...(flight.above === undefined ? {} : { above: flight.above }), ...(flight.lockRange === undefined ? {} : { lockRange: flight.lockRange }),
        ...(flight.bank === undefined ? {} : { bank: flight.bank }) } }) };
    const known = specs.get(actor.kind);
    if (spec.kind !== actor.kind || (known !== undefined && JSON.stringify(known) !== JSON.stringify(spec))) throw new Error(`Divergent native Signal spec ${actor.kind}`);
    specs.set(actor.kind, spec);
  });
  return specs;
}

/**
 * Signal Dunes' renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the admitted terrain
 * collider and heights, the browser-baked native colliders, and the 13 declared homes with their shipping policies,
 * creature stream, attack tokens and respawn clocks, and the whip as its declared item row (a player command's attack is
 * its light crack). Not yet owned (fail-closed, see the SF72 handoff): the signal quest's interactions, the Matriarch
 * encounter and the entry proof; `finish` refuses.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  if (shard.terrain === null) throw new Error('Signal Dunes declares its admitted terrain collider');
  const bytes = assets.get(shard.terrain.collider);
  if (bytes === undefined) throw new Error('Missing admitted Signal terrain collider');
  const terrain = decodeTerrainTile(bytes), heightAt = (x: number, z: number): number => terrainTileHeight(terrain, x, z), specs = signalSpecs();
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
    player: { at: { x: shard.spawn.x, y: heightAt(shard.spawn.x, shard.spawn.z) + 0.1, z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never the whip: the whip is its declared item row (runtime/whip.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  const colliders = (host: SimHost): void => {
    addBakedTerrainCollider(host.physics, bytes, host.scope);
    baked.pieces.forEach(piece => {
      if (!piece.active) return;
      addPiece(host.physics, { id: piece.id, name: piece.name, category: 'props', file: piece.file, surface: surface(piece.surface),
        colliders: piece.colliders.map(c => ({ kind: 'box' as const, x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...('yaw' in c ? { yaw: c.yaw } : {}), ...('surface' in c ? { surface: surface(c.surface) } : {}) })), colliderOwner: piece.id });
    });
  };
  const whip = shard.items.rows.find(row => row.id === WHIP_ID);
  if (whip === undefined) throw new Error('Signal Dunes declares its whip row');
  return { level, ports: { ground: false, heightAt }, install: (host, context) => {
    if (!context.restoring) colliders(host);
    installSignalHomes(host, { specs, attackers: SIGNAL_ATTACKERS, held: () => !host.flags.has(SCOUT_FLAG) }, context.snapshot);
    installSignalWhip(host, whip, () => context.commands().flatMap((command): WhipCommand[] => command.kind === 'player' && command.attack !== undefined ? [{ targetId: command.attack.targetId }] : []));
  } };
};
const SURFACES: readonly Material[] = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand'];
function surface(value: string): Material {
  const known = SURFACES.find(name => name === value); if (known === undefined) throw new Error(`Unknown baked surface ${value}`); return known;
}
