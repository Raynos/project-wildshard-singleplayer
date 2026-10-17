import { parseAudioData } from '@wildshard/sdk/audio';
import {NALATI_PHRASES} from './audioPhrases';

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
  zones: { id: 'ambience.nalati', smoothSeconds: 0.35, tickHz: 4, silentSeconds: 8, holdSeconds: 3,
    levels: { river: 0.9, meltwater: 0.85, camp: 0.8, rain: 0.9, stormwind: 0.85 }, wet: {}, zones: [
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
