import type { LevelAudioProfile } from '#engine';

/**
 * Sky Reach ships no audio files yet: an empty profile (no music, no SFX samples, nothing to decode). The boot requires
 * a profile even for an asset-free level (E364 round-3 API gap 1), so this states "none" explicitly.
 */
export function skyAudio(): LevelAudioProfile {
  return { files: () => ({ music: [], sfx: [] }), bootFiles: () => [],
    decode: () => Promise.resolve({ title: undefined, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } }) };
}
