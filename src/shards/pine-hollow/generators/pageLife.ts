import { parseAmbientLife } from '@wildshard/format/ambientLife';
import { parsePageLife } from '@wildshard/format/pageLife';
import { nameBlob } from '@wildshard/sdk/blobs';
import program from '../behaviour/life.generated.json' with { type: 'json' };
import { PINE_LIFE } from './ambientLife';

const life = parseAmbientLife(PINE_LIFE);
/** Admission budgets and pins the same fixed memory that the page prepares. */
export const LIFE_WASM = nameBlob('behaviour/pine.life.wasm', 'wasm',
  Uint8Array.from(atob(program.bytes), character => character.codePointAt(0) ?? 0),
  { critical: true, script: { abi: 1, pages: 1 } });
export const PAGE_LIFE = parsePageLife({
  version: 1, seed: life.seed, system: { id: life.system.id, after: life.system.after, before: life.system.before },
  draw: { library: 'look/wildlife-draw.json', capacity: life.scavenger.flock.count + life.forager.count + 2, glow: [0.45, 0.75] },
  flocks: [
    { id: 'scavengers', row: life.scavenger.flock, perches: [], packed: true, borrowed: false, audio: 'bank' },
    { id: 'sentinel', row: life.sentinel.flock, perches: life.sentinel.perches, packed: true, borrowed: false, audio: 'bank' },
    { id: 'trunk-forager', row: life.trunkForager.flock, perches: life.trunkForager.perches, packed: true, borrowed: false, audio: 'bank' },
    { id: 'guide', row: life.guide.flock, perches: [], packed: false, borrowed: false, audio: 'cue' },
  ],
  foragers: [{ row: { id: life.forager.id, count: life.forager.count, place: life.forager.place, policy: life.forager.policy }, model: life.forager.model, scale: life.forager.scale, alertRate: 1.3, alertGain: 0.5, sitPitch: 0.2,
    combat: { target: { kind: life.forager.id, damage: 1 }, preyY: 0.2, hits: [[0, 0.2, 0.28]] } }],
  program,
  carcasses: { group: 'scavengers', arrival: life.scavenger.arrival, visitors: life.scavenger.visitors,
    bodyWidths: life.scavenger.bodyWidths, defaultWidth: 0.8, defaultVisitors: life.scavenger.defaultVisitors,
    giveUp: life.scavenger.giveUp, reach: life.scavenger.reach, tint: 0.62, untrackedAge: 60, harvestDelay: 0.5 },
  guide: { group: 'guide', policy: life.guide.policy, cue: life.sounds.pair, gain: 0.9 },
  harvest: { ...life.harvest, camera: { down: 0.55, targetY: 0.3, defaultPitch: 0.35, maxPitch: 0.6 },
    surface: 'litter', sounds: [life.sounds.cutA, life.sounds.cutB], gain: 0.85, kick: [-1.1, 0.8], fallbackSurface: 'flesh', fallbackPan: 0.3, fallbackGain: 0.42 },
  debug: { ...life.debug, flocks: { ravens: 'scavengers', guides: 'guide' }, visitors: { owl: 'sentinel', wood: 'trunk-forager' }, populations: { hares: 'hare' },
    commands: { owlNow: { operation: 'visit', group: 'sentinel' }, woodNow: { operation: 'visit', group: 'trunk-forager' }, ravensTo: { operation: 'scavenge', group: 'scavengers' } } },
});
