
import { parseAmbientLife } from '@wildshard/format/ambientLife';
import { parsePageLife , type PageLifeRows as PageLifeRowsType } from '@wildshard/format/pageLife';
import program from '../behaviour/life.generated.json' with { type: 'json' };
import { PINE_LIFE } from './ambientLife';

const life = parseAmbientLife(PINE_LIFE);
/** Metadata-only declaration; output preparation supplies the verified native module. */
export const LIFE_PROGRAM: { script: { id: string; abi: string; side: string; module: string; source: string; binding: { shard: boolean; }; pages: number; onFail: string; on: string[]; tick: null; reads: string[]; commands: string[]; actors: NonNullable<unknown>; moves: NonNullable<unknown>; strikes: NonNullable<unknown>; cues: NonNullable<unknown>; fields: { candidates: string; now: string; minimum: string; maximum: string; draw: string; scale: string; kill: string; arrival: string; harvest: string; site: string; visit: string; distance: string; reach: string; giveUp: string; present: string; night: string; combat: string; heightBias: string; height: string; coverBias: string; cover: string; radius: string; clear: string; homeX: string; homeZ: string; x: string; z: string; i: string; mode: string; elapsed: string; begin: string; dt: string; leadStep: string; playerX: string; playerZ: string; atX: string; atZ: string; playerY: string; atY: string; floorY: string; taken: string; }; flags: NonNullable<unknown>; zones: NonNullable<unknown>; spots: NonNullable<unknown>; targets: NonNullable<unknown>; spawns: NonNullable<unknown>; signals: { arrival: string; carcass: string; guide: string; shelterScore: string; shelterPlace: string; lead: string; secret: string; }; facts: NonNullable<unknown>; rewards: NonNullable<unknown>; channels: { arrival: string; gather: string; remove: string; fade: string; dim: string; eligible: string; index: string; score: string; x: string; z: string; i: string; mode: string; elapsed: string; event: string; accept: string; leadAppear: string; leadDone: string; }; impulses: NonNullable<unknown>; weather: NonNullable<unknown>; timers: never[]; stateVersion: number; state: never[]; params: { firstX: number; firstZ: number; lastX: number; lastZ: number; length: number; first: number; near: number; past: number; trot: number; gone: number; nightAbove: number; }; sourceHash: string; }; bytes: string; } = { script: program.script, bytes: '' };
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
