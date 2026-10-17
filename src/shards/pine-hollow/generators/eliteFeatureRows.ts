import { Rng } from '@wildshard/sdk/random';
import { CHUNK_HALF } from '@wildshard/format/contentBounds';
import identity from '../data/identity.json' with { type: 'json' };
import { PINE_ELITE_DEFS, PINE_ELITE_ANIMALS, ORDINARY } from './eliteRoster';
import { PINE_LANES, PINE_STRIKES } from './strikes';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

const streams = { spawn: 'pine.elite.spawn.', fight: 'pine.elite.', pickup: 'pine.pickup.' };
const fields = ['x', 'z', 'scripted', 'lookWeight', 'lookHeight', 'hidden', 'heading', 'speed', 'turn',
  'engaged', 'leashing', 'phase2', 'clock', 'seed', 'lastHit', 'god', 'dusk', 'night', 'strikeTime', 'call', 'callYaw'];
const observations = ['engaged', 'leashing', 'phase2', 'clock', 'god', 'dusk', 'night'];
const state = (name: string, type: string, value: number | boolean) => ({ name, type, default: value, scope: 'actor' });
const names: Record<string, string[]> = {
  ironhide: ['idle', 'home', 'circle', 'charge'], 'ghost-stag': ['idle', 'home', 'faded', 'stare', 'flee'],
  blackpaw: ['idle', 'home', 'lurk', 'roar', 'charge', 'swipe', 'stalk'], 'imperial-bull': ['idle', 'home', 'bugle', 'charge', 'posture'],
};
const sourceFiles: Record<string, string> = { ironhide: 'ironhide', 'ghost-stag': 'ghost', blackpaw: 'blackpaw', 'imperial-bull': 'imperial' };
const extra: Record<string, [string, string, number | boolean][]> = {
  ironhide: [['again', 'bool', false]],
  'ghost-stag': [['cd', 'f64', 3], ['lastHit', 'f64', -1000000], ['fadeT', 'f64', 0], ['autoT', 'f64', 5]],
  blackpaw: [['roarCd', 'f64', 0], ['swipeT', 'f64', -1]],
  'imperial-bull': [['bugledPhase', 'f64', -1], ['call', 'f64', 0]],
};
function fieldRow(id: string) { return ({ id, source: observations.includes(id) ? 'observed' : id === 'call' || id === 'callYaw' ? 'channel' : ['heading', 'speed', 'turn'].includes(id) ? 'value' : id, ...(id === 'call' || id === 'callYaw' ? { channel: id } : {}), ...(id === 'lastHit' ? { fallback: -1000000 } : {}) }); }
function savedField([field, type]: [string, string, number | boolean]) { return ({ field, slot: field, kind: type === 'bool' ? 'boolean' : 'number', ...(field === 'lastHit' ? { never: -1000000 } : {}) }); }
const allCues = ['squeal', 'grunt', 'signature', 'fade', 'call', 'reappear', 'burst', 'growl', 'roar', 'roarPhase2', 'bugle'];
const charge = (id: string) => id === 'ironhide' ? PINE_LANES.ironhide : id === 'blackpaw' ? PINE_LANES.blackpaw : PINE_LANES.imperial;
/** Fight laws are v1 AS; every target, variant, stream, move, contact and legacy slot is authored data. */
export const ELITE_FEATURE_ROWS = {
  step: 'pine.elites', version: 5, legacy: { versions: [1, 2, 3, 4], scripts: 'scripts', stun: 'stun', upgrades: [1, 2, 3, 4].map(version => ({ version, bindInstalled: version === 1, clearStun: version < 3, remove: version === 3 ? ['prelude'] : [], defaults: version === 1 ? { 'imperial-bull': { rival0: null, rival1: null, rivalCharge0: false, rivalCharge1: false } } : {} })) },
  view: { puffPool: { capacity: 4, segments: [20, 12], order: 28 }, tellColor: [2.4, 0.75, 0.3], puffColor: [0.75, 1.6, 2], cues: [
    { id: 'signature', signature: true }, { id: 'squeal', voice: 'boar_squeal' }, { id: 'grunt', voice: 'boar_grunt' }, { id: 'call', voice: 'deer_call' },
    { id: 'growl', voice: 'bear_growl' }, { id: 'roar', voice: 'bear_roar', trauma: 0.3, effect: { kind: 'puff', at: 'head', height: 0, speed: 1, size: 8, lifetime: 0.55, opacity: 0.5 } }, { id: 'roarPhase2', voice: 'bear_roar', trauma: 0.3, effect: { kind: 'puff', at: 'head', height: 0, speed: 1, size: 11, lifetime: 0.55, opacity: 0.5 } }, { id: 'bugle', voice: 'elk_bugle' },
    { id: 'fade', effect: { kind: 'puff', at: 'body', height: 1.1, speed: 0.6, size: 3.2, lifetime: 0.7, opacity: 0.95 } },
    { id: 'reappear', effect: { kind: 'puff', at: 'body', height: 1.1, speed: 2.8, size: 0.8, lifetime: 0.5, opacity: 0.8 } },
    { id: 'burst', effect: { kind: 'dirt', height: 0.4, count: 18 } },
  ] },
  bounds: [-CHUNK_HALF, CHUNK_HALF, -CHUNK_HALF, CHUNK_HALF],
  streams, ordinary: ORDINARY,
  fights: Object.values(PINE_ELITE_DEFS).map(def => {
    const who = PINE_ELITE_ANIMALS[def.id]; if (who === undefined) throw new Error('Missing elite identity');
    const rivals = def.id === 'imperial-bull', slots = [{ id: 'main', handle: 1, release: 'retain' },
      ...(rivals ? [{ id: 'rival0', handle: 2, release: 'detach' }, { id: 'rival1', handle: 3, release: 'detach' }] : [])];
    const species = [{ id: 'main', kind: who.kind, variant: who.variant },
      ...(rivals ? [{ id: 'rival0', kind: 'elk', variant: 'big-bull' }, { id: 'rival1', kind: 'elk', variant: 'bull' }] : [])];
    const strikes = def.id === 'ghost-stag' ? [] : [
      { id: 'charge', tell: 'lane', row: charge(def.id), trauma: def.id === 'ironhide' ? 0.45 : 0.5, stun: 0 },
      { id: 'chargePhase2', tell: 'lane', row: { ...charge(def.id), id: `${charge(def.id).id}.phase2`, windup: def.id === 'ironhide' ? 0.62 : def.id === 'blackpaw' ? 0.6 : 0.75,
        motion: { ...charge(def.id).motion, speed: (charge(def.id).motion?.speed ?? 0) * 1.12 } }, trauma: def.id === 'ironhide' ? 0.45 : 0.5, stun: 0 },
      ...(def.id === 'ironhide' ? [{ id: 'again', tell: 'lane', row: { ...PINE_LANES.ironhide, id: 'strike.ironhide.again', windup: 0.55, motion: { ...PINE_LANES.ironhide.motion, speed: 12.5 * 1.1 } }, trauma: 0.45, stun: 0 }] : []),
      ...(def.id === 'blackpaw' ? [{ id: 'roar', tell: 'ring', activeCue: 'roar', row: { ...PINE_STRIKES.roar, cooldown: 0 }, trauma: 0.4, stun: 1.3 },
        { id: 'roarPhase2', tell: 'ring', activeCue: 'roarPhase2', row: { ...PINE_STRIKES.roarPhase2, cooldown: 0 }, trauma: 0.4, stun: 1.3 }, { id: 'swipe', row: PINE_STRIKES.swipe, trauma: 0.35, stun: 0 }] : []),
      ...(rivals ? [{ id: 'rival', tell: 'lane', row: PINE_LANES.rival, trauma: 0.35, stun: 0 }] : []),
    ];
    const script = { id: `pine.elite.${def.id}`, abi: '1.0', side: 'sim', source: `behaviour/elites/${sourceFiles[def.id]}.as`, module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
      binding: { spawnGroup: `pine.elite.${def.id}` }, pages: 1, onFail: 'hold', tick: 10, on: ['start', 'tick', 'signal'],
      reads: ['x', 'z', 'yaw', 'alive', 'hpShare', 'distance', 'nearestPlayer', 'field', 'random', 'groundHeight', 'strikeState', 'spawnGroupAlive'],
      commands: ['spawn', 'move', 'strike', 'stop', 'field', 'cue', 'channel'],
      actors: Object.fromEntries(slots.map(row => [row.id, row.id])), spawns: { ...Object.fromEntries(slots.map(row => [row.id, row.id])), group: `pine.elite.${def.id}` },
      moves: { steer: 'steer', relocate: 'relocate' }, strikes: Object.fromEntries(strikes.map(row => [row.id, row.row.id])),
      fields: Object.fromEntries(fields.map(id => [id, id])), cues: Object.fromEntries(allCues.map(id => [id, id])), channels: { call: 'call', callYaw: 'callYaw' },
      stateVersion: 1, state: [state('mode', 'i32', 0), state('modeT', 'f64', 0), state('wx', 'f64', def.lair.x), state('wz', 'f64', def.lair.z), state('wanderT', 'f64', 0),
        ...(extra[def.id] ?? []).map(([name, type, value]) => state(name, type, value))],
      params: { lairX: def.lair.x, lairZ: def.lair.z, lairRadius: def.lair.r, awareRadius: def.awareR, leashRadius: def.leashR, bound: CHUNK_HALF - 24,
        mouthX: LAYOUT.BEAR_CAVE.x - Math.sin(LAYOUT.BEAR_CAVE.rot) * 1.5, mouthZ: LAYOUT.BEAR_CAVE.z - Math.cos(LAYOUT.BEAR_CAVE.rot) * 1.5,
        burstX: LAYOUT.BEAR_CAVE.x - Math.sin(LAYOUT.BEAR_CAVE.rot) * 4, burstZ: LAYOUT.BEAR_CAVE.z - Math.cos(LAYOUT.BEAR_CAVE.rot) * 4, main: 1, rival0: 2 },
    };
    return { def, kind: who.kind, variant: who.variant, main: 'main', spawn: 'main', mode: 'mode', modes: names[def.id], forces: def.id === 'blackpaw' ? { roar: 1, charge: 2 } : def.id === 'imperial-bull' ? { bugle: 1, charge: 2 } : def.id === 'ghost-stag' ? { fade: 1 } : { charge: 1 }, defaultForce: def.id === 'blackpaw' || def.id === 'imperial-bull' ? 2 : 1,
      observations: observations.map(source => ({ field: source, source })),
      program: { step: script.id, roster: 'pine.roster', seed: new Rng(identity.seed).fork(`${streams.fight}${def.id}`).snapshot().initial, maximum: slots.length, controlState: 'sidestep', script, bytes: '', slots, species,
        sites: slots.map(row => ({ id: row.id, slot: row.id, face: 'player', ...(row.id === 'main' ? { point: [def.lair.x, def.lair.z] } : {}) })),
        spawns: slots.map(row => ({ id: row.id, species: row.id, site: row.id })), fields: fields.map(fieldRow),
        flags: [], cues: allCues, channels: ['call', 'callYaw'], strikes,
        moves: [{ id: 'steer', kind: 'steer', ground: true, speed: 8, turn: 5, fields: { yaw: 'heading', speed: 'speed', turn: 'turn' } },
          { id: 'relocate', kind: 'relocate', point: { kind: 'fields', x: 'x', z: 'z' }, facing: 'target' }] },
      legacy: { fields: [...['modeT', 'wx', 'wz', 'wanderT'].map(field => ({ field, slot: field, kind: 'number' })), ...(extra[def.id] ?? []).filter(([field]) => field !== 'call').map(savedField)],
        rivals: rivals ? slots.slice(1).map((row, i) => ({ slot: row.id, field: `rival${i}`, charge: `rivalCharge${i}` })) : [], actorPrefix: 'creature:', phase: 'p2', ...(def.id === 'ghost-stag' || def.id === 'blackpaw' ? { hidden: 'hidden' } : {}), lanes: def.id === 'ghost-stag' ? [] : [{ slot: 'main', strike: 'charge' }, ...(rivals ? [{ slot: 'rival0', strike: 'rival' }, { slot: 'rival1', strike: 'rival' }] : [])], rivalMode: 3 } };
  }),
};
