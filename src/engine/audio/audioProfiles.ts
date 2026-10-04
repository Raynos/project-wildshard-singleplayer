import type { ScoreSelection } from './scoreSelection';

/** Same-byte platform sample catalogue; gains apply to admitted named loops. */
export interface AudioSampleProfile { set: string; bed: string; loopGains: Readonly<Record<string, number>> }
/** Existing music catalogue and bounded scene selection; stem decoding and bar-grid playback remain engine-owned. */
export interface AudioMusicProfile {
  id: string; base: string; slots: readonly string[]; bootSlots: readonly string[]; synthLead: 'pluck' | 'marimba'; minFade: number;
  source: { dir: string; manifestKey: string } | null; sets: Readonly<Record<string, string>>;
  selection: readonly ScoreSelection[]; selectMode: 'first' | 'all';
}
/** Named circular ambience zones; a source id resolves a trusted moving-emitter or geometry port. */
export interface AudioZone { id: string; x: number; z: number; inner: number; outer: number; gain: number; open?: boolean | undefined; source?: string | undefined }
/** Mixer timing, bed levels, room sends and named zones consumed by a trusted catalogue recipe. */
export interface AudioZoneProfile {
  id: string; smoothSeconds: number; tickHz: number; silentSeconds: number; holdSeconds: number;
  levels: Readonly<Record<string, number>>; wet: Readonly<Record<string, number>>; zones: readonly AudioZone[];
}
