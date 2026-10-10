// SHARD-PLATFORM M3 (audio rows): Driftwood Isle's synth ambience beds as data (runtime/audio/ambience.ts builds them
// through @wildshard/sdk/audio/synthBeds; the zone mix there sets each bed's level). Outputs the profile names: `occl`
// (the outdoor beds' occlusion low-pass, muffled in the hold and the cave), `ambient` (the bus), `surfPan` (the surf's
// line emitter on the shoreline) and `fallPan` (the waterfall's emitter at the plunge pool, not occluded). The marks start
// the profile's schedulers (the swells, the birds, the cave drips) in their place in the build.
import type { SynthBedGraph } from '@wildshard/sdk/audio/synthBeds';

/** The island's beds: surf (body + hiss on the shoreline emitter; the swells ride their gains), lapping under a pier, the
 *  breeze, palm rustle (bright leaf noise through a noise-driven flutter, panned toward the palms), the lookout's high wind
 *  (a hollow roar, a whistle wandering through the frame, the pennant flapping), the jungle (two pulsing insect bands by
 *  day, two chirping crickets by night, a humid low bed), the waterfall (rumble, body, splash), the cove and the bubble bed. */
export const ISLAND_BEDS: SynthBedGraph = {
  tap: 'island.bed',
  beds: [
    { id: 'surf', out: 'surfPan' },
    { id: 'surfBody', out: 'surf', gain: 0.35 },
    { id: 'surfHiss', out: 'surf', gain: 0.12 },
    { id: 'lap', out: 'occl' },
    { id: 'breeze', out: 'occl' },
    { id: 'palms', out: 'occl' },
    { id: 'lookout', out: 'occl' },
    { id: 'jungle', out: 'occl' },
    { id: 'jungleDay', out: 'jungle' },
    { id: 'jungleNight', out: 'jungle' },
    { id: 'waterfall', out: 'fallPan' },
    { id: 'cove', out: 'ambient' },
    { id: 'underwater', out: 'ambient' },
  ],
  chains: [
    { noise: 'noise-pink', filters: [['lowpass', 700, 0.6]], to: 'surfBody' },
    { noise: 'noise-white', filters: [['bandpass', 2400, 0.5]], to: 'surfHiss' },
    { mark: 'swell' },
    { noise: 'noise-pink', filters: [['bandpass', 520, 1.2]], stages: [{ gain: 0.6, lfos: [{ rate: 0.55, depth: 0.35 }, { rate: 0.83, depth: 0.2 }] }], to: 'lap' },
    { noise: 'noise-pink', filters: [['bandpass', 260, 0.5], ['lowpass', 900]], to: 'breeze' },
    { noise: 'noise-white', filters: [['highpass', 2200], ['bandpass', 5200, 0.6]], stages: [{ gain: 0.55, flutter: { noise: 'noise-white', filters: [['lowpass', 9, 0.7]], depth: 3.5 } }], pan: 'flutter', to: 'palms' },
    { noise: 'noise-pink', filters: [['bandpass', 480, 0.7], ['lowpass', 2000]], to: 'lookout' },
    { noise: 'noise-white', filters: [['bandpass', 1150, 14]], sweeps: [[0, { rate: 0.13, depth: 220 }]], stages: [{ gain: 0.5, lfos: [{ rate: 0.31, depth: 0.35 }] }], to: 'lookout' },
    { noise: 'noise-white', filters: [['bandpass', 900, 1]], stages: [{ gain: 0.25, lfos: [{ rate: 7.3, depth: 0.25, type: 'square' }] }], to: 'lookout' },
    { noise: 'noise-white', filters: [['bandpass', 4700, 7]], stages: [{ gain: 0.5, lfos: [{ rate: 38, depth: 0.45 }, { rate: 0.097, depth: 0.25 }] }], to: 'jungleDay' },
    { noise: 'noise-white', filters: [['bandpass', 6600, 9]], stages: [{ gain: 0.3, lfos: [{ rate: 53, depth: 0.27 }, { rate: 0.116, depth: 0.15 }] }], to: 'jungleDay' },
    { noise: 'noise-pink', filters: [['lowpass', 320]], stages: [{ gain: 0.4 }], to: 'jungle' },
    { osc: 4400, stages: [{ gain: 0.5, lfos: [{ rate: 32, depth: 0.5, type: 'square' }] }, { gain: 0.5, lfos: [{ rate: 1.7, depth: 0.5, type: 'square' }] }, { gain: 0.16 }], to: 'jungleNight' },
    { osc: 4900, stages: [{ gain: 0.5, lfos: [{ rate: 32, depth: 0.5, type: 'square' }] }, { gain: 0.5, lfos: [{ rate: 1.1, depth: 0.5, type: 'square' }] }, { gain: 0.1 }], to: 'jungleNight' },
    { mark: 'birds' },
    { noise: 'noise-pink', filters: [['lowpass', 2400], ['highpass', 140]], to: 'waterfall' },
    { noise: 'noise-pink', filters: [['lowpass', 110, 0.9]], stages: [{ gain: 0.9 }], to: 'waterfall' },
    { noise: 'noise-white', filters: [['bandpass', 3200, 0.7]], stages: [{ gain: 0.35, flutter: { noise: 'noise-white', filters: [['lowpass', 14]], depth: 0.3 } }], to: 'waterfall' },
    { noise: 'noise-pink', filters: [['bandpass', 700, 0.8]], stages: [{ gain: 0.5, lfos: [{ rate: 0.21, depth: 0.25 }] }], to: 'cove' },
    { mark: 'drips' },
    { sample: 'bubble-bed', to: 'underwater' },
  ],
};
