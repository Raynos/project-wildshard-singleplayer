import * as v from 'valibot';
import type { BossDefinition as EngineBossDefinition } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { MarkedBossPresentationSchema as presentationSchema, parseMarkedBossPresentation as parsePresentation, type MarkedBossPresentation as PlatformPresentation } from '@wildshard/game/shardfile/markedBossPresentation';
import { markedBossFight as platformFight, type MarkedBossFight as PlatformFight, type MarkedBossFightPorts as PlatformPorts,
  type MarkedBossFightRow as PlatformRow, type MarkedBossFightState as PlatformState } from '@wildshard/game/shardfile/bossFight';

/** A boss encounter's definition: id, name, title, retry title, intro lengths and its phases (thresholds, captions). */
export type BossDefinition = EngineBossDefinition;
/** A marked boss fight's row (SHARD-PLATFORM SF27): arena, health shares per checkpoint, rise, storm phases and fade, memory fields. */
export type MarkedBossFightRow = PlatformRow;
/** What a marked boss fight is lent: its body, reward and respawn points, the victory's effects and the views' update. */
export type MarkedBossFightPorts<A extends AnimalSim> = PlatformPorts<A>;
/** A marked boss fight's own continuation: the storm's goal and strength and its invulnerability. */
export type MarkedBossFightState = PlatformState;
/** A marked boss fight: its view-free `BossScript`, storm, body and continuation. */
export type MarkedBossFight<A extends AnimalSim> = PlatformFight<A>;
/**
 * A boss's view-free fight from its row (SF27): a fresh body per checkpoint at its health share, the intro's rise and
 * the phase marks on the body's memory (a `phased-flyer` brain reads them), the storm per phase, the beats'
 * invulnerability and the victory; the browser runs it under its views, the headless host through `installBossRow`.
 */
export function markedBossFight<A extends AnimalSim>(row: MarkedBossFightRow, ports: MarkedBossFightPorts<A>): MarkedBossFight<A> { return platformFight(row, ports); }
/** A marked boss fight's browser presentation row (SF27, SF7f): arena floor, respawn, the storm's fog and sand shells, the toasts. */
export const MarkedBossPresentationSchema = v.pipe(presentationSchema);
/** A validated marked boss presentation row. */
export type MarkedBossPresentation = PlatformPresentation;
/** Compile an authored marked boss presentation row; an unknown field refuses. */
export function parseMarkedBossPresentation(input: unknown): PlatformPresentation { return parsePresentation(input); }
