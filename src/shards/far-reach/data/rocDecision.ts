import { parseActorMoves } from '@wildshard/format/actorMoves';
import { parseDecisionScripts } from '@wildshard/format/decisionScripts';
import { parseWorldTargets } from '@wildshard/format/worldTargets';
import { CROWN, DAIS, ROC } from './layout';
import { ROC_PROFILE } from './brains';

/** Same physical perch, cruise heights and three closing laws as the held Roc. */
export const ROC_WORLD_TARGETS = parseWorldTargets({ targets: [], spots: [
  { id: 'far.roc.perch', at: [ROC_PROFILE.perch.x, ROC_PROFILE.perch.y, ROC_PROFILE.perch.z], yaw: ROC_PROFILE.perch.yaw },
] });
export const ROC_MOVES = parseActorMoves([
  { id: 'far.roc.perch', kind: 'perch', perch: 'far.roc.perch', speed: 10, turn: 2 },
  { id: 'far.roc.takeoff', kind: 'takeoff', perch: 'far.roc.perch', altitude: ROC.y, seconds: 4, speed: 1.6, turn: 0.15, bank: 0.35 },
  { id: 'far.roc.orbit.high', kind: 'orbit', center: [ROC.x, ROC.z], r: ROC.r, y: ROC.y, speed: 10, turn: 2 },
  { id: 'far.roc.orbit.wall', kind: 'orbit', center: [ROC.x, ROC.z], r: ROC.r, y: CROWN.y + 7, speed: 10, turn: 2 },
  { id: 'far.roc.orbit.low', kind: 'orbit', center: [DAIS.x, DAIS.z], r: DAIS.r * 0.4, y: CROWN.y + DAIS.h + 0.05, speed: 2.4, turn: 2 },
  { id: 'far.roc.stalk.high', kind: 'stalk', above: 10, standOff: 2.5, speed: 12, turn: 3, ready: { kind: 'over', radius: 4, height: 2 } },
  { id: 'far.roc.stalk.wall', kind: 'stalk', altitude: CROWN.y + 7, standOff: 14, retreat: true, speed: 12, turn: 3, ready: { kind: 'band', tolerance: 3 } },
  { id: 'far.roc.stalk.low', kind: 'stalk', altitude: CROWN.y + DAIS.h + 0.05, standOff: 3, constantSpeed: true, speed: 2.4, turn: 3,
    ready: { kind: 'range', strike: 'far.roc.sweep' } },
  { id: 'far.roc.dive', kind: 'dive', speed: 20, turn: 4, slope: 0, skim: CROWN.y, altitude: ROC.y, aimHeight: 1.2, maxSeconds: 8 },
]);

/** Build-only until the existing held/spawned owner lends its live authority. */
export const ROC_DECISION = parseDecisionScripts([{
  id: 'far.roc.decision', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/roc.as',
  binding: { shard: true }, pages: 1, onFail: 'hold', on: ['start', 'stop', 'threshold', 'death', 'timer', 'move.done', 'strike.done'],
  reads: ['nearestPlayer'], commands: ['move', 'strike', 'stop', 'timer'],
  actors: { roc: 'far.roc' },
  moves: { perch: 'far.roc.perch', takeoff: 'far.roc.takeoff', orbitHigh: 'far.roc.orbit.high', orbitWall: 'far.roc.orbit.wall', orbitLow: 'far.roc.orbit.low',
    stalkHigh: 'far.roc.stalk.high', stalkWall: 'far.roc.stalk.wall', stalkLow: 'far.roc.stalk.low', dive: 'far.roc.dive' },
  spots: { perch: 'far.roc.perch' }, strikes: { stoop: 'far.roc.stoop', galeWall: 'far.roc.galeWall', sweep: 'far.roc.sweep' },
  timers: ['beat'], params: { firstRest: 0.5, rest: 2.4, lowRest: 1.2, stoopWindup: 1.2 }, stateVersion: 1,
  state: [{ name: 'step', type: 'i32', default: 0, min: 0, max: 25, scope: 'binding' }],
}]);
