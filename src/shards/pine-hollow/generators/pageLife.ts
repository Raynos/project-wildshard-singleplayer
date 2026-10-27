
import { parseAmbientLife } from '@wildshard/format/ambientLife';
import { parsePageLife , type PageLifeRows as PageLifeRowsType } from '@wildshard/format/pageLife';
import { returnGuest, type ReturnScriptRow } from './returnPrograms';
import { PINE_LIFE } from './ambientLife';

const life = parseAmbientLife(PINE_LIFE);
/** The life guest's declared row (its module unset): output preparation compiles it and replaces this programme in
 *  actors/page-life.json and the quest runtime with the compiled row, whose module it names (GR8). */
export const LIFE_PROGRAM: { script: ReturnScriptRow; bytes: string } = { script: returnGuest('life').row, bytes: '' };
export const PAGE_LIFE: PageLifeRowsType = parsePageLife({
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
  // Both page owners borrow the prepared life module through actors/return-scripts.
  program: LIFE_PROGRAM,
  carcasses: { group: 'scavengers', arrival: life.scavenger.arrival, visitors: life.scavenger.visitors,
    bodyWidths: life.scavenger.bodyWidths, defaultWidth: 0.8, defaultVisitors: life.scavenger.defaultVisitors,
    giveUp: life.scavenger.giveUp, reach: life.scavenger.reach, tint: 0.62, untrackedAge: 60, harvestDelay: 0.5 },
  guide: { group: 'guide', policy: life.guide.policy, cue: life.sounds.pair, gain: 0.9 },
  harvest: { ...life.harvest, camera: { down: 0.55, targetY: 0.3, defaultPitch: 0.35, maxPitch: 0.6 },
    surface: 'litter', sounds: [life.sounds.cutA, life.sounds.cutB], gain: 0.85, kick: [-1.1, 0.8], fallbackSurface: 'flesh', fallbackPan: 0.3, fallbackGain: 0.42 },
  debug: { ...life.debug, flocks: { ravens: 'scavengers', guides: 'guide' }, visitors: { owl: 'sentinel', wood: 'trunk-forager' }, populations: { hares: 'hare' },
    commands: { owlNow: { operation: 'visit', group: 'sentinel' }, woodNow: { operation: 'visit', group: 'trunk-forager' }, ravensTo: { operation: 'scavenge', group: 'scavengers' } } },
});
