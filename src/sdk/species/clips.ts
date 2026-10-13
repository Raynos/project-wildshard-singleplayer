import { clipAnimate as platformClipAnimate, playClips as platformPlayClips, type ClipCase as PlatformClipCase, type ClipChannel as PlatformClipChannel, type ClipClock as PlatformClipClock, type ClipCtx as PlatformClipCtx, type ClipFactor as PlatformClipFactor, type ClipRow as PlatformClipRow, type ClipTerm as PlatformClipTerm, type ClipWhen as PlatformClipWhen, type SpeciesClips as PlatformSpeciesClips } from '@wildshard/game/plugin/animation';
import type { ClipName, SocketName } from '@wildshard/engine/anim/rig';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';

/** The clocks a clip factor reads: the animal's time or its gait phase. */
export type ClipClock = PlatformClipClock;
/** When a clip case or term applies. */
export type ClipWhen = PlatformClipWhen;
/** One factor of a clip term (a bare number is a constant). */
export type ClipFactor = PlatformClipFactor;
/** One term of a clip sum: a constant or a product of factors. */
export type ClipTerm = PlatformClipTerm;
/** One case of a clip row. */
export type ClipCase = PlatformClipCase;
/** The bone channels a clip row drives. */
export type ClipChannel = PlatformClipChannel;
/** One clip row: a bone's channel and its cases. */
export type ClipRow = PlatformClipRow;
/** A species' declarative clips (SHARD-PLATFORM M3). */
export type SpeciesClips = PlatformSpeciesClips;
/** What a clip reads from the frame. */
export type ClipCtx = PlatformClipCtx;
/** Plays one frame of a species' clips on its bones. */
export const playClips: typeof platformPlayClips = platformPlayClips;
/** A species' `animate` from its clip rows. */
export const clipAnimate: typeof platformClipAnimate = platformClipAnimate;

/** A baked body's species look as rows: its ids and rig contract (its dims ride in the baked body). */
export interface BakedLookRow {
  readonly id: string; readonly species: string; readonly kind: string;
  readonly skeleton: string; readonly sockets: readonly SocketName[]; readonly clipNames: readonly ClipName[];
}
/** A species look on a baked creature body (`build`: a fresh copy each time, the game's `creatureBodies(...).bodyOrStandIn`),
 *  animated by its clip rows. Signal Dunes' and Sky Reach's creatures declare their looks this way. */
export function bakedLook(row: BakedLookRow, build: () => AnimalSpecies, clips: SpeciesClips): SpeciesLook {
  return { id: row.id, species: row.species, kind: row.kind, rig: 'custom', fur: NO_FUR,
    rigContract: { skeleton: row.skeleton, sockets: [...row.sockets], clips: [...row.clipNames] }, build, animate: clipAnimate(clips) };
}
