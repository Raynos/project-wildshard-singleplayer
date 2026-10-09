import { parseAudioData } from '@wildshard/sdk/audio';
import { ND_SAMPLES } from './audioSamples';

/** Today's market/Well beds, enclosed blend regions, lantern hum limits and ordered cue aliases. */
export const ND_AUDIO = parseAudioData({ cues: [], ambience: null, score: 'default', samples: ND_SAMPLES,
  music: { id: 'score.nd', base: 'nd-market', slots: ['nd-market', 'nd-well', 'nd-fight'], bootSlots: ['title', 'nd-market'], synthLead: 'pluck', minFade: 6,
    source: { dir: '/assets/music/nine-dragon-stack/', manifestKey: 'nine-dragon-stack' }, sets: {}, selectMode: 'first', selection: [
      { slots: ['nd-fight', 'nd-market'], when: [{ field: 'mode', op: 'equals', value: 'combat' }] },
      { slots: ['nd-well', 'nd-market'], when: [{ field: 'well', op: 'greater', value: 0.5 }] },
      { slots: ['nd-market', 'nd-market'], when: [] },
    ] },
  zones: { id: 'ambience.nd', smoothSeconds: 1, tickHz: 4, silentSeconds: 0, holdSeconds: 0, levels: {}, wet: {}, zones: [], blendMetres: 6,
    rectangles: [
      { id: 'well', zone: 'well', x0: -28, x1: 0, z0: -44, z1: 16 },
      { id: 'plaza', zone: 'market', x0: 0, x1: 22, z0: -26, z1: 20 },
      { id: 'street', zone: 'market', x0: 0.5, x1: 12.5, z0: -230, z1: -26 },
      { id: 'stair', zone: 'market', x0: 22, x1: 70, z0: 2, z1: 10 },
    ], beds: [{ id: 'bed.nd.market', zone: 'market' }, { id: 'bed.nd.well', zone: 'well' }], positional: { sample: 'hum.lantern', max: 4, reach: 14 } },
  routing: [
    { id: 'step', bus: 'audio', actions: [{ voice: 'nd.step' }] },
    ...['cue.jian.swing', 'cue.sword.swing', 'melee.swing'].map((id) => ({ id, bus: 'audio', actions: [{ voice: 'nd.jian.swing' }] })),
    ...['cue.jian.heavy', 'cue.sword.heavy', 'melee.heavy'].map((id) => ({ id, bus: 'audio', actions: [{ voice: 'nd.jian.heavy' }] })),
    ...['cue.jian.hit', 'cue.sword.hit', 'melee.hit'].flatMap((id) => [
      { id, bus: 'audio', when: [{ field: 'surface', op: 'in', values: ['wood', 'planks'] }], actions: [{ voice: 'nd.jian.hit.wood' }] },
      { id, bus: 'audio', when: [{ field: 'surface', op: 'equals', value: 'metal' }], actions: [{ voice: 'nd.jian.clang' }] },
      { id, bus: 'audio', when: [{ field: 'surface', op: 'equals', value: 'flesh' }], actions: [{ voice: 'nd.unhandled' }] },
      { id, bus: 'audio', actions: [{ voice: 'nd.jian.hit.stone' }] },
    ]),
    ...['fire', 'bite', 'reel', 'dock', 'zip'].flatMap((name) => ['cue.grapple.', 'grapple.'].map((prefix) => ({ id: `${prefix}${name}`, bus: 'audio', actions: [{ voice: `nd.feizhua.${name}` }] }))),
    { id: 'chime.gust', bus: 'audio', actions: [{ voice: 'nd.chime.gust' }] },
  ],
});
