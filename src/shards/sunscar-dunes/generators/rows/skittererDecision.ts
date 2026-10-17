import { SIGNAL_SPAWNS } from './spawns';
import { SKITTER as S, BITE_DATA } from './species/skitterer';

/** One script/group row drives all retained pack bodies; the host resolves actor-scoped slots. */
export const SKITTERER_DECISION = { id: 'sunscar.skitterer.decision', abi: '1.0', side: 'sim',
  module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/skitterer-decision.as', binding: { spawnGroup: 'sunscar.skitterers' },
  pages: 1, onFail: 'hold', on: ['start', 'tick', 'move.done', 'strike.done', 'death', 'stop'], tick: 10,
  actors: Object.fromEntries(SIGNAL_SPAWNS.homes.filter(row => row.kind === 'sandSkitterer').map((row, index) => [`body${index}`, row.id])),
  reads: ['nearestPlayer', 'distance', 'strikeState', 'random', 'moving'], commands: ['move', 'strike', 'stop', 'field'],
  moves: { burrow: 'sunscar.skitterer.burrow', surface: 'sunscar.skitterer.surface', retreat: 'sunscar.skitterer.retreat',
    ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`ring${i}`, `sunscar.skitterer.ring.${i}`])) },
  fields: { burrow: 'burrow' }, strikes: { bite: BITE_DATA.id }, params: { wake: S.wake, sleep: S.sleep, rebury: S.rebury, bite: BITE_DATA.range ?? 0 },
  stateVersion: 1, state: [{ name: 'step', type: 'i32', default: 0, min: 0, max: 5, scope: 'actor' },
    { name: 'far', type: 'f64', default: 0, min: 0, max: 600, scope: 'actor' },
    { name: 'ring', type: 'i32', default: 0, min: 0, max: 6, scope: 'actor' }],
} as const;
export const SKITTERER_MOVES = [
  { id: 'sunscar.skitterer.burrow', kind: 'burrow', field: 'burrow', rate: 1.5 },
  { id: 'sunscar.skitterer.surface', kind: 'surface', field: 'burrow', rate: 1 / S.burst },
  { id: 'sunscar.skitterer.retreat', kind: 'stalk', ground: true, altitude: 0, standOff: 600, retreat: true, constantSpeed: true,
    speed: S.run, turn: 7, ready: { kind: 'band', tolerance: 0.01 }, giveUp: S.retreat },
  ...Array.from({ length: 7 }, (_, i) => ({ id: `sunscar.skitterer.ring.${i}`, kind: 'ring-run', ground: true,
    radius: S.ring, angle: i * 0.9, angularSpeed: 0.4, closeRadius: S.ring * 1.4, stopDistance: 1.2, speed: S.run, turn: 8 })),
] as const;
