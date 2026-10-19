import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** Candidate-only content. No world placement or durable progression. */
export const BLOOMTHROAT_IGUANA_KIND = 'bloomthroat-iguana';
export const BLOOMTHROAT_IGUANA_FIELDS = [
  { id: 190, name: 'iguana-stage', min: 0, max: 5, default: 0 },
  { id: 191, name: 'iguana-clock', min: 0, max: 60, default: 0 },
].map(row => Object.assign(row, { type: 'f64' as const, privacy: 'public' as const }));
export const BLOOMTHROAT_IGUANA_STRIKES = [{
  id: 'strike.bloomthroat-iguana.bite', shape: { kind: 'arc' as const, radius: 1.9, halfAngle: .55 },
  range: 1.9, damage: 12, windup: .75, active: .16, recover: .9, cooldown: 0,
  units: 'world' as const, tags: ['cover.checked'], weight: { kind: 'constant' as const, value: 1 },
}];
export const BLOOMTHROAT_IGUANA_MOVES = [{ id: 'bloomthroat-iguana.stalk', kind: 'stalk' as const,
  ground: true, above: 0, speed: .7, turn: 2.5, standOff: 1.8,
  ready: { kind: 'over' as const, radius: 1.8, height: 3 } }];
export const BLOOMTHROAT_IGUANA_DECISIONS = [{
  id: 'driftwood.bloomthroat-iguana.decision', source: 'behaviour/bloomthroat-iguana.as', abi: '1.0', side: 'sim',
  module: `blobs/wasm/${'0'.repeat(64)}.wasm`, binding: { shard: true }, pages: 1, onFail: 'hold', tick: 10,
  on: ['start', 'stop', 'tick', 'hit', 'death', 'strike.done'],
  reads: ['nearestPlayer', 'distance', 'alive', 'strikeState', 'stunned'], commands: ['move', 'stop', 'strike', 'field'],
  actors: { enemy: 'driftwood.bloomthroat-iguana' }, moves: { stalk: 'bloomthroat-iguana.stalk' },
  strikes: { bite: 'strike.bloomthroat-iguana.bite' }, fields: { stage: 'iguana-stage', clock: 'iguana-clock' },
  params: {}, timers: [], stateVersion: 1,
  state: [
    { name: 'stage', type: 'i32', default: 0, min: 0, max: 5, scope: 'binding' },
    { name: 'clock', type: 'f64', default: 0, min: 0, max: 60, scope: 'binding' },
    { name: 'cancelled', type: 'bool', default: false, scope: 'binding' },
  ],
}] as const;
export const BLOOMTHROAT_IGUANA_SPECIES: BrainedSpecies[] = [{
  id: 'creature.bloomthroat-iguana', kind: BLOOMTHROAT_IGUANA_KIND, label: 'Bloomthroat Iguana',
  aggressive: true, lockable: true, walkSpeed: .7, chargeDamage: 12, corpseFade: 30, tick: 'ai',
  variants: [{ id: BLOOMTHROAT_IGUANA_KIND, label: 'Bloomthroat Iguana', rarity: 'uncommon', weight: 1, scale: [1, 1], hp: 65 }],
  brain: { archetype: 'decision', data: { script: 'driftwood.bloomthroat-iguana.decision', actor: 'driftwood.bloomthroat-iguana', strikeEffects: [] } },
  body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: Math.PI / 2 },
    actions: { stateKey: 'iguana-stage', states: ['stalk', 'attack', 'alert', 'idle', 'idle', 'idle'], actions: [] } },
}];
export const BLOOMTHROAT_IGUANA_ACTORS = [{ id: 'driftwood.bloomthroat-iguana', kind: BLOOMTHROAT_IGUANA_KIND, look: BLOOMTHROAT_IGUANA_KIND, at: [0, 0] as [number, number], yaw: 0 }];
export const BLOOMTHROAT_IGUANA_REWARD = 3;
