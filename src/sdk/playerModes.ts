/**
 * The player modes a shard runs (SHARD-PLATFORM SF34, G3): the platform's motor modes (on foot, the hoverboard, swim and
 * wade) come with every shard; a shard brings an approved driven mode (ride, grapple) through `registerPlayerMode` and
 * holds the frame with `enterPlayerMode` / `exitPlayerMode`. A hover-only piece is a world piece with `mode: 'board'`.
 * The engine's registry is `@wildshard/engine/player/modes`; these are its shard-facing calls. A headless runtime runs the
 * same registry on its SimHost (`host.modes`) with the `*HeadlessMode` calls: its driver is a SimPlayerDriver, and the
 * motor modes (the board, swim and wade once the host has water: `host.useWater`) follow the page Player's own laws.
 */
import type { Scope } from '@wildshard/engine/app/scope';
import type { Events } from '@wildshard/engine/events/events';
import type { SimPlayerDriver } from '@wildshard/engine/sim';
import {
  motorMode as engineMotorMode, playerModes, type PlayerModes, type DrivenMode as EngineDrivenMode, type ModeHud as EngineModeHud, type ModeInput, type ModePlayer as EngineModePlayer,
  type MotorMode as EngineMotorMode, type PlayerModeDef as EnginePlayerModeDef, type PlayerModeDriver as EnginePlayerModeDriver,
  type PlayerModeHandle as EnginePlayerModeHandle, type PlayerModeId as EnginePlayerModeId,
} from '@wildshard/engine/player/modes';

/** The platform's own modes: on foot, the hoverboard, swimming and wading. */
export type MotorMode = EngineMotorMode;
/** The approved modes a shard brings: ride and grapple ship; glide, climb and drive are approved. */
export type DrivenMode = EngineDrivenMode;
/** Every player mode. */
export type PlayerModeId = EnginePlayerModeId;
/** The baseline HUD control that shows a mode (a mode never adds or moves one: E332). */
export type ModeHud = EngineModeHud;
/** A driver that owns the player's frame while its mode is entered: input, fixed step, pose and its way off. */
export type PlayerModeDriver = EnginePlayerModeDriver;
/** A driven mode's declaration: id, HUD slot, input context, traversal and enter / exit hooks. */
export type PlayerModeDef = EnginePlayerModeDef;
/** A registered driven mode (`D`: the page's frame driver, or a headless SimPlayerDriver). */
export type PlayerModeHandle<D = PlayerModeDriver> = EnginePlayerModeHandle<D>;
/** The player the modes run on. */
export type ModePlayer = EngineModePlayer;

/** Where a mode registers: the player, and the page's events (for a traversal) and input service (for a context). */
export interface ModeHost {
  readonly player: ModePlayer;
  readonly events?: Events;
  readonly input?: ModeInput;
}

/** Declare a driven mode for `scope`'s lifetime: its input context, its traversal and its hooks. */
export function registerPlayerMode(host: ModeHost, def: PlayerModeDef, scope: Scope): PlayerModeHandle {
  return playerModes(host.player).register(def, scope, { ...(host.events === undefined ? {} : { events: host.events }), ...(host.input === undefined ? {} : { input: host.input }) });
}
/** Hand the player's frame to `driver` in mode `id` until `exitPlayerMode`. */
export function enterPlayerMode(player: ModePlayer, id: DrivenMode, driver: PlayerModeDriver): void { playerModes(player).enter(id, driver); }
/** Hand the frame back from mode `id` (a no-op when `id` does not hold it). */
export function exitPlayerMode(player: ModePlayer, id: DrivenMode): void { playerModes(player).exit(id); }
/** The player's current mode: an entered driver, a traversal holding the capsule, else the motor mode. */
export function currentPlayerMode(player: ModePlayer): PlayerModeId { return playerModes(player).current(); }
/** The motor mode alone: the board over the water, swimming over wading. */
export function motorMode(player: Pick<ModePlayer, 'hover' | 'swimming' | 'wading'>): MotorMode { return engineMotorMode(player); }

/** A headless host's modes (SimHost: the same registry, its driver a SimPlayerDriver). */
export interface HeadlessModeHost { readonly modes: PlayerModes<SimPlayerDriver> }
/** Declare a driven mode on a headless host for `scope`'s lifetime (its hooks; a headless host runs no traversal or input
 *  context yet, so a def with `traverse` or `context` is refused). */
export function registerHeadlessMode(host: HeadlessModeHost, def: PlayerModeDef, scope: Scope): PlayerModeHandle<SimPlayerDriver> { return host.modes.register(def, scope); }
/** Hand the headless player's motion to `driver` in mode `id` until `exitHeadlessMode` (ahead of any usePlayerDriver driver). */
export function enterHeadlessMode(host: HeadlessModeHost, id: DrivenMode, driver: SimPlayerDriver): void { host.modes.enter(id, driver); }
/** Hand the headless player's motion back from mode `id` (a no-op when `id` does not hold it). */
export function exitHeadlessMode(host: HeadlessModeHost, id: DrivenMode): void { host.modes.exit(id); }
/** The headless player's current mode: an entered driver, else the motor mode (board, swim, wade, foot). */
export function currentHeadlessMode(host: HeadlessModeHost): PlayerModeId { return host.modes.current(); }
