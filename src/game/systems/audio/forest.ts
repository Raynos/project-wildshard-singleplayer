import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { LevelAudioProfile } from '@wildshard/engine/audio/levelAudio';
/** Asset-free profile; installForestAmbience supplies the shared synth wind bed. */
export function createForestAudio(): LevelAudioProfile {
  return { files: () => ({ music: [], sfx: [] }), bootFiles: () => [],
    decode: () => Promise.resolve({ title: undefined, score: { slots: new Map(), stings: new Map() }, cues: { loops: new Map(), shots: new Map() } }) };
}
/** A reusable wind bed; mkWind registers its sources with the mixer's bed-node lifetime. */
export function installForestAmbience(audio: Pick<Audio, 'installSynthBed' | 'restartSynthBed'> & { mkWind: (...args: Parameters<Audio['mkWind']>) => Pick<GainNode, 'disconnect'> }, scope: Scope): void {
  let winds: Pick<GainNode, 'disconnect'>[] = [];
  audio.installSynthBed('forest', {
    start: () => { winds = [audio.mkWind(260, 0.5, -0.55, 0.07, 0.11), audio.mkWind(620, 0.8, 0.55, 0.11, 0.06)]; },
    stop: () => { for (const wind of winds) wind.disconnect(); winds = []; },
  }, scope);
  audio.restartSynthBed('forest');
}
