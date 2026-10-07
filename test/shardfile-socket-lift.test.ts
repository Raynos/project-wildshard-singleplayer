import { describe, expect, it } from 'vitest';
import { parseSocketLift, socketLiftRules, type SocketLiftEntry } from '../src/game/shardfile/socketLift';
import type { MoverData } from '../src/game/shardfile/movers';

const declaration = () => parseSocketLift({ mover: 'entry.lift', gate: 'entry.gate', roadStop: [0, 0, 230], topStop: [0, 25, 205], route: [[0, 25, 205], [0, 25, 195]], rideTicks: 600 });
const movers = (): MoverData => [{ id: 'entry.lift', entity: 1001, module: 'a'.repeat(64), kind: 'platform', at: { x: 0, y: 0, z: 230 }, euler: { x: 0, y: 0, z: 0 }, enabled: true,
  boxes: [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [],
}, { id: 'entry.gate', entity: 1002, module: 'a'.repeat(64), kind: 'platform', at: { x: 0, y: 1, z: 235 }, euler: { x: 0, y: 0, z: 0 }, enabled: false,
  boxes: [{ x: 0, y: 0, z: 0, hx: 4, hy: 1, hz: 0.1, rot: { x: 0, y: 0, z: 0, w: 1 } }], input: [],
}];
const entry = (): SocketLiftEntry => ({ edge: 'north', lift: declaration() });
describe('declared socket lift admission', () => {
  it('admits a named complete eight metre road deck and bounded onward route', () => {
    expect(socketLiftRules([entry()], movers())).toEqual([]);
    expect(declaration().rideTicks).toBe(600);
  });
  it.each(['mover', 'gate'] as const)('refuses an unknown %s before world allocation', field => {
    const e = entry(); e.lift[field] = 'unknown'; expect(socketLiftRules([e], movers()).join(';')).toMatch(/Unknown|Missing/);
  });
  it('refuses mid-travel initial pose and an inactive deck', () => {
    const rows = movers(), deck = rows[0]; if (deck === undefined) throw new Error('Missing fixture');
    deck.at.y = 5; expect(socketLiftRules([entry()], rows)).toContain('Socket lift must load at its road stop');
    deck.at.y = 0; deck.enabled = false; expect(socketLiftRules([entry()], rows)).toContain('Unknown or inactive socket lift mover');
  });
  it('refuses a six metre deck and a boarding gap beyond five centimetres', () => {
    const rows = movers(), box = rows[0]?.boxes[0]; if (box === undefined) throw new Error('Missing fixture');
    box.hx = 3; expect(socketLiftRules([entry()], rows)).not.toEqual([]);
    box.hx = 4; box.hz = 4.949; expect(socketLiftRules([entry()], rows)).not.toEqual([]);
    box.hz = 4.95; expect(socketLiftRules([entry()], rows)).toEqual([]);
  });
  it('refuses body geometry outside the ten metre inset at either stop', () => {
    const e = entry(); e.lift.topStop = [0, 25, 239]; e.lift.route[0] = [...e.lift.topStop];
    expect(socketLiftRules([e], movers())).toContain('Socket lift footprint must remain at least ten metres inside the cell');
  });
  it('refuses sharing movers or gates across entry declarations', () => {
    expect(socketLiftRules([entry(), entry()], movers())).toContain('Socket lift mover/gate belongs to one entry');
  });
  it.each([{ rideTicks: 3601 }, { rideTicks: 0 }, { rideTicks: 1.5 }, { gate: 'entry.lift' }, { roadStop: [0, 1, 230] }, { route: [[0, 25, 204], [0, 25, 195]] }, { callback: 'on_tick' }])('refuses malformed or unbounded links %j', patch => {
    expect(() => parseSocketLift({ ...declaration(), ...patch })).toThrow();
  });
  it('does not invoke an authored accessor while refusing non-data', () => {
    let calls = 0;
    const raw = { ...declaration(), get rideTicks() { calls++; return 600; } };
    expect(() => parseSocketLift(raw)).toThrow('JSON data only'); expect(calls).toBe(0);
  });
  it('refuses an onward route that never leaves the top stop', () => {
    const e = entry(); e.lift.route = [[...e.lift.topStop], [...e.lift.topStop]];
    expect(socketLiftRules([e], movers())).toContain('Socket lift needs an onward route to playable ground');
  });
});
