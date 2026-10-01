import { loadAudio, type LevelAudioProfile, type CueBank } from '#engine';

const SCORE = { dir: '/assets/music/nalati/', manifestKey: 'nalati' };
const SFX = 'nalati-grasslands';

/** Existing takes and score files in their original order; only their owning set changes. */
export async function createNalatiAudio(): Promise<LevelAudioProfile> {
  const { audioFiles, scoreFiles, cueFiles, sfxFiles, styleFiles, getSfxSet, decodeStyle, decodeScore, decodeCueSet, decodeSfxSet } = await loadAudio();
  return {
    files: () => {
      const base = audioFiles();
      return { music: [...base.music, ...scoreFiles(SCORE)], sfx: [...base.sfx, ...cueFiles(SFX)] };
    },
    priorityFiles: () => [...scoreFiles(SCORE), ...cueFiles(SFX)],
    bootFiles: (style) => [...styleFiles(style, ['title']), ...sfxFiles(getSfxSet(), 'steppe'),
      ...(getSfxSet() === 'synth' ? [] : cueFiles(SFX)), ...(style === 'synth' ? [] : scoreFiles(SCORE, ['steppe-grass']))],
    decode: async (style, read, decode, onFile) => {
      const set = getSfxSet();
      const empty: CueBank = { loops: new Map(), shots: new Map() };
      const [title, score, cues, samples] = await Promise.all([
        decodeStyle(style, ['title'], read, decode, onFile).catch(() => undefined),
        decodeScore(SCORE, style === 'synth' ? [] : ['steppe-grass'], read, decode, style !== 'synth', onFile),
        set === 'synth' ? Promise.resolve(empty) : decodeCueSet(SFX, read, decode, onFile),
        decodeSfxSet(set, 'steppe', read, onFile, decode),
      ]);
      for (const [id, loop] of cues.loops) samples.loops.set(id.slice(id.indexOf('.') + 1), loop);
      for (const [id, clips] of cues.shots) samples.shots.set(id, { bufs: clips.map((clip) => clip.buffer), gain: clips[0]?.gain ?? 1 });
      return { title, score, cues, samples };
    },
  };
}
