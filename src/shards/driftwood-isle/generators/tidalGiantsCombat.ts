import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** E487: isolated guests use existing world-unit strike contact, cover and once-only latches. */
export const TIDAL_GIANTS_STRIKES = [
  { id: 'strike.bellback.pulse', shape: { kind: 'ring', inner: 0, outer: 2.4 }, range: 3, damage: 16, windup: 1.2, active: .12, recover: .2 },
  { id: 'strike.bellback.echo', shape: { kind: 'ring', inner: 2.4, outer: 4.8 }, range: 6, damage: 12, windup: .85, active: .15, recover: .6 },
  { id: 'strike.bellback.stomp', shape: { kind: 'arc', radius: 2.1, halfAngle: .65 }, range: 2.4, damage: 14, windup: .85, active: .15, recover: .7 },
  { id: 'strike.colossus.left', shape: { kind: 'arc', radius: 4.7, halfAngle: 1.05, yawOffset: .9 }, range: 7, damage: 18, windup: .9, active: .25, recover: .35 },
  { id: 'strike.colossus.right', shape: { kind: 'arc', radius: 4.7, halfAngle: 1.05, yawOffset: -.9 }, range: 7, damage: 18, windup: .9, active: .25, recover: .35 },
  { id: 'strike.colossus.slam', shape: { kind: 'lane', length: 6.2, width: 1.4 }, range: 7, damage: 22, windup: 1.1, active: .18, recover: 1.5 },
].map(row => Object.assign(row, { cooldown: 0, units: 'world', tags: ['cover.checked'], weight: { kind: 'constant', value: 1 } }));

/** Unique ids do not disturb the captain's retained field numbering. */
export const TIDAL_GIANTS_FIELDS = [
  { id: 110, name: 'tg-state', min: 0, max: 6, default: 0 },
  { id: 111, name: 'tg-clock', min: 0, max: 600, default: 0 },
  { id: 112, name: 'tg-awake', min: 0, max: 1, default: 1 },
  { id: 113, name: 'tg-phase', min: 1, max: 3, default: 1 },
  { id: 114, name: 'tg-exposed', min: 0, max: 1, default: 0 },
].map(row => Object.assign(row, { type: 'f64' as const, privacy: 'public' as const }));
export const TIDAL_GIANTS_MOVES = [
  { id: 'bellback.approach', kind: 'stalk', ground: true, above: 0, standOff: 2, speed: .85, turn: 1.8, ready: { kind: 'over', radius: 2.3, height: 600 } },
  { id: 'colossus.face', kind: 'stalk', ground: true, above: 0, standOff: 0, speed: 0, turn: 1.2, ready: { kind: 'over', radius: .01, height: 600 } },
] as const;
const zero = '0'.repeat(64);
const fieldAliases = { pose: 'tg-state', clock: 'tg-clock', awake: 'tg-awake', phase: 'tg-phase', exposed: 'tg-exposed' };
const common = { abi: '1.0', side: 'sim', module: `blobs/wasm/${zero}.wasm`, binding: { shard: true }, pages: 1, onFail: 'hold', tick: 10,
  on: ['start', 'tick', 'hit', 'strike.done', 'death', 'stop'], reads: ['nearestPlayer', 'distance', 'hpShare', 'strikeState', 'stunned', 'alive'],
  commands: ['move', 'stop', 'strike', 'field'], fields: fieldAliases, params: {}, timers: [], stateVersion: 1,
  state: [
    { name: 'step', type: 'i32', default: 0, min: 0, max: 6, scope: 'binding' },
    { name: 'elapsed', type: 'f64', default: 0, min: 0, max: 600, scope: 'binding' },
    { name: 'cooldown', type: 'f64', default: .8, min: 0, max: 10, scope: 'binding' },
    { name: 'sequence', type: 'i32', default: 0, min: 0, max: 4, scope: 'binding' },
    { name: 'side', type: 'i32', default: 0, min: 0, max: 1, scope: 'binding' },
    { name: 'poise', type: 'f64', default: 0, min: 0, max: 10000, scope: 'binding' },
  ],
} as const;
export const TIDAL_GIANTS_DECISIONS = [
  { ...common, id: 'driftwood.bellback.decision', source: 'behaviour/bellback.as', actors: { self: 'driftwood.bellback' },
    moves: { approach: 'bellback.approach' }, strikes: { pulse: 'strike.bellback.pulse', echo: 'strike.bellback.echo', stomp: 'strike.bellback.stomp' } },
  { ...common, id: 'driftwood.colossus.decision', source: 'behaviour/tide-root-colossus.as', actors: { self: 'driftwood.colossus' },
    moves: { face: 'colossus.face' }, strikes: { left: 'strike.colossus.left', right: 'strike.colossus.right', slam: 'strike.colossus.slam' } },
] as const;
function body(states: string[]) { return { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none',
  contact: { kind: 'environment', halfArc: 1.2 }, actions: { stateKey: 'tg-state', states, actions: [] } } as const; }
export const TIDAL_GIANTS_SPECIES: BrainedSpecies[] = [
  { id: 'creature.bellback', kind: 'bellback', label: 'Bellback', aggressive: true, lockable: true, walkSpeed: .85, chargeDamage: 16,
    corpseFade: 30, tick: 'ai', variants: [{ id: 'bellback', label: 'Bellback', rarity: 'rare', weight: 1, scale: [1, 1], hp: 180 }],
    brain: { archetype: 'decision', data: { script: 'driftwood.bellback.decision', actor: 'driftwood.bellback', marks: { fight: 'tg-awake', phase: 'tg-phase' }, strikeEffects: [] } },
    body: body(['stalk', 'attack', 'attack', 'attack', 'alert', 'idle', 'idle']) },
  { id: 'creature.tide-root-colossus', kind: 'tideRootColossus', label: 'Tide-Root Colossus', aggressive: true, lockable: true, walkSpeed: 0, chargeDamage: 22,
    corpseFade: 45, tick: 'ai', variants: [{ id: 'tideRootColossus', label: 'Tide-Root Colossus', rarity: 'legendary', weight: 1, scale: [1, 1], hp: 480 }],
    brain: { archetype: 'decision', data: { script: 'driftwood.colossus.decision', actor: 'driftwood.colossus', guard: { field: 'tg-exposed', activeValue: 1, multiplier: 1.5 }, marks: { fight: 'tg-awake', phase: 'tg-phase' }, strikeEffects: [] } },
    body: body(['idle', 'attack', 'attack', 'attack', 'alert', 'idle', 'idle']) },
];
/** Coins only: keepsakes remain deferred until their collection/item/model rows are authored. */
export const TIDAL_GIANTS_BOUNTIES = { bellback: 12, tideRootColossus: 35 } as const;

/** Declarative identities only; the Developer practice owner supplies the actual bodies. */
export const TIDAL_GIANTS_ACTORS = [{ id: 'driftwood.bellback', kind: 'bellback', look: 'bellback', at: [0, 0] as [number, number], yaw: 0 },
  { id: 'driftwood.colossus', kind: 'tideRootColossus', look: 'tideRootColossus', at: [0, 0] as [number, number], yaw: 0 }];
