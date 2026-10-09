// src/shards/nalati-grasslands/runtime/audio/SteppeScore.ts — Nalati's own score behind src/engine/audio/Music.ts (NALATI-MERGE A2 / A3).
//
//   public/assets/music/nalati/music.json   { style: 'nalati', credit, slots: { steppe-grass | steppe-sky | steppe-snow |
//                                           steppe-night | steppe-storm | steppe-king: { calm, tension, bpm, … } }, stings }
//
// ONE Kazakh-folk score whatever the music-style setting (the user, wave 5) — piano / orchestral / folk all play it on the
// steppe; 'synth' keeps the synth theme. The slots are Stems.ts decks like every other shard's (calm + tension, the tension
// stem up for alert / combat on the bar grid); Music picks the slot from the state `music.setSteppe(...)` sets:
//   the Golden King's fight → steppe-king · a storm (Jel Ata's cue) → steppe-storm · night → steppe-night (the throat drone
//   lives only there and in the boss cues, wave 6) · else the zone's theme: steppe-grass (Nalati Grasslands) / steppe-sky (Sky
//   Grassland) / steppe-snow (Snow Lotus Valley), crossfaded at the zone lines (SteppeAmbience.onZone holds a zone 3 s first).
// A slot the build lacks falls back along the chain (king / storm / night → the zone's theme → steppe-grass → the synth).
//
// Memory: a decoded slot is ~35 MB of PCM (a 60 s stereo calm stem + a mono tension stem), so only the slot playing and the
// one wanted are resident; the loading bar decodes the first slot (the camp is in the valley: steppe-grass) + the stings,
// every other slot decodes from the offline cache (the bar downloaded all of them, on the steppe only) when it is first wanted
// while the old one plays on, then crossfades in.
import { SetScore, decodeScore, scoreFiles, scoreManifest, type AudioRead, type AudioDecode, type ScoreBank } from '@wildshard/engine/audio/SetScore';
import type { MusicManifest } from '@wildshard/engine/audio/Stems';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import { selectScoreSlots } from '@wildshard/engine/audio/scoreSelection';
import source from '../../shard.config';

const PROFILE = requireAudioProfile(source.audio.music, 'score.nalati');
/** NALATI-MERGE A2: Nalati's own score (public/assets/music/nalati/music.json — one Kazakh-folk score whatever the style):
 *  a theme per zone, the night, the storm (Jel Ata's cue), the Golden King */
export type SteppeSlot = 'steppe-grass' | 'steppe-sky' | 'steppe-snow' | 'steppe-night' | 'steppe-storm' | 'steppe-king';

export type SteppeZone = 'grass' | 'sky' | 'snow';
export interface SteppeScene { zone: SteppeZone; night: boolean; storm: boolean; boss: 'king' | null }
const SET = requireAudioProfile(PROFILE.source ?? undefined, 'nalati.music.source');
export const STEPPE_DIR = SET.dir;
export const steppeManifest = (): MusicManifest | undefined => scoreManifest(SET);
export const steppeFiles = (): string[] => scoreFiles(SET);
export const steppeBootFiles = (first: SteppeSlot = 'steppe-grass'): string[] => scoreFiles(SET, [first]);
export type SteppeBank = ScoreBank;
export const decodeSteppe = (slots: readonly SteppeSlot[], read: AudioRead, decode: AudioDecode, withStings: boolean, onFile?: () => void): Promise<SteppeBank> => decodeScore(SET, slots, read, decode, withStings, onFile);
export function steppePick(scene: SteppeScene): readonly string[] {
  return selectScoreSlots(PROFILE.selection, PROFILE.selectMode, { boss: scene.boss, storm: scene.storm, night: scene.night, zone: scene.zone });
}
export function createSteppeScore(read: AudioRead, decode: AudioDecode, onReady: () => void): SetScore<SteppeScene> {
  return new SetScore<SteppeScene>({ ...SET, minFade: PROFILE.minFade, synthLead: PROFILE.synthLead, scene: { zone: 'grass', night: false, storm: false, boss: null }, pick: steppePick, read, decode, onReady });
}
