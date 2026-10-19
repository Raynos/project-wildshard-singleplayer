import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** Isolated practice-only rooted snapper. No projectile impersonation or world writes. */
export const BRINE_PITCHER_KIND = 'brine-pitcher-matriarch';
export const BRINE_PITCHER_FIELDS = [
  { id: 160, name: 'pitcher-step', min: 0, max: 6, default: 0 },
  { id: 161, name: 'pitcher-clock', min: 0, max: 600, default: 0 },
  { id: 162, name: 'pitcher-awake', min: 0, max: 1, default: 1 },
].map(row => Object.assign(row, { type: 'f64' as const, privacy: 'public' as const }));
export const BRINE_PITCHER_STRIKES = [
  { id: 'strike.pitcher.crown', shape: { kind: 'arc', radius: 2.65, halfAngle: .65 }, range: 2.65, damage: 16, windup: 1.15, active: .16, recover: 1.15 },
  { id: 'strike.pitcher.left', shape: { kind: 'arc', radius: 2.4, halfAngle: .55, yawOffset: -.62 }, range: 2.4, damage: 11, windup: .95, active: .14, recover: 1.05 },
  { id: 'strike.pitcher.right', shape: { kind: 'arc', radius: 2.4, halfAngle: .55, yawOffset: .62 }, range: 2.4, damage: 11, windup: .95, active: .14, recover: 1.05 },
].map(row => Object.assign(row, { cooldown: 0, units: 'world' as const, tags: ['cover.checked'], weight: { kind: 'constant' as const, value: 1 } }));
export const BRINE_PITCHER_DECISIONS = [{
  id: 'driftwood.brine-pitcher.decision', source: 'behaviour/brine-pitcher.as', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
  binding: { shard: true }, pages: 1, onFail: 'hold', tick: 10,
  on: ['start', 'tick', 'hit', 'strike.done', 'death', 'stop'],
  reads: ['nearestPlayer', 'distance', 'strikeState', 'stunned', 'alive'], commands: ['stop', 'strike', 'field'],
  actors: { self: 'driftwood.brine-pitcher' }, moves: {}, strikes: { crown: 'strike.pitcher.crown', left: 'strike.pitcher.left', right: 'strike.pitcher.right' },
  fields: { step: 'pitcher-step', clock: 'pitcher-clock', awake: 'pitcher-awake' }, params: {}, timers: [], stateVersion: 1,
  state: [
    { name: 'step', type: 'i32', default: 0, min: 0, max: 6, scope: 'binding' },
    { name: 'elapsed', type: 'f64', default: 0, min: 0, max: 600, scope: 'binding' },
    { name: 'cooldown', type: 'f64', default: 1.8, min: 0, max: 10, scope: 'binding' },
    { name: 'sequence', type: 'i32', default: 0, min: 0, max: 2, scope: 'binding' },
    { name: 'poise', type: 'f64', default: 0, min: 0, max: 10000, scope: 'binding' },
  ],
}] as const;
export const BRINE_PITCHER_SPECIES: BrainedSpecies[] = [{
  id: 'creature.brine-pitcher-matriarch', kind: BRINE_PITCHER_KIND, label: 'Brine Pitcher Matriarch', aggressive: true, lockable: true, walkSpeed: 0, chargeDamage: 16, corpseFade: 30, tick: 'ai',
  variants: [{ id: BRINE_PITCHER_KIND, label: 'Brine Pitcher Matriarch', rarity: 'rare', weight: 1, scale: [1, 1], hp: 150 }],
  brain: { archetype: 'decision', data: { script: 'driftwood.brine-pitcher.decision', actor: 'driftwood.brine-pitcher', strikeEffects: [] } },
  body: { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none', contact: { kind: 'environment', halfArc: 1.2 }, actions: { stateKey: 'pitcher-step', states: ['idle', 'attack', 'attack', 'attack', 'alert', 'idle', 'idle'], actions: [] } },
}];
export const BRINE_PITCHER_ACTORS = [{ id: 'driftwood.brine-pitcher', kind: BRINE_PITCHER_KIND, look: BRINE_PITCHER_KIND, at: [0, 0] as [number, number], yaw: 0 }];
export const BRINE_PITCHER_REWARD = 10;
