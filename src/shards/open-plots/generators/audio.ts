import { parseAudioData, type AudioData } from '@wildshard/sharddev/audio';
import { clientPlanSection } from '@wildshard/sharddev/platformSections';

/** Real sound anchors in plot-local metres, supplied by the tile layout owner. */
export interface PlotAudioSpot { readonly id: string; readonly x: number; readonly z: number; readonly reach: number }

/** Compile existing native scene/probe and sample-mix rows. This does not
 * activate a plot, install a service or claim that a recording exists. */
export function plotAudioData(idea: string, spots: readonly PlotAudioSpot[], scoreSource: NonNullable<NonNullable<AudioData['music']>['source']>): AudioData {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(idea) || spots.length < 4 || spots.length > 8
    || new Set(spots.map(row => row.id)).size !== spots.length
    || spots.some(row => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(row.id)
      || !Number.isFinite(row.x) || !Number.isFinite(row.z) || Math.abs(row.x) > 250 || Math.abs(row.z) > 250
      || !Number.isFinite(row.reach) || row.reach <= 0 || row.reach > 100)) throw new Error('Invalid plot audio anchors');
  const name = (id: string): string => `${id === 'ambience' ? 'bed' : 'hum'}.${idea}.${id}`;
  const ids = ['ambience', ...spots.map(row => row.id)].map(name);
  return parseAudioData({
    cues: [], routing: [], ambience: null, score: 'default',
    patches: { initial: {}, bed: name('ambience'), calls: [], cues: {}, groups: { quiet: {
      persistent: false, active: 1, sampleSinks: [], sampleInputs: [], winds: [], noise: [], lfos: [], controls: [], schedules: [],
    } } },
    scene: {
      fields: { res: 2, size: 500, channels: {} }, profiles: {}, paths: {},
      probes: Object.fromEntries(spots.map(row => [row.id, { kind: 'point', x: row.x, z: row.z, inner: 2, outer: row.reach, gain: 1 }])),
      surfaces: { fallback: 'gravel', rules: [] }, hoofKinds: [], initial: {}, values: [],
      voiceGroup: 'quiet', voice: [],
      mix: spots.flatMap(row => [[row.id, row.id], [`${row.id}.pan`, `${row.id}.pan`]]),
      score: [], events: {}, charges: [], deferred: { owner: 'unused', cue: 'unused' },
      chorus: { initial: 600, wait: [600, 600], idle: 600, when: 0, active: 0, call: 'unused', distance: [1, 2], up: 0 },
    },
    music: {
      id: idea, base: 'score', slots: ['score'], bootSlots: ['title'], synthLead: 'pluck', minFade: 2,
      setPlayback: { scene: {}, stateMode: false, waitForBank: true },
      setCatalogue: { inventory: 'title', priority: true, bootSynth: true, titleStings: false, baseSamples: false, cueOverlay: false },
      source: scoreSource, sets: {},
      selection: [{ slots: ['score'], when: [] }], selectMode: 'first',
    },
    // None of the plot's recordings is a first-control bed. Its six loops
    // join the ordinary deferred overlay; the own score waits for that bank.
    samples: { set: idea, bed: 'none', loopGains: Object.fromEntries(ids.map(id => [id, 1])),
      catalogue: { ownMusic: false, priorityOwn: true, overlaySamples: false, inventoryOmitSlots: [], loopOrder: ids } },
    zones: {
      id: idea, smoothSeconds: 0.2, tickHz: 8, silentSeconds: 5, holdSeconds: 0, levels: {}, wet: {}, zones: [],
      sampleMix: {
        random: { kind: 'stream', id: 'cosmetic' }, initial: Object.fromEntries(spots.flatMap(row => [[row.id, 0], [`${row.id}.pan`, 0]])),
        values: [], diagnostics: [], pans: spots.map(row => [name(row.id), `${row.id}.pan`]),
        beds: [{ id: name('ambience'), tap: name('ambience'), ambient: true, panned: false, level: 0.45, keepSilent: false },
          ...spots.map(row => ({ id: name(row.id), tap: name(row.id), ambient: true, panned: true, level: ['*', 0.4, row.id], keepSilent: false }))],
        zones: [{ id: idea, weight: 1 }], calls: [],
      },
    },
  });
}

/** Enter and update the existing native audio director after the real player.
 * No gameplay, equipment, custom interpreter or new host is introduced. */
export function plotAudioClientPlan(): ReturnType<typeof clientPlanSection> {
  return clientPlanSection({ version: 1, features: [{ kind: 'audio.scene' }, { kind: 'world.updates', rows: [{
    kind: 'audio-scene', system: 'plot.audio', after: ['engine.player.update'], before: [],
    inputs: [{ name: 'wind', source: { kind: 'wind', field: 'speed' } }],
  }] }] });
}
