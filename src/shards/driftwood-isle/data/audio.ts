import { parseAudioData } from '@wildshard/sdk/audio';

const enemies = ['boar', 'crab', 'monkey', 'sailor'] as const;
const death = enemies.map((kind) => ({ voice: `island.kill.${kind}`, when: [{ op: 'equals', field: 'killed', value: true }, { op: 'equals', field: 'kind', value: kind }] }));
/** Today's island bank calls, in their original mixer/combat order; the trusted recipes keep their taps and random draws. */
export const DRIFTWOOD_AUDIO = parseAudioData({ cues: [], ambience: null, score: 'default', routing: [
  { bus: 'audio', id: 'cue.weapon.fire', when: [{ op: 'number', field: 'dir' }], actions: [{ voice: 'island.whoosh', defaults: { speed: 1, heavy: false } }] },
  ...(['flesh', 'shell', 'wood', 'stone'] as const).flatMap((material) => [`cue.hit.${material}`, `cue.weapon.clang.${material}`].map((id) => ({
    bus: 'audio', id, actions: [{ voice: `island.impact.${material}`, defaults: { strength: 1 } }],
  }))),
  ...enemies.map((kind) => ({ bus: 'audio', id: 'cue.creature.death', when: [{ op: 'equals', field: 'kind', value: kind }], actions: [{ voice: `island.vocal.${kind}`, defaults: { gain: 1.3 } }] })),
  ...(['boar', 'crab', 'sailor'] as const).map((kind) => ({ bus: 'audio', id: 'cue.ai.windup', when: [{ op: 'equals', field: 'kind', value: kind }], actions: [{ voice: `island.windup.${kind}` }] })),
  { bus: 'audio', id: 'cue.ai.windup', when: [{ op: 'equals', field: 'kind', value: 'bear' }], actions: [{ voice: 'island.windup.boar' }] },
  ...(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water'] as const).map((surface) => ({ bus: 'audio', id: `cue.step.${surface}`, actions: [{ voice: `island.step.${surface}`, defaults: { speed: 0 } }] })),
  { bus: 'audio', id: 'cue.player.dive', actions: [{ voice: 'island.dive' }] },
  { bus: 'audio', id: 'cue.player.surface', actions: [{ voice: 'island.surface' }] },
  { bus: 'audio', id: 'cue.feat.earned', actions: [{ voice: 'island.chime' }] },
  { bus: 'audio', id: 'cue.ambient.gull', when: [{ op: 'present', field: 'point' }], actions: [{ voice: 'island.gull' }] },
  { bus: 'combat', id: 'cue.sword.swing', when: [{ op: 'number', field: 'dir' }], actions: [{ voice: 'island.whoosh', defaults: { speed: 1, heavy: false } }] },
  { bus: 'combat', id: 'cue.sword.hit', when: [{ op: 'present', field: 'point' }, { op: 'equals', field: 'kind', value: 'crab' }], actions: [{ voice: 'island.impact.shell', defaults: { strength: 1 } }, ...death] },
  { bus: 'combat', id: 'cue.sword.hit', when: [{ op: 'present', field: 'point' }, { op: 'equals', field: 'kind', value: 'sailor' }], actions: [{ voice: 'island.impact.wood', defaults: { strength: 1 } }, ...death] },
  { bus: 'combat', id: 'cue.sword.hit', when: [{ op: 'present', field: 'point' }], actions: [{ voice: 'island.impact.flesh', defaults: { strength: 1 } }, ...death] },
  ...(['wood', 'stone'] as const).map((material) => ({ bus: 'combat', id: 'cue.sword.clang', when: [{ op: 'present', field: 'point' }, { op: 'equals', field: 'clang', value: material }], actions: [{ voice: `island.impact.${material}`, defaults: { strength: 1 } }] })),
] });
