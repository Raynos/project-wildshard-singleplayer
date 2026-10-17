import LAYOUT from '../../data/layout.generated.json' with { type: 'json' };
import { MATRIARCH as M, MAW_DATA, TAIL_SWEEP_DATA, BUFFET_DATA } from './species/matriarch';

/** Motion borrows the same flight motor and above-ground altitudes as the original body. */
export const MATRIARCH_MOVES = [
  { id: 'sunscar.matriarch.rise', kind: 'rise', from: M.groundAlt, to: M.alt, rate: (M.alt - M.groundAlt) / 3.2, speed: 3, turn: 0.6, yawLead: 0.4 },
  ...[M.alt, M.stormAlt].flatMap((y, phase) => [
    { id: `sunscar.matriarch.orbit.${phase}`, kind: 'orbit', center: [LAYOUT.BASIN.x, LAYOUT.BASIN.z], r: M.circleR, y, lead: 0.5, speed: M.speed, turn: 1.1 },
    { id: `sunscar.matriarch.dive.${phase}`, kind: 'dive', speed: M.diveSpeed, turn: 2.4, slope: 0.4, skim: M.skim, altitude: y, aimHeight: 1.2, strike: MAW_DATA.id, contactCompletes: false, maxSeconds: 5.5 },
    { id: `sunscar.matriarch.climb.${phase}`, kind: 'climb', speed: M.speed, speedBonus: 3, turn: 1, seconds: M.climbFor, altitude: y },
  ]),
  { id: 'sunscar.matriarch.lie', kind: 'lie', from: M.stormAlt, to: M.lieAlt, rate: 20, speed: 0, turn: 1.2, yawLead: 0 },
  { id: 'sunscar.matriarch.stalk', kind: 'stalk', altitude: M.lieAlt, standOff: M.standOff, constantSpeed: true, speed: M.crawl, turn: 1.2,
    ready: { kind: 'over', radius: M.standOff, height: 600 } },
] as const;
export const MATRIARCH_DECISION = [{ id: 'sunscar.matriarch.decision', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/matriarch.as',
  binding: { shard: true }, pages: 1, onFail: 'hold', on: ['start', 'stop', 'threshold', 'death', 'timer', 'move.done', 'strike.done'],
  reads: ['nearestPlayer'], commands: ['move', 'strike', 'stop', 'timer'], actors: { matriarch: 'sunscar.matriarch' },
  moves: { orbit: 'sunscar.matriarch.orbit.0', stormOrbit: 'sunscar.matriarch.orbit.1', dive: 'sunscar.matriarch.dive.0', stormDive: 'sunscar.matriarch.dive.1',
    climb: 'sunscar.matriarch.climb.0', stormClimb: 'sunscar.matriarch.climb.1', lie: 'sunscar.matriarch.lie', stalk: 'sunscar.matriarch.stalk' },
  strikes: { maw: MAW_DATA.id, tail: TAIL_SWEEP_DATA.id, buffet: BUFFET_DATA.id }, timers: ['beat'], params: { firstRest: 3, rest: M.every[0], stormRest: M.every[1], diveMax: 5.5 },
  stateVersion: 1, state: [{ name: 'step', type: 'i32', default: 0, min: 0, max: 25, scope: 'binding' }],
}] as const;
