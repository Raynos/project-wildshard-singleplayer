import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** Isolated grounded bite owner. No locomotion, tail damage or physical corpse admission. */
export const KEELMAW_FIELDS = [
  { id: 190, name: 'keelmaw-step', min: 0, max: 3, default: 0 },
  { id: 191, name: 'keelmaw-clock', min: 0, max: 600, default: 0 },
].map(row => Object.assign(row, { type: 'f64' as const, privacy: 'public' as const }));
export const KEELMAW_STRIKES = [{ id: 'strike.keelmaw.bite', shape: { kind: 'arc' as const, radius: 2.8, halfAngle: .55 },
  range: 2.8, damage: 18, windup: .8, active: .18, recover: .6, cooldown: 0,
  units: 'world' as const, tags: ['cover.checked' as const], weight: { kind: 'constant' as const, value: 1 } }];
export const KEELMAW_DECISIONS = [{
  id: 'driftwood.keelmaw.decision', source: 'behaviour/keelmaw.as', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
  binding: { shard: true }, pages: 1, onFail: 'hold', tick: 10,
  on: ['start', 'tick', 'hit', 'strike.done', 'death', 'stop'],
  reads: ['nearestPlayer', 'distance', 'strikeState', 'stunned', 'alive'], commands: ['stop', 'strike', 'field'],
  actors: { self: 'driftwood.keelmaw' }, moves: {}, strikes: { bite: 'strike.keelmaw.bite' },
  fields: { step: 'keelmaw-step', clock: 'keelmaw-clock' }, params: {}, timers: [], stateVersion: 1,
  state: [
    { name: 'step', type: 'i32', default: 0, min: 0, max: 3, scope: 'binding' },
    { name: 'elapsed', type: 'f64', default: 0, min: 0, max: 600, scope: 'binding' },
    { name: 'cooldown', type: 'f64', default: 1.8, min: 0, max: 10, scope: 'binding' },
    { name: 'poise', type: 'f64', default: 0, min: 0, max: 10000, scope: 'binding' },
  ],
}] as const;
export const KEELMAW_SPECIES: BrainedSpecies[] = [{
  id: 'creature.keelmaw', kind: 'keelmaw', label: 'Keelmaw', aggressive: true, lockable: true,
  walkSpeed: 0, chargeDamage: 18, corpseFade: 30, tick: 'ai',
  variants: [{ id: 'keelmaw', label: 'Keelmaw', rarity: 'rare', weight: 1, scale: [1, 1], hp: 180 }],
  brain: { archetype: 'decision', data: { script: 'driftwood.keelmaw.decision', actor: 'driftwood.keelmaw', strikeEffects: [] } },
  body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: 1.2 },
    actions: { stateKey: 'keelmaw-step', states: ['idle', 'attack', 'alert', 'idle'], actions: [] } },
}];
export const KEELMAW_ACTORS = [{ id: 'driftwood.keelmaw', kind: 'keelmaw', look: 'keelmaw', at: [0, 0] as [number, number], yaw: 0 }];
