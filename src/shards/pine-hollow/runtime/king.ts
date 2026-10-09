import * as v from 'valibot';
import { Vector3 } from 'three';
import { canReach } from '@wildshard/engine/ai/reach';
import type { SimHost } from '@wildshard/engine/sim';
import { installBossRow } from '@wildshard/game/shardfile/bossRow';
import { ANTLER_KING_ENCOUNTER } from '../data/antlerKing';
import { KINGS_CLEARING } from '../layout';
import { AntlerKingCore, kingDormant, kingPresence, type KingCoreEnv } from '../combat/kingFight';
import { Lane } from '../combat/lane';
import { PINE_LANES } from '../combat/strikes';
import type { PineHuntBody, PineParked } from './roster';

type BossBrain = ReturnType<typeof installBossRow>['boss'];
type BossDefinition = Parameters<typeof installBossRow>[1]['definition'];

/** The King's encounter step (BossBrain's and the fight's one continuation, the boss row's) and its presence / dormant steps. */
export const KING_STEP = 'pine.king', KING_PRESENCE_STEP = 'pine.king.presence', KING_DORMANT_STEP = 'pine.king.dormant';
/** combat/ctx.ts SCRIPTED: the state a fight's own animal holds. */
const SCRIPTED = 'sidestep';

/** What the King is lent by the roster (late-bound: the King's steps are installed before the roster's live spawns). */
export interface PineKingPorts {
  readonly heightAt: (x: number, z: number) => number;
  /** the King's parked prewarm body (his id and recipe from the boot stream), made real when he first comes */
  readonly parked: () => readonly PineParked[];
  readonly adoptParked: (id: string, x: number, z: number, yaw: number) => PineHuntBody;
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  readonly retire: (a: PineHuntBody) => void;
  readonly find: (id: string) => PineHuntBody | null;
  /** PineDayNight's night 0..1 (0 without a day-night clock: he never comes on his own) */
  readonly night: () => number;
}

const silentTell = { setTime: (): void => undefined, ring: (): void => undefined, hide: (): void => undefined };

/** The shared fight (combat/kingFight.ts) on the host's bodies, its views silent. */
class HeadlessKing extends AntlerKingCore<PineHuntBody> {
  protected override readonly ctx: KingCoreEnv<PineHuntBody>;
  protected override readonly tellRing = silentTell;
  protected override readonly waves = [0, 1].map(() => ({ r: 0, on: false, hit: false, delay: 0 }));
  protected override readonly lane: Lane<PineHuntBody>;
  protected override readonly thrallLanes: Lane<PineHuntBody>[];
  /** the bodies made: his parked prewarm is used once (the page spawned it at boot and keeps it while he lives) */
  private madeFirst = false;
  constructor(host: SimHost, private readonly ports: PineKingPorts) {
    super(host.level.seed);
    const reach = (a: PineHuntBody, target: { x: number; y: number; z: number }): boolean => canReach(a, target, host.physics);
    const player = host.player;
    this.ctx = {
      reach,
      player: { position: player.position, get onGround(): boolean { return host.playerFall.grounded; }, shove: (x, z, speed) => { host.shovePlayer(x, z, speed); } },
      // ctx.hurt: blocked unless it reaches (or the move goes through walls), a blow the host knocks the player back from
      hurt: (a, amount, throughWalls = false) => {
        if (!throughWalls && !reach(a, player.position)) return;
        host.combat.hit({ source: a.combatActor(), sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'], target: player.health, amount,
          point: a.position.clone(), dir: new Vector3(), throughWalls, cause: { kind: a.kind, label: a.label } });
      },
      trauma: () => undefined, shot: () => undefined,
    };
    this.lane = new Lane<PineHuntBody>(PINE_LANES.king, reach);
    this.thrallLanes = [0, 1, 2].map(() => new Lane<PineHuntBody>(PINE_LANES.thrall, reach));
  }
  protected override groundAt(x: number, z: number): number { return this.ports.heightAt(x, z); }
  protected override makeKing(): PineHuntBody {
    const row = this.ports.parked()[0];
    if (this.madeFirst || row === undefined) throw new Error('Pine headless owns the Antler King\'s first body only (a fallen King\'s next night is not owned yet)');
    this.madeFirst = true;
    // the page's prewarm spawned him at the clearing's centre facing north; he is pinned out of the manager's thinking
    const a = this.ports.adoptParked(row.id, KINGS_CLEARING.x, KINGS_CLEARING.z, 0);
    a.scripted = true;
    return a;
  }
  protected override retireKing(k: PineHuntBody): void { this.ports.retire(k); }
  protected override parkKing(k: PineHuntBody): void { k.hidden = true; }
  protected override unparkKing(k: PineHuntBody): void { k.hidden = false; }
  protected override spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): PineHuntBody {
    const a = this.ports.spawn(kind, x, z, yaw, 'thrall');
    // combat/ctx.ts own: out of its herd, under the fight's control
    a.herd = -1; a.state = SCRIPTED; a.scripted = true;
    return a;
  }
  protected override retireThrall(a: PineHuntBody): void { this.ports.retire(a); }
  protected override action(): void { /* the rig's move names: the page's */ }
  protected override roar(): void { /* the voice: the page's */ }
  /** the continuation's madeFirst rides beside the fight's state */
  get first(): boolean { return this.madeFirst; }
  set first(on: boolean) { this.madeFirst = on; }
}

const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: finite, state: finite, initial: finite, scrambledFork: v.boolean() });
const Runner = v.strictObject({ version: finite, phase: v.picklist(['idle', 'windup', 'active', 'recover', 'cooldown']), currentId: v.nullable(v.string()), hit: v.boolean(),
  elapsed: finite, speedMul: finite, clock: finite, deadlines: v.array(v.strictObject({ id: v.string(), at: finite })), scores: v.array(v.strictObject({ id: v.string(), score: finite })),
  x0: finite, z0: finite, x1: finite, z1: finite, yaw: finite, length: finite });
const LaneSaved = v.strictObject({ tellT: finite, runner: Runner });
const Fight = v.strictObject({ first: v.boolean(), king: v.nullable(v.string()), present: v.boolean(), sealed: v.boolean(), sealK: finite, darkK: finite, glow: finite,
  invuln: v.boolean(), lockHp: finite, won: v.boolean(), phase: finite, mode: v.string(), modeT: finite, sweepCd: finite, stompCd: finite, callCd: finite, laneN: finite, open: finite,
  lane: LaneSaved, waves: v.array(v.strictObject({ r: finite, on: v.boolean(), hit: v.boolean(), delay: finite })),
  lanterns: v.array(v.strictObject({ x: finite, z: finite, y: finite, fallT: finite, acc: finite })),
  thralls: v.array(v.strictObject({ a: v.string(), lane: finite, mode: v.picklist(['approach', 'charge']) })), thrallLanes: v.array(LaneSaved), rngs: v.array(Stream) });

/** His encounter as the boss brain runs it (data/antlerKing.ts: the intro, the three phases at 100 / 60 / 30 %). */
function kingDefinition(): BossDefinition {
  return { id: ANTLER_KING_ENCOUNTER.id, name: ANTLER_KING_ENCOUNTER.name, title: ANTLER_KING_ENCOUNTER.title, retryTitle: ANTLER_KING_ENCOUNTER.retryTitle,
    intro: ANTLER_KING_ENCOUNTER.intro, introShort: ANTLER_KING_ENCOUNTER.introShort,
    phases: ANTLER_KING_ENCOUNTER.phases.map(({ at, caption, name }) => ({ at, caption, name })), reward: {} };
}

/**
 * THE ANTLER KING in a renderer-free host (SF72): the page's own fight (combat/kingFight.ts, AntlerKingCore: one script for
 * both hosts) on the platform's boss row (`installBossRow`: the engine's BossBrain, the host's damage / checkpoint answers),
 * with the page's presence rule before the brain (he comes at night within 80 m, goes by day or past 110 m) and the dormant
 * room after it. His body is his parked prewarm (the boot stream's creature:161 and recipe), made real at the clearing when
 * he first comes and kept out of the roster's thinking (the page pins him: his species thinks nothing); his thralls are live
 * spawns through the roster (the stream's draws, the next entity ids), taken under the fight's control; every roll is the
 * level seed's King streams. The fight's state rides the boss row's continuation, bodies by entity id (the roster reinstalls
 * them in the host's order before this restores).
 *
 * Not yet owned (progress/shard-platform/handoffs/sf72-pine.md): his record on the shard's flags (it is in memory: the
 * host's run is one play) and the reward; a fallen King's next night (refused); the ribcage weak point and the bark's damage
 * multiplier on the player's hits (the host's player has no weapon yet).
 */
export function installPineKing(host: SimHost, ports: PineKingPorts): { boss: BossBrain; fight: AntlerKingCore<PineHuntBody>; locked: () => boolean } {
  const fight = new HeadlessKing(host, ports), player = host.player.position, brain: { boss: BossBrain | null } = { boss: null };
  host.onStep(KING_PRESENCE_STEP, () => { if (brain.boss !== null) kingPresence(brain.boss, fight, player, ports.night() > 0.5); });
  const saved = { defeated: false, rewardTaken: false, kills: 0 };
  const row = installBossRow(host, { step: KING_STEP, definition: kingDefinition(), script: fight, body: () => fight.king, shielded: () => fight.shielded,
    fight: {
      snapshot: () => ({ first: fight.first, ...fight.fightState(b => b.entityId) }),
      restore: value => {
        const { first, ...state } = v.parse(Fight, value);
        fight.first = first;
        fight.restoreFight(state, id => ports.find(id));
      },
    }, saved, persist: () => undefined });
  brain.boss = row.boss;
  host.onStep(KING_DORMANT_STEP, dt => { kingDormant(row.boss, fight, dt, host.clock.now); });
  return { boss: row.boss, fight, locked: row.locked };
}
