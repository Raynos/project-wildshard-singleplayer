import { phasedBossFight as platformFight, type PhasedBossBody as PlatformBody, type PhasedBossFight as PlatformFight, type PhasedBossPorts as PlatformPorts,
  type PhasedBossRow as PlatformRow, type BossViewBinding as PlatformViews, type BossViewCall as PlatformViewCall, type PhasedBossState as PlatformState } from '@wildshard/game/shardfile/phasedBoss';

/** A phased boss fight's row (SHARD-PLATFORM SF27): modes, phases, attack rows, adds, hazards and the declared view names. */
export type PhasedBossRow = PlatformRow;
/** The body a phased boss fight drives (the engine's animal, structurally). */
export type PhasedBossBody = PlatformBody;
/** What a phased boss fight is lent: arena, bodies, player, hit resolvers, rng, feed and the view bindings. */
export type PhasedBossPorts<A extends PlatformBody> = PlatformPorts<A>;
/** A phased boss fight: its `BossScript`, the body's brain, its bodies and its continuation. */
export type PhasedBossFight<A extends PlatformBody> = PlatformFight<A>;
/** A phased boss fight's continuation (its modes, clocks, hazards). */
export type PhasedBossState = PlatformState;
/** The shard's bindings for a fight's declared views: name → function of numbers. */
export type BossViewBinding = PlatformViews;
/** A declared view call as data: `[name, ...numbers]`. */
export type BossViewCall = PlatformViewCall;
/**
 * A phased boss fight from its row (SF27): a declared state machine of modes with timed beats, strike rows, invulnerability
 * windows, adds and arena hazards, view-free; the shard binds the named views and lends its arena.
 */
export function phasedBossFight<A extends PlatformBody>(row: PlatformRow, ports: PlatformPorts<A>): PlatformFight<A> { return platformFight(row, ports); }
