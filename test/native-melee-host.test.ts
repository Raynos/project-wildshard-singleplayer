import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Native fixture loads the production Rapier bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost, type SimSnapshot } from '../src/engine/sim/snapshot';
import { HOST_PROBE, installNativeMelee, type NativeMeleeCommand } from '../src/game/plugin/simulation';
import { parseNativeMeleeRow, type NativeMeleeRow, type MeleeContactRow } from '../src/format/weaponProfiles';
import { parseItems } from '../src/format/items';
import { WHIP_ITEMS } from '../src/shards/sunscar-dunes/data/items';
import { WHIP_CONTACT_MOVES } from '../src/shards/sunscar-dunes/data/whipContacts';

const dt = 1 / 60;
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { version: 1, id: 'fixture', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 0 }, entities: [], quests: [], weapon: HOST_PROBE };
const timed: NativeMeleeRow = { step: 'item.fixture', eye: 1.68, mode: 'timed', pitchLimit: null, zeroAim: 'retain',
  body: 'volumes', liveTargetsOnly: false, commandsAfterCool: false,
  actions: [{ action: 0, move: 0, aim: 'selected', hook: null }, { action: 1, move: 1, aim: 'selected', hook: null }],
  continuation: { encoding: 'json', fields: [
    { key: 'version', source: 'constant', constant: 2 }, { key: 'cooldown', source: 'primary' },
    { key: 'crackT', source: 'time' }, { key: 'heavy', source: 'heavy' }, { key: 'landed', source: 'landed', min: 0, max: 2 },
    { key: 'target', source: 'target' }, { key: 'world', source: 'world' }, { key: 'dir', source: 'direction' },
  ] } };
const immediate: NativeMeleeRow = { step: 'item.fixture', eye: 1.68, mode: 'immediate', pitchLimit: 1.45, zeroAim: 'refuse',
  body: 'none', liveTargetsOnly: true, commandsAfterCool: true,
  actions: [{ action: 0, move: 0, aim: 'selected', hook: null }, { action: 1, move: 1, aim: 'facing', hook: null },
    { action: 2, move: 2, aim: 'facing', hook: 3 }],
  continuation: { encoding: 'object', fields: [{ key: 'cooldown', source: 'primary', min: 0 }, { key: 'gustCooldown', source: 'secondary', min: 0 }] } };
const cone = WHIP_CONTACT_MOVES.map(row => ({ ...row, shape: 'cone' as const, lands: [], show: 0,
  hits: [{ ...row.hits[0], source: 'env' as const, copyVectors: true, copyTags: true }] }));
const firstCone = cone[0];
if (firstCone === undefined) throw new Error('Missing first fixture move');
const contacts: readonly MeleeContactRow[] = [...cone, { ...firstCone, lane: 'secondary', cooldown: 1.6 }];
function state(host: SimHost) { return snapshotSimHost(host).adapters.find(row => row.id === timed.step)?.state; }

it('keeps the delayed JSON field order and both contact clocks across a real native restore', () => {
  let commands: readonly NativeMeleeCommand[] = [{ kind: 'move', action: 1, world: 7 }];
  const world = [{ act: 7, at: { x: 0, y: 1.68, z: -2 }, radius: 0.3, crack: 'heavy' as const }];
  const install = (host: SimHost) => installNativeMelee(host, { id: 'weapon.fixture', contacts: WHIP_CONTACT_MOVES }, timed, { commands: () => commands, world });
  const host = createSimHost(level, { rapier }), owner = install(host);
  let restored: SimHost | undefined;
  try {
    host.step(); commands = [];
    for (let i = 0; i < 8; i++) host.step();
    expect(owner.family.landed).toBe(1);
    expect(state(host)).toBe(JSON.stringify({ version: 2, cooldown: owner.family.cooldown, crackT: owner.family.t,
      heavy: true, landed: 1, target: null, world: 7, dir: [0, 0, -1] }));
    const saved = snapshotSimHost(host); restored = restoreSimHost(level, { rapier }, saved, fresh => { install(fresh); });
    expect(state(restored)).toBe(state(host));
    for (let i = 0; i < 20; i++) { host.step(); restored.step(); expect(state(restored)).toBe(state(host)); }
    expect(owner.family.landed).toBe(2);
  } finally { restored?.dispose(); host.dispose(); }
});

it('samples commands in each policy’s original cooldown phase', () => {
  for (const [row, rows] of [[timed, WHIP_CONTACT_MOVES], [immediate, contacts]] as const) {
    const host = createSimHost(level, { rapier }); let observed = -1;
    const owner = installNativeMelee(host, { id: 'weapon.fixture', contacts: rows }, row,
      { commands: () => { observed = owner.family.cooldown; return []; } });
    try { owner.family.cooldown = 0.1; host.step(); expect(observed).toBe(row.commandsAfterCool ? 0.1 - dt : 0.1); }
    finally { host.dispose(); }
  }
});

it('uses the last pitch before ordered immediate moves and keeps independent AS secondary claims', () => {
  const commands: readonly NativeMeleeCommand[] = [{ kind: 'aim', pitch: -0.5 }, { kind: 'move', action: 1 },
    { kind: 'move', action: 2 }, { kind: 'aim', pitch: 10 }];
  const host = createSimHost(level, { rapier }), landed: { action: number; dir: number[] }[] = [];
  const owner = installNativeMelee(host, { id: 'weapon.fixture', contacts }, immediate, { commands: () => commands,
    hook: input => input.action, landed: (action, _from, dir) => { landed.push({ action, dir: dir.toArray() }); } });
  try {
    host.step();
    expect(landed).toEqual([1, 2].map(action => ({ action, dir: [-0, Math.sin(1.45), -Math.cos(1.45)] })));
    expect(state(host)).toEqual({ cooldown: 0.9, gustCooldown: 1.6 });
    host.step(); expect(landed).toHaveLength(2);
    expect(owner.family.secondaryCooldown).toBe(1.6 - dt);
  } finally { host.dispose(); }
});

it('refuses missing hooks and targets without claiming a move or publishing a landing', () => {
  const host = createSimHost(level, { rapier }), landed: number[] = [];
  const owner = installNativeMelee(host, { id: 'weapon.fixture', contacts }, immediate, {
    commands: () => [{ kind: 'move', action: 0, targetId: 'missing' }, { kind: 'move', action: 2 }],
    landed: action => { landed.push(action); } });
  try { host.step(); expect(landed).toEqual([]); expect([owner.family.cooldown, owner.family.secondaryCooldown]).toEqual([0, 0]); }
  finally { host.dispose(); }
});

it('refuses incomplete rows and invalid original continuation fields before accepting a restore', () => {
  expect(() => parseNativeMeleeRow({ ...timed, continuation: { ...timed.continuation, fields: timed.continuation.fields.slice(1) } })).not.toThrow();
  expect(() => parseNativeMeleeRow({ ...timed, continuation: { ...timed.continuation, fields: [] } })).toThrow();
  expect(() => parseNativeMeleeRow({ ...timed, actions: [...timed.actions, timed.actions[0]] })).toThrow();
  const host = createSimHost(level, { rapier });
  installNativeMelee(host, { id: 'weapon.fixture', contacts: WHIP_CONTACT_MOVES }, timed, { commands: () => [] });
  try {
    const saved = snapshotSimHost(host), adapter = saved.adapters.find(row => row.id === timed.step);
    if (adapter === undefined || typeof adapter.state !== 'string') throw new Error('Missing retained continuation');
    const decoded: unknown = JSON.parse(adapter.state);
    const original = v.parse(v.record(v.string(), v.unknown()), decoded);
    for (const patch of [{ version: 3 }, { landed: 3 }, { cooldown: null }, { dir: [0, 0] }, { extra: 1 }]) {
      const adapters: (typeof saved.adapters)[number][] = [];
      for (const row of saved.adapters) adapters.push(row.id === timed.step ? { ...row, state: JSON.stringify({ ...original, ...patch }) } : row);
      const invalid: SimSnapshot = { ...saved, adapters };
      let restored: SimHost | undefined;
      try { expect(() => { restored = restoreSimHost(level, { rapier }, invalid, fresh => {
        restored = fresh; installNativeMelee(fresh, { id: 'weapon.fixture', contacts: WHIP_CONTACT_MOVES }, timed, { commands: () => [] });
      }); }).toThrow(); }
      finally { restored?.dispose(); }
    }
  } finally { host.dispose(); }
});

it('admits the real item policy and leaves absent attachments absent while refusing unresolved native actions', () => {
  expect(parseItems(WHIP_ITEMS).rows[0]).toEqual(WHIP_ITEMS.rows[0]);
  const { native: _native, ...original } = WHIP_ITEMS.rows[0];
  const absent = { ...WHIP_ITEMS, rows: [original] };
  const parsed = parseItems(absent); expect(parsed).toEqual(absent);
  expect(Object.hasOwn(parsed.rows[0] ?? {}, 'native')).toBe(false);
  for (const native of [
    { ...timed, actions: [{ action: 0, move: 15, aim: 'selected', hook: null }] },
    { ...timed, actions: [{ action: 0, move: 0, aim: 'selected', hook: 3 }] },
    { ...timed, mode: 'immediate' },
  ]) expect(() => parseItems({ ...WHIP_ITEMS, rows: [{ ...original, native }] })).toThrow();
});
