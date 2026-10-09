import { parseAudioData } from '@wildshard/sdk/audio';

const enemies = ['boar', 'crab', 'monkey', 'sailor'] as const;
const death = enemies.map((kind) => ({ voice: `island.kill.${kind}`, overrides: { gain: 1.3 }, when: [{ op: 'equals', field: 'killed', value: true }, { op: 'equals', field: 'kind', value: kind }] }));
/** Today's island bank calls, in their original mixer/combat order; the trusted recipes keep their taps and random draws. */
export const DRIFTWOOD_AUDIO = parseAudioData({ cues: [], ambience: null, score: 'default',
  music: { id: 'score.driftwood', base: 'island', slots: ['island'], bootSlots: ['title', 'island'], synthLead: 'marimba', minFade: 0,
    source: null, sets: { island: 'base' }, selectMode: 'first', selection: [{ slots: ['island'], when: [] }] },
  samples: { set: 'driftwood-isle', bed: 'island', loopGains: { island: 0.5 } },
  zones: { id: 'ambience.driftwood', smoothSeconds: 0.1, tickHz: 10, silentSeconds: 0, holdSeconds: 0,
    levels: { surf: 0.85, 'surf-night': 0.3, lap: 0.22, breeze: 0.07, 'breeze-height': 0.1, palms: 0.2, lookout: 0.22, jungle: 0.14, waterfall: 0.45, cove: 0.1, underwater: 0.5 },
    wet: { hold: 0.45, cave: 0.55, shrine: 0.3 }, zones: [
      { id: 'shore', x: 0, z: 12, inner: 188, outer: 330, gain: 1, source: 'terrain.shore' },
      { id: 'shrine', x: -98, z: 108, inner: 8, outer: 16, gain: 1 },
      { id: 'jungle', x: -98, z: 108, inner: 26, outer: 62, gain: 1 },
      { id: 'cove', x: 136, z: 8, inner: 22, outer: 48, gain: 1 },
      { id: 'lookout', x: 94, z: 94, inner: 18, outer: 40, gain: 1 },
      { id: 'headland', x: 98, z: 96, inner: 40, outer: 70, gain: 0.5 },
      { id: 'cave', x: 120, z: 19, inner: 1.2, outer: 3.2, gain: 1, source: 'cove.interior' },
    ] }, routing: [
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
