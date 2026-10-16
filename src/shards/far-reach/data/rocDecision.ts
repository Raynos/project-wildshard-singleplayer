import { CROWN, DAIS, ROC } from './layout';
import { CROWN_STONES } from './crownLayout';
import { STORM } from './storm';

const tallest = CROWN_STONES.reduce((best, stone) => stone.h > best.h ? stone : best);
const spin = Math.sign(STORM.layers[0].spin);
const perch = { x: tallest.x, y: CROWN.y + tallest.h + 0.6, z: tallest.z,
  yaw: Math.atan2(-spin * (tallest.z - (CROWN.z - STORM.ahead)), spin * (tallest.x - CROWN.x)) };

/** Same physical perch, cruise heights and three closing laws as the held Roc. */
export const ROC_WORLD_TARGETS = { targets: [], spots: [
  { id: 'far.roc.perch', at: [perch.x, perch.y, perch.z], yaw: perch.yaw },
] } as const;
export const ROC_MOVES = [
  { id: 'far.roc.perch', kind: 'perch', perch: 'far.roc.perch', speed: 10, turn: 2 },
  { id: 'far.roc.takeoff', kind: 'takeoff', perch: 'far.roc.perch', altitude: ROC.y, seconds: 4, speed: 1.6, turn: 0.15, bank: 0.35 },
  { id: 'far.roc.orbit.high', kind: 'orbit', center: [ROC.x, ROC.z], r: ROC.r, y: ROC.y, speed: 10, turn: 2 },
  { id: 'far.roc.orbit.wall', kind: 'orbit', center: [ROC.x, ROC.z], r: ROC.r, y: CROWN.y + 7, speed: 10, turn: 2 },
  { id: 'far.roc.orbit.low', kind: 'orbit', center: [DAIS.x, DAIS.z], r: DAIS.r * 0.4, y: CROWN.y + DAIS.h + 0.05, speed: 2.4, angularSpeed: 10 / ROC.r, turn: 2 },
  { id: 'far.roc.stalk.high', kind: 'stalk', above: 10, standOff: 2.5, speed: 12, turn: 3, ready: { kind: 'over', radius: 4, height: 2 } },
  { id: 'far.roc.stalk.wall', kind: 'stalk', altitude: CROWN.y + 7, standOff: 14, retreat: true, speed: 12, turn: 3, ready: { kind: 'band', tolerance: 3 } },
  { id: 'far.roc.stalk.low', kind: 'stalk', altitude: CROWN.y + DAIS.h + 0.05, standOff: 3, constantSpeed: true, speed: 2.4, turn: 3,
    ready: { kind: 'range', strike: 'far.roc.sweep' } },
  { id: 'far.roc.dive', kind: 'dive', speed: 20, turn: 4, slope: 0, skim: CROWN.y, altitude: ROC.y, aimHeight: 1.2, targetAltitude: true, contactCompletes: false, maxSeconds: 8 },
] as const;

/** Decision law on the existing held/spawned body and encounter owner. */
export const ROC_DECISION = [{
  id: 'far.roc.decision', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/roc.as',
  binding: { shard: true }, pages: 1, onFail: 'hold', on: ['start', 'stop', 'threshold', 'death', 'timer', 'move.done', 'strike.done'],
  reads: ['nearestPlayer'], commands: ['move', 'strike', 'stop', 'timer'],
  actors: { roc: 'far.roc' },
  moves: { perch: 'far.roc.perch', takeoff: 'far.roc.takeoff', orbitHigh: 'far.roc.orbit.high', orbitWall: 'far.roc.orbit.wall', orbitLow: 'far.roc.orbit.low',
    stalkHigh: 'far.roc.stalk.high', stalkWall: 'far.roc.stalk.wall', stalkLow: 'far.roc.stalk.low', dive: 'far.roc.dive' },
  spots: { perch: 'far.roc.perch' }, strikes: { stoop: 'far.roc.stoop', galeWall: 'far.roc.galeWall', sweep: 'far.roc.sweep' },
  timers: ['beat'], params: { firstRest: 0.5, rest: 2.4, lowRest: 1.2, stoopWindup: 1.2 }, stateVersion: 1,
  state: [{ name: 'step', type: 'i32', default: 0, min: 0, max: 25, scope: 'binding' }],
}] as const;
