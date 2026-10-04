/**
 * InteractSfx — the adventure kit's sounds (chests, locks, levers, plates, doors, grates, pickups, glyphs, the beacon),
 * played from the procedural bank (gen.ts via audio.voices). A no-op before the first gesture; every play has a little
 * pitch jitter (±2 % for the chime and the glyph, ±5 % else) and never repeats the variant it played last.
 *
 *   const sfx = new InteractSfx(audio);
 *   sfx.interact(sound, at?, o?)   // 'chest' open · 'locked' rattle · 'lever' clunk · 'plate' grind (o.release: lighter,
 *                                  //   quicker) · 'door' creak · 'grate' iron grind · 'chime' pickup · 'glyph' (brighter)
 *                                  //   · 'ignite' the beacon; o.delay / o.gain; `at` places it in the world
 *
 * A level's own footsteps, combat layers and creature voices are its voice table (E357 S4.3, 08 §6.3 C).
 */
import type { InteractSound } from './gen';
import type { Audio } from './Audio';

interface At { x: number; y: number; z: number }

const INTERACT_LEVEL: Record<InteractSound, number> = { chest: 0.7, locked: 0.6, lever: 0.7, plate: 0.65, door: 0.7, grate: 0.6, chime: 0.45, glyph: 0.6, ignite: 0.8 };

/** the adventure kit's interaction sounds (chests, locks, levers, plates, doors, grates, pickups, glyphs) */
export class InteractSfx {
  private readonly audio: Pick<Audio, 'voices'>;
  constructor(audio: Pick<Audio, 'voices'>) {
    this.audio = audio;
  }

  /** an interactable's sound, placed at the object */
  interact(sound: InteractSound, at?: At, o: { gain?: number; delay?: number; release?: boolean } = {}): void {
    const base = INTERACT_LEVEL[sound] * (o.gain ?? 1) * (o.release === true ? 0.6 : 1);
    this.audio.voices.play(`ui-${sound}`, { gain: base, rate: o.release === true ? 1.18 : 1, at, delay: o.delay ?? 0, jitter: sound === 'chime' || sound === 'glyph' ? 0.02 : 0.05 });
  }
}
