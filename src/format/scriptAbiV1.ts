/** ABI-v1 numeric transport. These ids are shared by admission, generated bindings and the decision host. */
export const SCRIPT_V1_EVENTS = Object.freeze({
  start: 1, tick: 2, timer: 3, 'zone.enter': 4, 'zone.leave': 5, interact: 6, hit: 7, threshold: 8,
  death: 9, 'move.done': 10, 'strike.done': 11, flag: 12, signal: 13, 'strike.target': 14,
  'player.join': 15, 'player.leave': 16, spawned: 17, stop: 18, field: 30, cue: 31, channel: 32,
});
/** Scalar reads; timer and random are answered by the host's own binding state. */
export const SCRIPT_V1_READS = Object.freeze({
  x: 1, y: 2, z: 3, yaw: 4, hpShare: 5, alive: 6, field: 7, distance: 8, nearestPlayer: 9,
  flag: 10, timerLeft: 11, random: 12, actorInZone: 13, playersInZone: 14, moving: 15,
  strikeState: 16, playerFlag: 17, spawnGroupAlive: 18, bearing: 19,
});
/** Bounded list queries. Ground/navigation keep the existing physics query semantics. */
export const SCRIPT_V1_LISTS = Object.freeze({ actorsInZone: 1, playersWithin: 2, groundHeight: 3, nearestWalkable: 4, path: 5 });
/** Command ids; view commands occupy a disjoint range and may not run in a simulation binding. */
export const SCRIPT_V1_COMMANDS = Object.freeze({
  move: 1, strike: 2, stop: 3, field: 4, spawn: 5, despawn: 6, flag: 7, timer: 8,
  signal: 9, grant: 10, reward: 11, cue: 12, channel: 13, impulse: 14, encounter: 15, weather: 16,
  'view.channel': 100, 'view.clip': 101, 'view.vfx': 102, 'view.sound': 103, 'view.visible': 104,
});
export type ScriptV1EventName = keyof typeof SCRIPT_V1_EVENTS;
export type ScriptV1ReadName = keyof typeof SCRIPT_V1_READS;
export type ScriptV1ListName = keyof typeof SCRIPT_V1_LISTS;
export type ScriptV1CommandName = keyof typeof SCRIPT_V1_COMMANDS;
/** f64 slot counts and fixed-step scheduling, not byte addresses. */
export const SCRIPT_V1_LAYOUT = Object.freeze({
  major: 1, slotBytes: 8, header: 8, state: 16, params: 32, events: 16, eventWidth: 6,
  commands: 32, commandWidth: 5, fixedHz: 60, decisionDivisor: 6, maximumPages: 4,
});
/** Numeric inbox/outbox records, little-endian f64 throughout. */
export type ScriptV1Event = readonly [kind: number, subject: number, a: number, b: number, c: number, d: number];
export type ScriptV1Command = readonly [op: number, target: number, a: number, b: number, c: number];
/** Compute the row-sized IO layout without guessing a generated module's memory address. */
export function scriptV1Layout(states: number, params: number): { state: number; params: number; inbox: number; outbox: number; bytes: number } {
  if (!Number.isInteger(states) || states < 0 || states > SCRIPT_V1_LAYOUT.state
    || !Number.isInteger(params) || params < 0 || params > SCRIPT_V1_LAYOUT.params) throw new Error('Invalid decision IO dimensions');
  const state = SCRIPT_V1_LAYOUT.header;
  const parameters = state + states;
  const inbox = parameters + params;
  const outbox = inbox + SCRIPT_V1_LAYOUT.events * SCRIPT_V1_LAYOUT.eventWidth;
  return { state, params: parameters, inbox, outbox, bytes: (outbox + SCRIPT_V1_LAYOUT.commands * SCRIPT_V1_LAYOUT.commandWidth) * SCRIPT_V1_LAYOUT.slotBytes };
}
