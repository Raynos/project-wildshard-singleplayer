/** The arena room on a SimHost (P1-E3.4, J104, J107): the same fight the page runs, for every player of a room. The fight
 *  deals with the living player past the threshold nearest the body; those past it at the start set its health and its
 *  targets; a fallen player goes back alone with the fight's progress kept, and the fight resets once nobody is inside.
 *  One player runs the row's fight and numbers exactly. Nothing here draws. */
import * as v from 'valibot';
import type { BossDefinition, BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { BossContenders } from '@wildshard/engine/ai/bossContenders';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { PlayerSim } from '@wildshard/engine/sim/playerSim';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import type { PhasedBossFight } from '../plugin/bossPhase';
import { installBossRow } from '../shardfile/bossRow';
import type { ArenaRoomGround } from './arenaGround';
import { arenaRoomFight, type ArenaFightBody, type ArenaFightTarget, type BoundedArenaFight } from './arenaRoomFight';
import { NativeArenaSand } from './nativeArenaSand';

/** A body as a SimHost's roster keeps it. */
export type ArenaRoomBody = AnimalSim & ArenaFightBody;
/** The row's first-think memory (`ArenaRoomSpeciesControlSchema`'s `initialize`). */
export interface ArenaRoomFirstThink { readonly flag: string; readonly defaults: readonly ({ readonly field: string } & ({ readonly source: 'height' } | { readonly source?: undefined; readonly value: number }))[] }
export interface ArenaRoomNativeRows {
  /** The fight's fixed step; its brain, sand and seal hang off it. */
  readonly step: string;
  readonly room: ConstructorParameters<typeof ArenaRoomGround>[0];
  readonly definition: BossDefinition;
  readonly fight: BoundedArenaFight;
  readonly initialize?: ArenaRoomFirstThink;
}
/** What the host's roster and world lend the fight. */
export interface ArenaRoomNativePorts<A extends ArenaRoomBody> {
  readonly spawnBody: () => A | null;
  readonly spawnAdd: (index: number, x: number, z: number, yaw: number) => A;
  readonly retire: (actor: A) => void;
  /** A body by its entity id, for a restore. */
  readonly find: (id: string) => A | null;
  /** The door's collider. */
  readonly seal: (on: boolean) => void;
  readonly saved: BossSaved;
  readonly persist: (saved: BossSaved) => void;
  readonly spawnReward?: () => void;
  /** A player the fight just put back: their motor and kit. */
  readonly returned?: (player: PlayerSim) => void;
}
const THINK = 0.1;
const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ think: finite, sealed: v.boolean(), fight: v.unknown(), sand: v.unknown() });

/** Install the fight in its armed state, waiting at the door. No body is spawned until the first reset. */
export function installArenaRoom<A extends ArenaRoomBody>(host: SimHost, rows: ArenaRoomNativeRows, ports: ArenaRoomNativePorts<A>): {
  boss: ReturnType<typeof installBossRow>['boss']; party: BossContenders; fight: PhasedBossFight<A>; ground: ArenaRoomGround; locked: () => boolean;
} {
  const sand = new NativeArenaSand(host, rows.room, `${rows.step}.sand`), ground = sand.ground, profile = parseBossProfile(rows.fight.profile);
  if (profile.pattern !== 'arena') throw new Error('Arena room requires an arena boss profile');
  const owner: { party: BossContenders | null; fight: PhasedBossFight<A> | null } = { party: null, fight: null };
  let sealWanted = false, sealShown = false, think = 0;
  /** The door shuts with the fight, and stands open while anyone waits outside it to come back in (J107). */
  const seal = (): void => {
    const waiting = host.players.size > 1 && [...host.players.values()].some(player => ground.inDromos(player.position));
    const on = sealWanted && !waiting; if (on !== sealShown) { sealShown = on; ports.seal(on); }
  };
  const at = rows.room.origin;
  const target = (): ArenaFightTarget => {
    const { party } = owner, body = owner.fight?.body() ?? null;
    if (party === null) throw new Error('Arena fight has no room yet');
    const player = party.nearest(body === null ? at : body.position);
    return { position: player.position, dash: (x, z, seconds) => { player.dashAt(x, z, seconds); }, health: player.health };
  };
  const { phased: fight, script } = arenaRoomFight<A>({
    room: { floorHeightAt: (x, z) => ground.floorAt(x, z), addSand: (...pile) => { ground.addSand(...pile); }, clearSand: () => { ground.clearSand(); },
      drainSand: (dt, rate) => { ground.drainSand(dt, rate); }, inChamber: p => ground.inChamber(p), setSealed: on => { sealWanted = on; seal(); } },
    body: { spawn: ports.spawnBody, retire: ports.retire, bind: () => undefined, ready: (actor, floorY) => { actor.yOffset = floorY - actor.position.y; } },
    spawnAdd: ports.spawnAdd, target, combat: host.combat, physics: () => host.physics, rng: () => host.rng.stream('ai').next(), feed: () => undefined,
  }, rows.fight, () => Object.fromEntries(profile.fight.views.map(id => [id, (): void => undefined])));
  const row = installBossRow(host, { step: rows.step, definition: rows.definition, script, body: () => fight.body(), shielded: () => script.shielded,
    hazardTag: rows.fight.damageTag, saved: ports.saved, persist: ports.persist, armed: true,
    ...(ports.spawnReward === undefined ? {} : { spawnReward: ports.spawnReward }), ...(ports.returned === undefined ? {} : { returned: ports.returned }),
    fight: { snapshot: () => ({ think, sealed: sealWanted, fight: fight.continuation(actor => actor.entityId), sand: sand.snapshot() }),
      restore: value => {
        const saved = v.parse(Saved, value); think = saved.think; sealWanted = saved.sealed;
        sand.restore(saved.sand); fight.restore(saved.fight, ports.find);
      } } });
  owner.party = row.party; owner.fight = fight;
  host.onStep(`${rows.step}.brain`, dt => {
    seal(); sand.advance(dt);
    const body = fight.body(); if (body === null || !body.alive) return;
    const foe = row.party.nearest(body.position).position, initial = rows.initialize;
    if (initial !== undefined && body.mem[initial.flag] !== 1) {
      body.mem[initial.flag] = 1;
      for (const entry of initial.defaults) body.mem[entry.field] ??= entry.source === 'height' ? host.groundHeightAt(body.position.x, body.position.z) : entry.value;
    }
    think += dt; if (think >= THINK) { fight.brain.think(body, { dt: think, player: foe }); think = 0; }
    fight.brain.act(body, { player: foe });
  });
  host.scope.onDispose(() => { for (const actor of fight.adds()) ports.retire(actor); });
  return { boss: row.boss, party: row.party, fight, ground, locked: row.locked };
}
