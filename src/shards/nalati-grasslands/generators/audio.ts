import { parseAudioData } from '@wildshard/sdk/audio';
import {NALATI_PHRASES} from './audioPhrases';

const PANS = [['river', 'riverPan'], ['camp', 'campPan'], ['meltwater', 'meltPan']];
const LEVELS = { river: 0.9, meltwater: 0.85, camp: 0.8, rain: 0.9, stormwind: 0.85 };
const LOOPS = ['steppe-wind', 'steppe-larks', 'steppe-night', 'river', 'meltwater', 'camp', 'highwind', 'coldwind', 'rain', 'stormwind'];

/** Existing Kazakh-folk calm/tension/boss catalogue, fallback order and steppe mixer data. */
export const NALATI_AUDIO = parseAudioData({ synth:NALATI_PHRASES, cues: [], ambience: null, score: 'default',
  music: { setPlayback: { scene: { zone: 'grass', night: false, storm: false, boss: null }, stateMode: false, waitForBank: false },
    setCatalogue: { inventory: 'base', priority: true, bootSynth: false, titleStings: true, baseSamples: true, cueOverlay: true }, id: 'score.nalati', base: 'steppe-grass', slots: ['steppe-grass', 'steppe-sky', 'steppe-snow', 'steppe-night', 'steppe-storm', 'steppe-king'], bootSlots: ['title', 'steppe-grass'],
    synthLead: 'pluck', minFade: 6, source: { dir: '/assets/music/nalati/', manifestKey: 'nalati' }, sets: {}, selectMode: 'all', selection: [
      { slots: ['steppe-king'], when: [{ field: 'boss', op: 'equals', value: 'king' }] },
      { slots: ['steppe-storm'], when: [{ field: 'storm', op: 'equals', value: true }] },
      { slots: ['steppe-night'], when: [{ field: 'night', op: 'equals', value: true }] },
      { slots: ['steppe-grass'], when: [{ field: 'zone', op: 'equals', value: 'grass' }] },
      { slots: ['steppe-sky'], when: [{ field: 'zone', op: 'equals', value: 'sky' }] },
      { slots: ['steppe-snow'], when: [{ field: 'zone', op: 'equals', value: 'snow' }] }, { slots: ['steppe-grass'], when: [] },
    ] },
  samples: { set: 'nalati-grasslands', bed: 'steppe', loopGains: {} },
  zones: { sampleMix: {
    random: { kind: 'seeded', salt: 'nalati.steppe-ambience' }, initial: { valley: 1, bowl: 0, snow: 0, river: 0, melt: 0, camp: 0, night: 0, wind: 5, gust: 0.3, out: 1, rain: 0, storm: 0, riverPan: 0, campPan: 0, meltPan: 0 },
    values: [['w', ['clamp', ['/', 'wind', 14], 0, 1]], ['g', ['clamp', 'gust', 0, 1]],
      ['day', ['-', 1, ['clamp', 'night', 0, 1]]], ['outside', ['clamp', 'out', 0, 1]], ['calm', ['-', 1, ['clamp', ['*', 'storm', 1.4], 0, 1]]]],
    pans: PANS, diagnostics: [['valley', 'valley'], ['bowl', 'bowl'], ['snow', 'snow']],
    beds: [
      { id: 'steppe-wind', level: ['*', ['+', 'valley', ['*', 0.45, 'bowl']], ['+', 0.35, ['*', 0.4, 'w'], ['*', 0.35, 'g']]] },
      { id: 'highwind', level: ['+', ['*', 'bowl', ['+', 0.3, ['*', 0.45, 'w'], ['*', 0.35, 'g']]], ['*', 0.1, 'valley', 'g']] },
      { id: 'coldwind', level: ['*', 'snow', ['+', 0.45, ['*', 0.35, 'w'], ['*', 0.25, 'g']]] },
      { id: 'steppe-larks', level: ['*', 'day', 'calm', ['+', ['*', 0.8, 'valley'], ['*', 0.45, 'bowl']], ['-', 1, ['*', 0.6, 'w']]] },
      { id: 'steppe-night', level: ['*', ['clamp', 'night', 0, 1], 'calm', ['+', ['*', 0.8, 'valley'], ['*', 0.7, 'bowl'], ['*', 0.15, 'snow']]] },
      { id: 'river', level: ['*', LEVELS.river, ['clamp', 'river', 0, 1]] },
      { id: 'meltwater', level: ['*', LEVELS.meltwater, ['clamp', 'melt', 0, 1]] },
      { id: 'camp', level: ['*', LEVELS.camp, ['clamp', 'camp', 0, 1]] },
      { id: 'rain', level: ['*', LEVELS.rain, ['clamp', 'rain', 0, 1]] },
      { id: 'stormwind', level: ['*', LEVELS.stormwind, ['clamp', 'storm', 0, 1]] },
    ].sort((a, b) => LOOPS.indexOf(a.id) - LOOPS.indexOf(b.id)).map(row => Object.assign(row, { level: ['*', row.level, 'outside'], tap: `steppe.bed:${row.id}`, keepSilent: false, ambient: false, panned: PANS.some(([id]) => id === row.id) })),
    zones: [{ id: 'grass', weight: 'valley' }, { id: 'sky', weight: 'bowl' }, { id: 'snow', weight: 'snow' }],
    calls: [
      { tick: 'steppe.herd', advance: 1, reset: 'before', initial: [8, 18], every: [14, 32], when: ['and', ['gt', 'out', 0.5], ['lt', 'storm', 0.5], ['gt', 'bowl', 0.35], ['gt', 'day', 0.3]], emit: { kind: 'animal', choices: ['horse_neigh', 'horse_snort'], chance: 0.6, distance: [90, 200], up: 10 } },
      { tick: 'steppe.marmot', advance: 1, reset: 'before', initial: [6, 14], every: [9, 22], when: ['and', ['gt', 'out', 0.5], ['lt', 'storm', 0.5], ['gt', ['+', 'bowl', 'snow'], 0.4], ['gt', 'day', 0.5]], emit: { kind: 'animal', choices: ['marmot_whistle'], chance: 1, distance: [50, 140], up: 10 } },
      { tick: 'steppe.eagle', advance: 1, reset: 'before', initial: [15, 30], every: [22, 48], when: ['and', ['gt', 'out', 0.5], ['lt', 'storm', 0.5], ['gt', 'snow', 0.3], ['gt', 'day', 0.4]], emit: { kind: 'animal', choices: ['eagle_cry'], chance: 1, distance: [140, 320], up: 60 } },
    ],
  }, id: 'ambience.nalati', smoothSeconds: 0.35, tickHz: 4, silentSeconds: 8, holdSeconds: 3,
    levels: LEVELS, wet: {}, zones: [
      { id: 'river', x: 0, z: 0, inner: 6, outer: 70, gain: 1, source: 'river.distance' },
      { id: 'brook', x: 0, z: 0, inner: 2, outer: 24, gain: 0.45, source: 'brook.distance' },
      { id: 'fall', x: -48, z: -92, inner: 10, outer: 90, gain: 0.6 },
      { id: 'camp', x: 88, z: 212, inner: 6, outer: 45, gain: 1 },
      { id: 'summer', x: -91, z: -26, inner: 5, outer: 30, gain: 0.6 },
      { id: 'melt', x: 0, z: 0, inner: 3, outer: 40, gain: 1, source: 'brook.distance' },
    ] },
  voiceBindings: [
    ...['bowTwang', 'bowDraw', 'bowFullDraw', 'bowLetDown', 'javelinThrow', 'sabreSwing'].map(method => ({ id: `steppe.${method}`, owner: 'voices', method, args: method === 'bowTwang' ? [{kind: 'field', field: 'strength', fallback: 1}] : [] })),
    { id: 'steppe.thrustPending', owner: 'thrust', method: 'start', args: [] },
    ...['arrowImpact', 'javelinImpact', 'sabreHit'].map(method => ({ id: `steppe.${method}`, owner: 'voices', method, args: [{kind: 'field', field: 'surface', fallback: 'ground'}, {kind: 'field', field: 'pan', fallback: 0}, {kind: 'field', field: 'gain', fallback: 1}] })),
  ],
  routing: [
    { id: 'cue.bow.loose', actions: [] },
    { id: 'cue.bow.loose.power', actions: [{ voice: 'steppe.bowTwang', defaults: { strength: 1 } }] },
    { id: 'cue.bow.draw', actions: [{ voice: 'steppe.bowDraw' }] },
    { id: 'cue.bow.full', actions: [{ voice: 'steppe.bowFullDraw' }] },
    { id: 'cue.bow.letdown', actions: [{ voice: 'steppe.bowLetDown' }] },
    { id: 'cue.spear.throw', actions: [{ voice: 'steppe.javelinThrow' }] },
    { id: 'cue.sabre.swing', actions: [{ voice: 'steppe.sabreSwing' }] },
    { id: 'cue.spear.thrust', actions: [{ voice: 'steppe.thrustPending' }] },
    ...[['cue.arrow.hit', 'steppe.arrowImpact'], ['cue.javelin.hit', 'steppe.javelinImpact'], ['cue.sabre.hit', 'steppe.sabreHit']].flatMap(([id, voice]) => [
      { id, when: [{field: 'surface', op: 'in', values: ['wood', 'flesh']}], actions: [{voice, defaults: {pan: 0, gain: 1}}] },
      { id, actions: [{voice, overrides: {surface: 'ground'}, defaults: {pan: 0, gain: 1}}] },
    ]),
  ],
});
