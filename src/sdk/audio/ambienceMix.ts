import { AmbienceMix as PlatformAmbienceMix, type AmbienceMixPorts as PlatformAmbienceMixPorts, type AmbienceMixRows as PlatformAmbienceMixRows, type MixBoundsRow as PlatformMixBoundsRow, type MixExpr as PlatformMixExpr, type MixNearRow as PlatformMixNearRow, type MixNodeRow as PlatformMixNodeRow, type MixNoteRow as PlatformMixNoteRow, type MixOneShotRow as PlatformMixOneShotRow, type MixOp as PlatformMixOp, type MixPhraseRow as PlatformMixPhraseRow, type MixPoint as PlatformMixPoint, type MixRoomRow as PlatformMixRoomRow, type MixSteerRow as PlatformMixSteerRow, type MixSwellRow as PlatformMixSwellRow, type MixValueRow as PlatformMixValueRow, type MixVoiceRow as PlatformMixVoiceRow } from '@wildshard/game/systems/audio/ambienceMix';

/** A profile's whole ambience mix as rows (SHARD-PLATFORM M3): nodes, beds, ports, values, levels, rooms, diag, zones, one-shots. */
export type AmbienceMixRows<Z extends string = string> = PlatformAmbienceMixRows<Z>;
/** What a profile hands its mix: random stream, scope name, ground, sea, objects, point lists, points, scalar readers. */
export type AmbienceMixPorts = PlatformAmbienceMixPorts;
/** A mix expression: a number, a named value or an operator over expressions. */
export type MixExpr = PlatformMixExpr;
/** An operator of a mix expression. */
export type MixOp = PlatformMixOp;
/** A named value the mix computes in order. */
export type MixValueRow = PlatformMixValueRow;
/** A node built before the beds: a biquad or a positional panner (fixed, or following a shoreline). */
export type MixNodeRow = PlatformMixNodeRow;
/** A bounds port read from a profile object. */
export type MixBoundsRow = PlatformMixBoundsRow;
/** A nearness port over a point list. */
export type MixNearRow = PlatformMixNearRow;
/** A bed panner steered toward a nearness port. */
export type MixSteerRow = PlatformMixSteerRow;
/** A reverb room's send. */
export type MixRoomRow = PlatformMixRoomRow;
/** A swell riding beds' gains. */
export type MixSwellRow = PlatformMixSwellRow;
/** One oscillator note of a phrase. */
export type MixNoteRow = PlatformMixNoteRow;
/** A phrase of notes. */
export type MixPhraseRow = PlatformMixPhraseRow;
/** A one-shot voice. */
export type MixVoiceRow = PlatformMixVoiceRow;
/** A one-shot scheduler. */
export type MixOneShotRow = PlatformMixOneShotRow;
/** A point port. */
export type MixPoint = PlatformMixPoint;
/** Builds and runs a profile's ambience mix from rows. */
export const AmbienceMix: typeof PlatformAmbienceMix = PlatformAmbienceMix;
/** An ambience mix (the class's instances). */
export type AmbienceMixSet<Z extends string = string> = PlatformAmbienceMix<Z>;
