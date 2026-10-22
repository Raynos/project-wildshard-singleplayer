import { parseAudioData } from '@wildshard/sdk/audio';
import ND_SAMPLES from '../data/audioSamples.json' with { type: 'json' };

const BLEND = 6;
const rectangles = [
  { id: 'well', zone: 'well', x0: -28, x1: 0, z0: -44, z1: 16 },
  { id: 'plaza', zone: 'market', x0: 0, x1: 22, z0: -26, z1: 20 },
  { id: 'street', zone: 'market', x0: 0.5, x1: 12.5, z0: -230, z1: -26 },
  { id: 'stair', zone: 'market', x0: 22, x1: 70, z0: 2, z1: 10 },
];

const sampleVoices: (readonly [string, { family: string; tap: string; sequence?: boolean; pan?: number; handled?: boolean }])[] = [
      ...['wood', 'metal', 'stone'].map(surface => [`nd.step.${surface}`, { family: `step.${surface}.`, tap: `nd.step.${surface}`, sequence: true }] as const),
      ...Object.entries({ 'nd.jian.swing': 'jian.swing', 'nd.jian.heavy': 'jian.swing.heavy', 'nd.jian.hit.wood': 'jian.hit.wood', 'nd.jian.clang': 'jian.clang', 'nd.jian.hit.stone': 'jian.hit.stone', ...Object.fromEntries(['fire', 'bite', 'reel', 'dock', 'zip'].map(name => [`nd.feizhua.${name}`, `feizhua.${name}`])) }).map(([tap, family]) => [tap, { family, tap }] as const),
      ['nd.chime.gust', { family: 'chime.gust', tap: 'nd.chime.gust', pan: .6 }],
      ['nd.unhandled', { family: 'none', tap: 'none', handled: false }],
 ];

/** Today's market/Well beds, enclosed blend regions, lantern hum limits and ordered cue aliases. */
export const ND_AUDIO = parseAudioData({ entry: { kit: { wind: false, score: false, scene: true } }, cues: [], ambience: null, score: 'default', samples: ND_SAMPLES,
  music: { setPlayback: { scene: { well: 0 }, stateMode: true, waitForBank: true },
    setCatalogue: { inventory: 'title', priority: false, bootSynth: true, titleStings: false, baseSamples: false, cueOverlay: false }, id: 'score.nd', base: 'nd-market', slots: ['nd-market', 'nd-well', 'nd-fight'], bootSlots: ['title', 'nd-market'], synthLead: 'pluck', minFade: 6,
    source: { dir: '/assets/music/nine-dragon-stack/', manifestKey: 'nine-dragon-stack' }, sets: {}, selectMode: 'first', selection: [
      { slots: ['nd-fight', 'nd-market'], when: [{ field: 'mode', op: 'equals', value: 'combat' }] },
      { slots: ['nd-well', 'nd-market'], when: [{ field: 'well', op: 'greater', value: 0.5 }] },
      { slots: ['nd-market', 'nd-market'], when: [] },
    ] },
  zones: { sampleMix: {
    random: { kind: 'stream', id: 'cosmetic' }, initial: { x: 0, z: 0, worldOn: 1 },
    values: [...rectangles.map(row => [row.id, ['hypot', ['max', ['max', ['-', row.x0, 'x'], 0], ['-', 'x', row.x1]], ['max', ['max', ['-', row.z0, 'z'], 0], ['-', 'z', row.z1]]]]),
      ['marketDistance', ['min', 'plaza', ['min', 'street', 'stair']]], ['wellWeight', ['min', 1, ['max', 0, ['+', 0.5, ['/', ['-', 'marketDistance', 'well'], BLEND]]]]]],
    diagnostics: [], pans: [], beds: [{ id: 'bed.nd.market', tap: 'bed.nd.market', level: ['-', 1, 'wellWeight'], panned: true, keepSilent: true, ambient: true },
      { id: 'bed.nd.well', tap: 'bed.nd.well', level: 'wellWeight', panned: true, keepSilent: true, ambient: true }],
    zones: [{ id: 'market', weight: ['-', 1, 'wellWeight'] }, { id: 'well', weight: 'wellWeight' }], calls: [{ tick: null, initial: [8, 20], every: [8, 20], advance: ['and', 'worldOn', ['gt', 'wellWeight', 0.5]], when: 1, reset: 'after', emit: { kind: 'cue', id: 'chime.gust', gain: 0.4 } }],
  }, id: 'ambience.nd', smoothSeconds: 1, tickHz: 4, silentSeconds: 0, holdSeconds: 0, levels: {}, wet: {}, zones: [], blendMetres: BLEND,
    rectangles, beds: [{ id: 'bed.nd.market', zone: 'market' }, { id: 'bed.nd.well', zone: 'well' }], positional: { sample: 'hum.lantern', max: 4, reach: 14 } },
  sampledScene: {
    system: 'shard.nd.audio', tick: 'nd.audio.tick', debug: 'nd.audio', points: { standalone: 'world/placements/nds-lanterns-capped.json', cell: 'world/placements/nds-lanterns-open.json' }, loopTap: 'nd.hum.lantern', countLabel: 'lanterns', eye: 1.68,
    surfaces: { wood: 'planks', planks: 'planks', metal: 'metal' }, fallback: 'rock',
    step: { id: 'nd.step', voices: { planks: 'nd.step.wood', metal: 'nd.step.metal' }, fallback: 'nd.step.stone', count: 4, walkGain: .7, runGain: 1 },
    voices: Object.fromEntries(sampleVoices),
    score: [{ key: 'well', value: 'wellWeight' }],
  },
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
