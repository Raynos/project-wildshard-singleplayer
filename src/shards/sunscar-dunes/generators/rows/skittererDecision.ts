import { SIGNAL_SPAWNS } from './spawns';
import { SKITTER as S, BITE_DATA } from './species/skitterer';

/** One script/group row drives all retained pack bodies; the host resolves actor-scoped slots. */
export const SKITTERER_DECISION: { readonly id: "sunscar.skitterer.decision"; readonly abi: "1.0"; readonly side: "sim"; readonly module: `blobs/wasm/${string}.wasm`; readonly source: "behaviour/skitterer-decision.as"; readonly binding: { readonly spawnGroup: "sunscar.skitterers"; }; readonly pages: 1; readonly onFail: "hold"; readonly on: readonly ["start", "tick", "move.done", "strike.done", "death", "stop"]; readonly tick: 10; readonly actors: Record<string, string>; readonly reads: readonly ["nearestPlayer", "distance", "strikeState", "random", "moving"]; readonly commands: readonly ["move", "strike", "stop", "field"]; readonly moves: { readonly burrow: "sunscar.skitterer.burrow"; readonly surface: "sunscar.skitterer.surface"; readonly retreat: "sunscar.skitterer.retreat"; }; readonly fields: { readonly burrow: "burrow"; }; readonly strikes: { readonly bite: string; }; readonly params: { readonly wake: 13; readonly sleep: 34; readonly rebury: 5; readonly bite: number; }; readonly stateVersion: 1; readonly state: readonly [{ readonly name: "step"; readonly type: "i32"; readonly default: 0; readonly min: 0; readonly max: 5; readonly scope: "actor"; }, { readonly name: "far"; readonly type: "f64"; readonly default: 0; readonly min: 0; readonly max: 600; readonly scope: "actor"; }, { readonly name: "ring"; readonly type: "i32"; readonly default: 0; readonly min: 0; readonly max: 6; readonly scope: "actor"; }]; } = { id: 'sunscar.skitterer.decision', abi: '1.0', side: 'sim',
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
export const SKITTERER_MOVES: readonly [{ readonly id: "sunscar.skitterer.burrow"; readonly kind: "burrow"; readonly field: "burrow"; readonly rate: 1.5; }, { readonly id: "sunscar.skitterer.surface"; readonly kind: "surface"; readonly field: "burrow"; readonly rate: number; }, { readonly id: "sunscar.skitterer.retreat"; readonly kind: "stalk"; readonly ground: true; readonly altitude: 0; readonly standOff: 600; readonly retreat: true; readonly constantSpeed: true; readonly speed: 5.6; readonly turn: 7; readonly ready: { readonly kind: "band"; readonly tolerance: 0.01; }; readonly giveUp: 1.1; }, ...{ id: string; kind: string; ground: boolean; radius: 2.2; angle: number; angularSpeed: number; closeRadius: number; stopDistance: number; speed: 5.6; turn: number; }[]] = [
  { id: 'sunscar.skitterer.burrow', kind: 'burrow', field: 'burrow', rate: 1.5 },
  { id: 'sunscar.skitterer.surface', kind: 'surface', field: 'burrow', rate: 1 / S.burst },
  { id: 'sunscar.skitterer.retreat', kind: 'stalk', ground: true, altitude: 0, standOff: 600, retreat: true, constantSpeed: true,
    speed: S.run, turn: 7, ready: { kind: 'band', tolerance: 0.01 }, giveUp: S.retreat },
  ...Array.from({ length: 7 }, (_, i) => ({ id: `sunscar.skitterer.ring.${i}`, kind: 'ring-run', ground: true,
    radius: S.ring, angle: i * 0.9, angularSpeed: 0.4, closeRadius: S.ring * 1.4, stopDistance: 1.2, speed: S.run, turn: 8 })),
] as const;
