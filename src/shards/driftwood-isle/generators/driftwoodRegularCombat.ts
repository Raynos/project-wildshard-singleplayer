import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** No world placements: these identities are borrowed only by the Developer practice room. */
export const DRIFTWOOD_REGULAR_ACTORS = ['brine-puffer', 'conch-duelist', 'splinter-mantis'].map(kind => ({ id: `driftwood.${kind}`, kind, look: kind, at: [0, 0] as [number, number], yaw: 0 }));
export const DRIFTWOOD_REGULAR_FIELDS = [
  { id: 101, name: 'puffer-st', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 5 },
  { id: 102, name: 'conch-st', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 5 },
  { id: 103, name: 'conch-guard', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 1 },
  { id: 104, name: 'mantis-st', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 5 },
  { id: 105, name: 'mantis-beat', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 2 },
  ...['puffer-clock', 'conch-clock', 'mantis-clock'].map((name, i) => ({ id: 106 + i, name, type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 60 })),
];
const common = { active: .10, cooldown: 0, units: 'world' as const, tags: ['cover.checked' as const], weight: { kind: 'constant' as const, value: 1 } };
export const DRIFTWOOD_REGULAR_STRIKES = [
  { ...common, id: 'strike.brine-puffer.burst', shape: { kind: 'ring' as const, inner: 0, outer: 2.2 }, range: 2.2, damage: 12, windup: .9, recover: 1.1 },
  { ...common, id: 'strike.conch-duelist.thrust', shape: { kind: 'lane' as const, length: 2.4, width: .65 }, range: 2.4, damage: 14, windup: .6, recover: .9 },
  { ...common, id: 'strike.conch-duelist.counter', shape: { kind: 'lane' as const, length: 2.4, width: .65 }, range: 2.4, damage: 16, windup: .45, recover: .9 },
  { ...common, id: 'strike.splinter-mantis.first', shape: { kind: 'lane' as const, length: 3.5, width: .70 }, range: 3.5, damage: 10, windup: .75, active: .5, recover: .12, motion: { speed: 7, track: 'none' as const, skid: .12 } },
  { ...common, id: 'strike.splinter-mantis.second', shape: { kind: 'lane' as const, length: 3.5, width: .70 }, range: 3.5, damage: 10, windup: .45, active: .5, recover: 1.1, motion: { speed: 7, track: 'none' as const, skid: 1.1 } },
];
export const DRIFTWOOD_REGULAR_MOVES = [
  ['brine-puffer', .70, 2.0], ['conch-duelist', .85, 2.1], ['splinter-mantis', 1.15, 3.0],
].map(([kind, speed, distance]) => ({ id: `${kind}.stalk`, kind: 'stalk' as const, ground: true, above: 0,
  speed: Number(speed), turn: 2.5, standOff: Number(distance), ready: { kind: 'over' as const, radius: Number(distance), height: 3 } }));
function species(kind: string, label: string, hp: number, damage: number, stateKey: string, guard = false): BrainedSpecies {
  return { id: `creature.${kind}`, kind, label, lockable: true, aggressive: true, walkSpeed: .8, chargeDamage: damage,
    variants: [{ id: kind, label, weight: 100, rarity: 'uncommon', scale: [1, 1], hp }],
    body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: Math.PI / 2 },
      actions: { stateKey, states: ['stalk', 'attack', 'alert', 'attack', 'alert', 'idle'], actions: [] } },
    brain: { archetype: 'decision', data: { script: `driftwood.${kind}.decision`, actor: `driftwood.${kind}`, strikeEffects: [],
      ...(guard ? { guard: { field: 'conch-guard', activeValue: 1, multiplier: .25 } } : {}) } },
  };
}
export const DRIFTWOOD_REGULAR_SPECIES: BrainedSpecies[] = [
  species('brine-puffer', 'Brine Puffer', 45, 12, 'puffer-st'),
  species('conch-duelist', 'Conch Duelist', 60, 14, 'conch-st', true),
  species('splinter-mantis', 'Splinter Mantis', 55, 10, 'mantis-st'),
];
const zero = '0'.repeat(64);
function decision(kind: string, source: string, fields: Record<string, string>, strikes: Record<string, string>) {
  return { id: `driftwood.${kind}.decision`, abi: '1.0' as const, side: 'sim' as const, module: `blobs/wasm/${zero}.wasm`, source: `behaviour/${source}.as`,
    binding: { shard: true as const }, pages: 1, onFail: 'hold' as const, tick: 10 as const,
    on: ['start', 'stop', 'tick', 'hit', 'death', 'strike.done'] as const,
    reads: ['nearestPlayer', 'distance', 'field', 'alive', 'strikeState', 'stunned'] as const, commands: ['move', 'stop', 'strike', 'field'] as const,
    actors: { enemy: `driftwood.${kind}` }, moves: { stalk: `${kind}.stalk` }, strikes, fields, params: {}, timers: [], stateVersion: 1,
    state: [{ name: 'stage', type: 'i32' as const, default: 0, min: 0, max: 5, scope: 'binding' as const },
      { name: 'clock', type: 'f64' as const, default: 0, min: 0, max: 60, scope: 'binding' as const },
      { name: 'cancelled', type: 'bool' as const, default: false, scope: 'binding' as const }],
  };
}
export const DRIFTWOOD_REGULAR_DECISIONS = [
  decision('brine-puffer', 'brinePuffer', { stage: 'puffer-st', clock: 'puffer-clock' }, { burst: 'strike.brine-puffer.burst' }),
  decision('conch-duelist', 'conchDuelist', { stage: 'conch-st', clock: 'conch-clock', guard: 'conch-guard' }, { thrust: 'strike.conch-duelist.thrust', counter: 'strike.conch-duelist.counter' }),
  decision('splinter-mantis', 'splinterMantis', { stage: 'mantis-st', clock: 'mantis-clock', beat: 'mantis-beat' }, { first: 'strike.splinter-mantis.first', second: 'strike.splinter-mantis.second' }),
];
export const DRIFTWOOD_REGULAR_REWARDS = { 'brine-puffer': 2, 'conch-duelist': 3, 'splinter-mantis': 3 };
