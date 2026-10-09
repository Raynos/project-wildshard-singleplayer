import * as v from 'valibot';
import { Vector3 } from 'three';
import { canReach } from '@wildshard/engine/ai/reach';
import type { SimHost } from '@wildshard/engine/sim';
import { bossFlagRecord, installBossRow } from '@wildshard/game/shardfile/bossRow';
import { ANTLER_KING_ENCOUNTER } from '../data/antlerKing';
import { KINGS_CLEARING } from '../layout';
import { AntlerKingCore, kingDormant, kingPresence, type KingCoreEnv } from '../combat/kingFight';
import { Lane } from '../combat/lane';
import { PINE_LANES } from '../combat/strikes';
import type { PineHuntBody, PineParked } from './roster';
import { pineBake } from './baked';
import { ACT_BRACE, ACT_ROAR, ACT_STRIKE, ACT_SWEEP } from '../combat/kingRig';
import { itemPickupFloor, ITEM_PICKUP_HOVER } from '@wildshard/engine/world/interact/pickup';
import { pickPrompt } from '@wildshard/engine/world/interact/prompts';

type BossBrain = ReturnType<typeof installBossRow>['boss'];
type BossDefinition = Parameters<typeof installBossRow>[1]['definition'];

/** The King's encounter step (BossBrain's and the fight's one continuation, the boss row's) and its presence / dormant steps. */
export const KING_STEP = 'pine.king', KING_PRESENCE_STEP = 'pine.king.presence', KING_DORMANT_STEP = 'pine.king.dormant';
export const KING_REWARD_STEP = 'pine.king.reward';
/** His record on the shard's own flags (no save of his own): beaten is the quest's `dead:king` (the page raises it on his
 *  kill), paid is the Warden's Longbow taken (only the first unpaid fall leaves that orb; every victory pays its trophy). */
export const KING_RECORD = { defeated: 'dead:king', paid: 'paid:king' } as const;
/** combat/ctx.ts SCRIPTED: the state a fight's own animal holds. */
const SCRIPTED = 'sidestep';

/** What the King is lent by the roster (late-bound: the King's steps are installed before the roster's live spawns). */
export interface PineKingPorts {
  readonly heightAt: (x: number, z: number) => number;
  /** the King's parked prewarm body (his id and recipe from the boot stream), made real when he first comes */
  readonly parked: () => readonly PineParked[];
  readonly adoptParked: (id: string, x: number, z: number, yaw: number) => PineHuntBody;
  /** a fresh body after his first (a fallen King's next night): the page's declared row spawned live, out of the list */
  readonly spawnLoose: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  readonly retire: (a: PineHuntBody) => void;
  readonly find: (id: string) => PineHuntBody | null;
  /** PineDayNight's night 0..1 (0 without a day-night clock: he never comes on his own) */
  readonly night: () => number;
  /** The page's trophy effect runs on every victory, including the first. */
  readonly grantTrophy: () => void;
}

/** Scratch for the page-rig cage centre. */
const RIB_POINT = new Vector3();
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
  private light = false;
  private readonly ports: PineKingPorts;
  constructor(host: SimHost, ports: PineKingPorts) {
    super(host.level.seed);
    this.ports = ports;
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
    if (row === undefined) throw new Error('Pine headless has no Antler King prewarm');
    // the page's prewarm spawned him at the clearing's centre facing north (his first body); a fallen King's next night is
    // the declared row (pine.antler-king: the clearing, yaw 0, 'warden') spawned live through the manager: the stream's
    // rolls and memory draws, the next entity id. Either way he is pinned out of the manager's thinking.
    const a = this.madeFirst ? this.ports.spawnLoose(row.kind, KINGS_CLEARING.x, KINGS_CLEARING.z, 0, row.variant)
      : this.ports.adoptParked(row.id, KINGS_CLEARING.x, KINGS_CLEARING.z, 0);
    this.madeFirst = true;
    a.scripted = true;
    return a;
  }
  protected override retireKing(k: PineHuntBody): void { this.ports.retire(k); }
  /** The same forced chest-chain read as the page's cage getter, with its admitted radius. */
  protected override onRibs(p: Vector3): boolean {
    const k = this.king;
    return k?.ribsWorld !== undefined && p.distanceTo(k.ribsWorld(RIB_POINT)) < pineBake().kingHit.radius * k.scale;
  }
  protected override parkKing(k: PineHuntBody): void { k.hidden = true; }
  protected override unparkKing(k: PineHuntBody): void { k.hidden = false; }
  protected override spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): PineHuntBody {
    const a = this.ports.spawn(kind, x, z, yaw, 'thrall');
    // combat/ctx.ts own: out of its herd, under the fight's control
    a.herd = -1; a.state = SCRIPTED; a.scripted = true;
    return a;
  }
  protected override retireThrall(a: PineHuntBody): void { this.ports.retire(a); }
  protected override action(k: PineHuntBody, move: 'roar' | 'sweep' | 'strike' | 'brace'): void {
    k.mem['act'] = { roar: ACT_ROAR, sweep: ACT_SWEEP, strike: ACT_STRIKE, brace: ACT_BRACE }[move];
  }
  protected override introFocus(k: PineHuntBody, out: Vector3): Vector3 {
    return k.ribsWorld?.(out) ?? out.copy(k.position);
  }
  protected override room(): void {
    // The page's light samples the chest only before the final darkness phase moves it to the camera.
    if (this.light && this.darkK <= 0.5) this.king?.ribsWorld?.(RIB_POINT);
  }
  protected override lightOn(): void { this.light = true; }
  protected override lightOff(): void { this.light = false; }
  protected override lanternView(_i: number, _f: unknown, _t: number, event: string): void {
    // A dropped lantern's getWorldPosition forces the head's parent chain, even though its view is silent here.
    if (event === 'drop') this.king?.publishKingHead?.();
  }
  protected override roar(): void { /* the voice: the page's */ }
  /** the continuation's madeFirst rides beside the fight's state */
  get first(): boolean { return this.madeFirst; }
  set first(on: boolean) { this.madeFirst = on; }
  get lightActive(): boolean { return this.light; }
  set lightActive(on: boolean) { this.light = on; }
}

const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: finite, state: finite, initial: finite, scrambledFork: v.boolean() });
const Runner = v.strictObject({ version: finite, phase: v.picklist(['idle', 'windup', 'active', 'recover', 'cooldown']), currentId: v.nullable(v.string()), hit: v.boolean(),
  elapsed: finite, speedMul: finite, clock: finite, deadlines: v.array(v.strictObject({ id: v.string(), at: finite })), scores: v.array(v.strictObject({ id: v.string(), score: finite })),
  x0: finite, z0: finite, x1: finite, z1: finite, yaw: finite, length: finite });
const LaneSaved = v.strictObject({ tellT: finite, runner: Runner });
const Fight = v.strictObject({ first: v.boolean(), lightActive: v.boolean(), hidden: v.boolean(), king: v.nullable(v.string()), present: v.boolean(), sealed: v.boolean(), sealK: finite, darkK: finite, glow: finite,
  invuln: v.boolean(), lockHp: finite, won: v.boolean(), phase: finite, mode: v.string(), modeT: finite, sweepCd: finite, stompCd: finite, callCd: finite, laneN: finite, open: finite,
  lane: LaneSaved, waves: v.array(v.strictObject({ r: finite, on: v.boolean(), hit: v.boolean(), delay: finite })),
  lanterns: v.array(v.strictObject({ x: finite, z: finite, y: finite, fallT: finite, acc: finite })),
  thralls: v.array(v.strictObject({ a: v.string(), lane: finite, mode: v.picklist(['approach', 'charge']) })), thrallLanes: v.array(LaneSaved), rngs: v.array(Stream) });

/** His encounter as the boss brain runs it (data/antlerKing.ts: the intro, the three phases at 100 / 60 / 30 %). */
function kingDefinition(trophy: () => void): BossDefinition {
  return { id: ANTLER_KING_ENCOUNTER.id, name: ANTLER_KING_ENCOUNTER.name, title: ANTLER_KING_ENCOUNTER.title, retryTitle: ANTLER_KING_ENCOUNTER.retryTitle,
    intro: ANTLER_KING_ENCOUNTER.intro, introShort: ANTLER_KING_ENCOUNTER.introShort,
    phases: ANTLER_KING_ENCOUNTER.phases.map(({ at, caption, name }) => ({ at, caption, name })), reward: { trophy } };
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
 * His record is the shard's flags (`KING_RECORD`: beaten is `dead:king`, paid is the Warden's Longbow taken); his first fall
 * leaves the bow at the page's settled orb point until USE; every victory pays three resin. The quest's shared feat law observes
 * his defeated flag and files the one saturated King fact, exactly as the page does.
 * A fallen King goes by day and comes back the next night as a fresh body (the declared row spawned live, out of the list);
 * a parked King stays hidden across a restore.
 *
 * His damage rule is the page's (`damageMul` at the pipeline's order 50: bark ×0.25, the ribcage ×3 open / ×0.6 shut, the
 * beat ×0.01); the ribcage reads the shared animated FK chest at the page getter's forced-parent clock.
 *
 * Browser-save interoperability remains separate from these host-owned flags and continuation.
 */
export function installPineKing(host: SimHost, ports: PineKingPorts): { boss: BossBrain; fight: AntlerKingCore<PineHuntBody>; locked: () => boolean;
  rewardPoint: () => { x: number; y: number; z: number } | null; takeReward: (eye: { x: number; y: number; z: number }) => boolean } {
  const fight = new HeadlessKing(host, ports), player = host.player.position, brain: { boss: BossBrain | null } = { boss: null };
  host.onStep(KING_PRESENCE_STEP, () => { if (brain.boss !== null) kingPresence(brain.boss, fight, player, ports.night() > 0.5); });
  // read at install (a restoring install's record is the brain's continuation, which restores over it)
  const record = bossFlagRecord(host.flags, KING_RECORD), saved = record.saved;
  let reward: { x: number; y: number; z: number } | null = null;
  const row = installBossRow(host, { step: KING_STEP, definition: kingDefinition(ports.grantTrophy), script: fight, body: () => fight.king, shielded: () => fight.shielded,
    fight: {
      // a parked King's `hidden` is the fight's (the body's own flag is no part of the host's entity record)
      snapshot: () => ({ first: fight.first, lightActive: fight.lightActive, hidden: fight.king?.hidden === true, ...fight.fightState(b => b.entityId) }),
      restore: value => {
        const { first, lightActive, hidden, ...state } = v.parse(Fight, value);
        fight.first = first;
        fight.lightActive = lightActive;
        fight.restoreFight(state, id => ports.find(id));
        if (fight.king !== null) fight.king.hidden = hidden;
      },
    }, saved, persist: record.persist,
    spawnReward: () => { const at = itemPickupFloor(host.physics, fight.rewardPoint()); reward = { x: at.x, y: at.y + ITEM_PICKUP_HOVER + 0.5, z: at.z }; } });
  const Reward = v.strictObject({ version: v.literal(1), point: v.nullable(v.strictObject({ x: finite, y: finite, z: finite })) });
  host.onStep(KING_REWARD_STEP, () => undefined, {
    snapshot: () => ({ version: 1, point: reward === null ? null : { ...reward } }),
    restore: value => { const state = v.parse(Reward, value); if (state.point !== null && (!saved.defeated || saved.rewardTaken)) throw new RangeError('Incompatible Pine King reward'); reward = state.point; },
  });
  brain.boss = row.boss;
  // his species' damage rule (the page's `damageMul`, the pipeline's order 50): the beat and the dormant King shrug a hit
  // off (×0.01), the open ribcage takes ×3 (shut ×0.6), the bark ×0.25
  host.events.answer('damage.modify', req => {
    const k = fight.king;
    if (req === null || k === null || req.target !== k.combatActor()) return req;
    return { ...req, amount: Math.max(1, Math.round(req.amount * fight.damageMul(k, req.point))) };
  }, host.scope, { order: 50 });
  host.onStep(KING_DORMANT_STEP, dt => { kingDormant(row.boss, fight, dt, host.clock.now); });
  return { boss: row.boss, fight, locked: row.locked,
    rewardPoint: () => reward === null ? null : { ...reward },
    takeReward: eye => {
      if (reward === null || saved.rewardTaken || pickPrompt([{ position: reward, radius: 2.6 }], eye, host.physics) === undefined) return false;
      reward = null; saved.rewardTaken = true; record.persist(saved); return true;
    } };
}
