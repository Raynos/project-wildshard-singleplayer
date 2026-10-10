import { SynthBeds as PlatformSynthBeds, type SynthBank as PlatformSynthBank, type SynthBedGraph as PlatformSynthBedGraph, type SynthBedRow as PlatformSynthBedRow, type SynthChainRow as PlatformSynthChainRow, type SynthFilterRow as PlatformSynthFilterRow, type SynthLfoRow as PlatformSynthLfoRow, type SynthMarkRow as PlatformSynthMarkRow, type SynthNoise as PlatformSynthNoise, type SynthStageRow as PlatformSynthStageRow, type SynthHost as PlatformSynthHost } from '@wildshard/game/systems/audio/synthBeds';

/** A synth bed graph as data (SHARD-PLATFORM M3): its beds, its chains and the harness tap's id prefix. */
export type SynthBedGraph = PlatformSynthBedGraph;
/** A bed: its id, where it goes (a bed or a caller-named node) and its starting level. */
export type SynthBedRow = PlatformSynthBedRow;
/** One chain into a bed: a noise / oscillator / sampled source, filters, gain stages and an optional named panner. */
export type SynthChainRow = PlatformSynthChainRow;
/** A biquad as data: type, frequency and Q. */
export type SynthFilterRow = PlatformSynthFilterRow;
/** An LFO as data: rate, depth and waveform. */
export type SynthLfoRow = PlatformSynthLfoRow;
/** A mark among the chains: where the caller's named callback runs in the build. */
export type SynthMarkRow = PlatformSynthMarkRow;
/** A gain stage as data: level, LFOs and an optional noise-driven flutter. */
export type SynthStageRow = PlatformSynthStageRow;
/** A pooled looping noise's name. */
export type SynthNoise = PlatformSynthNoise;
/** The bank the beds draw their noise and loops from (an engine Voices). */
export type SynthBank = PlatformSynthBank;
/** Where the beds are built: the audio context (read only when building) and the bank. */
export type SynthHost = PlatformSynthHost;
/** Builds synth bed graphs into a profile's AmbienceZones, drawing on one noise pool. */
export const SynthBeds: typeof PlatformSynthBeds = PlatformSynthBeds;
/** A synth bed builder (the class's instances). */
export type SynthBedsSet = PlatformSynthBeds;
