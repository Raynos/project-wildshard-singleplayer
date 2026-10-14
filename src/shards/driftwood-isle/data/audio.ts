import { ISLAND_PLAYBACK } from './audioPlayback';
import { ISLAND_PCM } from './audioPcm';
import { ISLAND_ROUTING } from './ambienceRouting';
import { ISLAND_ZONE_PROGRAMS, ISLAND_ZONE_SCHEDULES } from './audioOneShots';
import { ISLAND_SURF, ISLAND_GULL } from './audioPhrases';
import { ISLAND_BEDS } from './islandBeds';
import { DRIFTWOOD_AUDIO_MIX } from './audioMix';
import { parseAudioData } from '@wildshard/sdk/audio';

const enemies = ['boar', 'crab', 'monkey', 'sailor'] as const;
const death = enemies.map((kind) => ({ voice: `island.kill.${kind}`, overrides: { gain: 1.3 }, when: [{ op: 'equals', field: 'killed', value: true }, { op: 'equals', field: 'kind', value: kind }] }));
/** Today's island bank calls, in their original mixer/combat order; the trusted recipes keep their taps and random draws. */
export const DRIFTWOOD_AUDIO = parseAudioData({ playback:ISLAND_PLAYBACK, surfaces:{fallback:'sand',rules:[
    {kind:'floor',source:'decks',tolerance:0.45,surface:'planks'},{kind:'floor',source:'stone',tolerance:0.45,surface:'stone'},
    {kind:'value',source:'height',op:'lt',threshold:0.02,surface:'water'},
    {kind:'value',source:'slope',op:'gt',threshold:0.32,surface:'rock'},
    {kind:'value',source:'height',op:'lt',threshold:0.45,surface:'wetSand'},
    {kind:'value',source:'height',op:'gt',threshold:3.35,surface:'grass',when:['not',['lt','trail',3.3]]}]}, loopGraphs:{shrine:[
    {kind:'filter',id:'lp',type:'lowpass',frequency:480,q:0.6},{kind:'connect',from:'lp',to:'out'},
    {kind:'oscillator',id:'d2',type:'sine',frequency:0,midi:38,detune:0},{kind:'gain',id:'g1',value:0.55},{kind:'connect',from:'d2',to:'g1'},{kind:'connect',from:'g1',to:'lp'},{kind:'start',id:'d2'},
    {kind:'oscillator',id:'d3',type:'sine',frequency:0,midi:50,detune:4},{kind:'gain',id:'g2',value:0.16},{kind:'connect',from:'d3',to:'g2'},{kind:'connect',from:'g2',to:'lp'},{kind:'start',id:'d3'},
    {kind:'oscillator',id:'a2',type:'triangle',frequency:0,midi:45,detune:-3},{kind:'gain',id:'fifth',value:0.14},{kind:'connect',from:'a2',to:'fifth'},{kind:'connect',from:'fifth',to:'lp'},{kind:'start',id:'a2'},
    {kind:'oscillator',id:'lfo',type:'sine',frequency:0.09},{kind:'gain',id:'lg',value:0.1},{kind:'connect',from:'lfo',to:'lg'},{kind:'connect',from:'lg',to:'fifth',param:'gain'},{kind:'start',id:'lfo'}
  ]}, observations:[
    {id:'shard.driftwood.dusk',inputs:[{id:'hasClock',source:'clock',path:[],op:'present'},{id:'night',source:'clock',path:['night'],op:'number',fallback:0},{id:'dusk',source:'clock',path:['dusk'],op:'number',fallback:0}],before:['main.world'],after:[],interval:0,initial:{},frame:[{write:'shrine.dusk',value:'dusk',when:'hasClock'},{write:'ambience.night',value:'night',when:'hasClock'}],steps:[]},
    {id:'shard.driftwood.shrineHum',inputs:[],before:['main.frame'],after:['engine.audio.listener'],interval:0,initial:{},frame:[],steps:[{kind:'call',call:'hum'}]},
    {id:'shard.driftwood.ambience',inputs:[],before:['main.frame'],after:['shard.driftwood.shrineHum'],interval:0,initial:{},frame:[],steps:[{kind:'call',call:'ambience'}]}
  ], pcm:ISLAND_PCM,cues: [], synth:{gull:ISLAND_GULL}, ambience: { phrases:[ISLAND_SURF], bed:'island', winds:[
    { frequency:180,q:0.4,pan:-0.3,rate:0.05,gain:0.05,cutoff:900 }, { frequency:420,q:0.6,pan:0.3,rate:0.08,gain:0.03,cutoff:1100 },
    { frequency:1500,q:0.35,pan:0,rate:0.03,gain:0.02,cutoff:5000 }
  ], gust:{scope:'audio.ocean.surf',scopeFirst:true,startTap:'audio.startIsland',tap:'audio.gust',gentle:1.4,wait:[5,12],rise:[1.5,3],fall:[2,4],amount:[0.5,1.6]} }, score: 'default',
  music: { catalogue: { mode: 'bank', extraStings: [], stingSets: {} }, id: 'score.driftwood', base: 'island', slots: ['island'], bootSlots: ['title', 'island'], synthLead: 'marimba', minFade: 0,
    source: null, sets: { island: 'base' }, selectMode: 'first', selection: [{ slots: ['island'], when: [] }] },
  samples: { catalogue: { ownMusic: false, priorityOwn: false, overlaySamples: true, inventoryOmitSlots: [], loopOrder: ['island', 'underwater', 'pickup', 'shrine'] }, set: 'driftwood-isle', bed: 'island', loopGains: { island: 0.5 } },
  zones: { routing:ISLAND_ROUTING,nodes: [
    { id: 'occl', out: 'ambient', filter: ['lowpass', 20000, 0.5] },
    { id: 'surfPan', out: 'occl', panner: [12, 1, 400], follow: { zone: 'shore', rays: 256, step: 2, refine: 3, diag: 'shoreDist' } },
    { id: 'fallPan', out: 'ambient', panner: [6, 1.1, 250], at: 'fall' },
  ], programs:ISLAND_ZONE_PROGRAMS,schedules:ISLAND_ZONE_SCHEDULES,graph:ISLAND_BEDS, mix:DRIFTWOOD_AUDIO_MIX, id: 'ambience.driftwood', smoothSeconds: 0.1, tickHz: 10, silentSeconds: 0, holdSeconds: 0,
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
