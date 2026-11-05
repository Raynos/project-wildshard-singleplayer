import { expect, test } from 'vitest';
import type { NetCommand } from '@wildshard/format/netCommand';
import { decodeCommands, encodeCommands } from '../src/engine/shared/net/command';
import { BitWriter } from '../src/engine/shared/net/bits';
import { decodeAct, encodeAct } from '../src/engine/shared/net/messages';
import { NET_BUTTONS } from '../src/engine/shared/input/netButtons';
import { lockedHook, type ActRoutes } from '../src/engine/server/sim/actRoutes';
import { netRide, netTickCommands } from '../src/sdk/standalone/netInput';

// What the room's input gained in format v0.3.0: LOCK has a bit, J116's target has a place, and riding is on the wire.
const steer = { keyX: 0, keyY: 0, stickX: 0, stickY: 0 };
const command = (extra: Partial<NetCommand> = {}): NetCommand => ({ seq: 1, viewTick: 2, steer, yaw: 0, pitch: 0, buttons: 0, ...extra });
const ids = ['', 'creature.1'];
const roundTrip = (input: NetCommand): NetCommand | undefined => {
  const bytes = encodeCommands(new BitWriter(), { ackFrame: 0, commands: [input] }, id => ids.indexOf(id));
  return decodeCommands(new Uint8Array(bytes), handle => ids[handle])?.commands[0];
};
const routes = (extra: Partial<ActRoutes>): ActRoutes => ({ interactions: new Map(), equip: null, lock: null, ride: null, lean: null, ...extra });

test('every button survives the wire, LOCK with them', () => {
  const buttons = Object.values(NET_BUTTONS).reduce((all, bit) => all | bit, 0);
  expect(NET_BUTTONS.lock).toBeGreaterThan(0xff);
  expect(roundTrip(command({ buttons }))?.buttons).toBe(buttons);
});

test('a command carries its lock-on target, and leaves it out when it has none', () => {
  expect(roundTrip(command({ lockTarget: 'creature.1' }))?.lockTarget).toBe('creature.1');
  expect(roundTrip(command())).not.toHaveProperty('lockTarget');
});

test('a command carries the hook it picked, and LOCK takes it to the shard\'s script actor', () => {
  expect(roundTrip(command({ hookTarget: 0 }))?.hookTarget).toBe(0);
  expect(roundTrip(command({ hookTarget: 0xffff }))?.hookTarget).toBe(0xffff);
  expect(roundTrip(command())).not.toHaveProperty('hookTarget');
  const scripts = (hookTarget?: number): number[] => netTickCommands(command({ buttons: NET_BUTTONS.lock, ...(hookTarget === undefined ? {} : { hookTarget }) }), [], routes({ lock: 'grapple.lock' })).flatMap(row => row.kind === 'script' ? [row.value] : []);
  expect(scripts().map(lockedHook)).toEqual([undefined]);
  expect(scripts(0).map(lockedHook)).toEqual([0]);
  expect(scripts(7).map(lockedHook)).toEqual([7]);
});

test.each(['offer', 'mount', 'dismount'] as const)('a ride act %s survives the wire and is not a report', action => {
  const act = { kind: 'ride', seq: 3, action } as const;
  expect(decodeAct(new Uint8Array(encodeAct(new BitWriter(), act)))).toEqual(act);
});

test('an unknown ride action refuses its message', () => {
  const bytes = new Uint8Array(encodeAct(new BitWriter(), { kind: 'ride', seq: 3, action: 'offer' }));
  bytes[bytes.length - 1] = 9;
  expect(decodeAct(bytes)).toBeNull();
});

test('LOCK lands on the shard\'s script actor, and nowhere on a shard without one', () => {
  const held = command({ buttons: NET_BUTTONS.lock });
  expect(netTickCommands(held, [], routes({ lock: 'grapple.lock' }))).toContainEqual({ kind: 'script', actorId: 'grapple.lock', value: 1 });
  expect(netTickCommands(held, [], routes({})).filter(row => row.kind === 'script')).toEqual([]);
});

test('a ride act and the lean reach the taming law for who sent them', () => {
  const said: string[] = [], leaned: number[] = [];
  const ride = routes({ ride: (player, action) => { said.push(`${player}:${action}`); }, lean: (_player, lean) => { leaned.push(lean); } });
  netRide(ride, 'bot:1', undefined, [{ kind: 'ride', seq: 1, action: 'mount' }]);
  netRide(ride, 'bot:1', command({ steer: { ...steer, keyX: 1 } }), []);
  expect(said).toEqual(['bot:1:mount']); expect(leaned).toEqual([1]);
});
