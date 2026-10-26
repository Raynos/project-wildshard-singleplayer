import ecology from '../data/ecology.generated.json' with { type: 'json' };

const fields = ['heading', 'speed', 'turn', 'engaged', 'leashing', 'phase2', 'clock', 'strikeTime'];
const observed = new Set(['engaged', 'leashing', 'phase2', 'clock']);
const def = ecology.elites['qara-batyr'];
if (def === undefined) throw new Error('Missing captain encounter');
const script = {
  id: 'nalati.qara-charge', abi: '1.0', side: 'sim', source: 'behaviour/qaraCharge.as', module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
  binding: { spawnGroup: 'nalati.qara-charge' }, pages: 1, onFail: 'hold', tick: 10, on: ['start', 'tick', 'signal'],
  reads: ['x', 'z', 'yaw', 'alive', 'nearestPlayer', 'field', 'strikeState'], commands: ['move', 'strike', 'stop', 'field', 'cue'],
  actors: { main: 'main' }, spawns: {}, moves: { steer: 'steer' }, strikes: { charge: 'strike.qara.charge' },
  fields: Object.fromEntries(fields.map(id => [id, id])), cues: { signature: 'signature', squeal: 'squeal', opened: 'opened' },
  stateVersion: 1, state: [['mode', 'i32', 0], ['time', 'f64', 0], ['cooldown', 'f64', 3], ['paired', 'bool', false]].map(([name, type, value]) => ({ name, type, default: value, scope: 'actor' })),
  params: { lairX: def.lair.x, lairZ: def.lair.z, awareRadius: def.awareR },
};
export const charge: { step: string; roster: string; seed: number; maximum: number; controlState: string; script: { id: string; abi: string; side: string; source: string; module: string; binding: { spawnGroup: string; }; pages: number; onFail: string; tick: number; on: string[]; reads: string[]; commands: string[]; actors: { main: string; }; spawns: NonNullable<unknown>; moves: { steer: string; }; strikes: { charge: string; }; fields: Record<string, string>; cues: { signature: string; squeal: string; opened: string; }; stateVersion: number; state: { name: string | number | boolean | undefined; type: string | number | boolean | undefined; default: string | number | boolean | undefined; scope: string; }[]; params: { lairX: number; lairZ: number; awareRadius: number; }; }; bytes: string; slots: { id: string; handle: number; release: string; }[]; species: { id: string; kind: string; variant: string; }[]; sites: { id: string; slot: string; point: number[]; face: string; }[]; spawns: { id: string; species: string; site: string; }[]; fields: { id: string; source: string; }[]; flags: never[]; cues: string[]; channels: never[]; strikes: { id: string; tell: string; trauma: number; stun: number; row: { id: string; shape: { kind: string; length: number; width: number; }; damage: number; windup: number; active: number; recover: number; cooldown: number; range: number; weight: { kind: string; value: number; }; units: string; tags: never[]; motion: { speed: number; track: string; overshoot: number; skid: number; }; }; }[]; moves: { id: string; kind: string; ground: boolean; speed: number; turn: number; fields: { yaw: string; speed: string; turn: string; }; }[]; } = {
  step: script.id, roster: 'nalati.creatures', seed: 4501, maximum: 1, controlState: 'sidestep', script, bytes: '',
  slots: [{ id: 'main', handle: 1, release: 'retain' }], species: [{ id: 'main', kind: 'ghost-rider', variant: 'captain' }],
  sites: [{ id: 'main', slot: 'main', point: [def.lair.x, def.lair.z], face: 'player' }], spawns: [{ id: 'main', species: 'main', site: 'main' }],
  fields: fields.map(id => ({ id, source: observed.has(id) ? 'observed' : id === 'strikeTime' ? id : 'value' })), flags: [], cues: ['signature', 'squeal', 'opened'], channels: [],
  strikes: [{ id: 'charge', tell: 'lane', trauma: 0.4, stun: 1, row: {
    id: 'strike.qara.charge', shape: { kind: 'lane', length: 55, width: 2.6 }, damage: 38,
    windup: 1.3, active: 0, recover: 0, cooldown: 0, range: 60, weight: { kind: 'constant', value: 1 }, units: 'world', tags: [],
    motion: { speed: 18, track: 'lead', overshoot: 12, skid: 0 },
  } }],
  moves: [{ id: 'steer', kind: 'steer', ground: true, speed: 18, turn: 5, fields: { yaw: 'heading', speed: 'speed', turn: 'turn' } }],
};
