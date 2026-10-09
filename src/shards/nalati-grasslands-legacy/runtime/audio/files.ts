import type { CueBank } from '@wildshard/engine/audio/Cues';
import type { LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';

import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';

const MUSIC = requireAudioProfile(source.audio.music, 'score.nalati');
const SCORE = requireAudioProfile(MUSIC.source ?? undefined, 'nalati.music.source');
const SAMPLES = requireAudioProfile(source.audio.samples, 'nalati.samples');
const SFX = SAMPLES.set;
const SCORE_BOOT = MUSIC.bootSlots.filter((slot) => slot !== 'title');

/** Full manifest inventory; selected decoding stays in the profile's bootFiles. */
export async function BOOT_AUDIO(): Promise<readonly string[]> {
  const files = (await createNalatiAudio()).files();
  return [...files.music, ...files.sfx];
}

/** Existing takes and score files in their original order; only their owning set changes. */
export async function createNalatiAudio(): Promise<LevelAudioProfile> {
  const [{ audioFiles }, { scoreFiles, decodeScore }, { cueFiles, decodeCueSet }, { sfxFiles, decodeSfxSet }, { styleFiles, decodeStyle }, { getSfxSet }] = await Promise.all([import('@wildshard/engine/boot/audioFiles'), import('@wildshard/engine/audio/SetScore'), import('@wildshard/engine/audio/Cues'), import('@wildshard/engine/audio/preload'), import('@wildshard/engine/audio/Stems'), import('@wildshard/engine/ui/Settings')]);
  return {
    files: () => {
      const base = audioFiles();
      return { music: [...base.music, ...scoreFiles(SCORE)], sfx: [...base.sfx, ...cueFiles(SFX)] };
    },
    priorityFiles: () => [...scoreFiles(SCORE), ...cueFiles(SFX)],
    bootFiles: (style) => [...styleFiles(style, ['title']), ...sfxFiles(getSfxSet(), SAMPLES.bed),
      ...(getSfxSet() === 'synth' ? [] : cueFiles(SFX)), ...(style === 'synth' ? [] : scoreFiles(SCORE, SCORE_BOOT))],
    decode: async (style, read, decode, onFile) => {
      const set = getSfxSet();
      const empty: CueBank = { loops: new Map(), shots: new Map() };
      const [title, score, cues, samples] = await Promise.all([
        decodeStyle(style, ['title'], read, decode, onFile).catch(() => undefined),
        decodeScore(SCORE, style === 'synth' ? [] : SCORE_BOOT, read, decode, style !== 'synth', onFile),
        set === 'synth' ? Promise.resolve(empty) : decodeCueSet(SFX, read, decode, onFile),
        decodeSfxSet(set, SAMPLES.bed, read, onFile, decode),
      ]);
      for (const [id, loop] of cues.loops) samples.loops.set(id.slice(id.indexOf('.') + 1), loop);
      for (const [id, clips] of cues.shots) samples.shots.set(id, { bufs: clips.map((clip) => clip.buffer), gain: clips[0]?.gain ?? 1 });
      return { title, score, cues, samples };
    },
  };
}
