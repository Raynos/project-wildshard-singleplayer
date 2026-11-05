// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Count collections around a tight loop.
import { PerformanceObserver } from 'node:perf_hooks';
import { Vector3 } from 'three';
import type { NetCommand } from '@wildshard/format/netCommand';
import { beforeAll, expect, test } from 'vitest';
import { PREDICTION_RING, Predictor, type PredictedBody } from '../src/engine/client/net/predictor';
import { NET_BUTTONS } from '../src/engine/shared/input/netButtons';
import { BitReader, BitWriter } from '../src/engine/shared/net/bits';
import { quantiseCommand, readCommand, writeCommand } from '../src/engine/shared/net/command';
import { PLAYER_CLASS } from '../src/engine/shared/net/netSchemas';
import type { CharacterMotor } from '../src/engine/shared/physics/CharacterMotor';
import type { Rapier } from '../src/engine/shared/physics/rapier';
import { createMotionState } from '../src/engine/shared/player/motionState';
import { legacyDouble } from '../src/engine/test/FakeGame';
import { linkedPlayer, type LinkedPlayer } from './fixtures/motion-trace/link';
import { loadCourseRapier, type MotionScenario } from './fixtures/motion-trace/parity';

// P1-E5.3-C4: the predictor on the real Player against the real PlayerSim.

let R: Rapier;
beforeAll(async () => { R = await loadCourseRapier(); });

const DELAY = 3, EAST = -Math.PI / 2;
const scenario: MotionScenario = { id: 'predict', start: { x: -10, z: 0, yaw: EAST }, ticks: 0, intent: () => ({}) };
const forward = { keyX: 0, keyY: 1, stickX: 0, stickY: 0 }, standing = { keyX: 0, keyY: 0, stickX: 0, stickY: 0 };
const linked = (): LinkedPlayer => linkedPlayer(R, scenario, DELAY);

test('a walk the server agrees with writes nothing', () => {
  const link = linked();
  try {
    let corrections = 0;
    for (let at = 0; at < 120; at++) if (link.run().corrected) corrections++;
    expect(corrections).toBe(0);
    expect(link.predictor.replays).toBe(0);
    expect(link.player.renderOffset.length()).toBe(0);
    expect(link.player.position.x).toBeGreaterThan(-10 + 4);
  } finally { link.dispose(); }
});

test('a 1 m server shove reconverges in 10 ticks and glides on the camera', () => {
  const link = linked();
  try {
    for (let at = 0; at < 30; at++) link.run();
    link.host.player.position.z += 1; // the server moved us, and said nothing else
    let corrected = -1, settled = -1;
    for (let at = 0; at < 40; at++) {
      const { corrected: now } = link.run();
      if (now && corrected === -1) corrected = at;
      else if (corrected !== -1 && !now && settled === -1) settled = at;
      if (now && settled !== -1) settled = -1;
    }
    expect(corrected).toBeGreaterThanOrEqual(0);
    expect(settled - corrected).toBeLessThanOrEqual(10);
    expect(link.player.position.z).toBeCloseTo(1, 1);
    const glide = link.player.renderOffset;
    expect(glide.z).toBeGreaterThan(-1.1); expect(glide.z).toBeLessThan(-.9);
    link.predictor.update(.5);
    expect(link.player.renderOffset.length()).toBeLessThan(.01);
  } finally { link.dispose(); }
});

test('a teleport snaps: no glide over 3 m', () => {
  const link = linked();
  try {
    for (let at = 0; at < 30; at++) link.run();
    link.host.player.position.z += 6;
    for (let at = 0; at < 2 * DELAY + 2; at++) link.run();
    expect(link.player.renderOffset.length()).toBe(0);
    expect(link.player.position.z).toBeCloseTo(6, 1);
  } finally { link.dispose(); }
});

test('a replayed jump plays nothing, and the replay keeps its speed', () => {
  const link = linked(), { player } = link;
  try {
    let jumps = 0, lands = 0, hovers = 0;
    player.onJump = () => { jumps++; }; player.onLand = () => { lands++; }; player.onHoverChange = () => { hovers++; };
    for (let at = 0; at < 30; at++) link.run();
    link.run({ buttons: NET_BUTTONS.jump }); link.run({ buttons: NET_BUTTONS.hover });
    expect(jumps).toBe(1); expect(hovers).toBe(1);
    link.host.player.position.z += 1; // the frames that carry this also ack the two presses' neighbours
    const from = link.predictor.replays;
    link.run(); link.run();
    for (let at = 0; at < 8; at++) link.run();
    expect(link.predictor.replays).toBeGreaterThan(from);
    expect(jumps).toBe(1); expect(hovers).toBe(1);
    expect(lands).toBeLessThanOrEqual(1);
  } finally { link.dispose(); }
});

test('the client steps what the server decodes', () => {
  const samples: NetCommand[] = [{ seq: 1, viewTick: 2, steer: { keyX: 1, keyY: -1, stickX: .31415, stickY: -.77 }, yaw: 1.23456789, pitch: -.3333, buttons: 3 },
    { seq: 2, viewTick: 2, steer: standing, yaw: -2.5, pitch: 1.2, buttons: 0 }, { seq: 3, viewTick: 2, steer: forward, yaw: 9.75, pitch: 0, buttons: 8 }];
  for (const command of samples) {
    const writer = new BitWriter(64); writeCommand(writer, command, () => 0);
    const decoded = readCommand(new BitReader(new Uint8Array(writer.finish())), () => undefined), quantised = quantiseCommand(command);
    expect(quantised.steer).toEqual(decoded.steer); expect(quantised.pitch).toBeCloseTo(decoded.pitch, 12);
    expect(Math.sin(quantised.yaw)).toBeCloseTo(Math.sin(decoded.yaw), 12); expect(Math.cos(quantised.yaw)).toBeCloseTo(Math.cos(decoded.yaw), 12);
  }
});

test('a full ring holds still', () => {
  const link = linked(), { predictor, player } = link;
  try {
    expect(predictor.pending).toBe(0);
    const command = (seq: number): NetCommand => ({ seq, viewTick: 0, steer: forward, yaw: EAST, pitch: 0, buttons: 0 });
    for (let seq = 1; seq <= PREDICTION_RING; seq++) expect(predictor.step(command(seq))).toBe(true);
    expect(predictor.full).toBe(true);
    const at = player.position.x;
    expect(predictor.step(command(PREDICTION_RING + 1))).toBe(false);
    expect(player.position.x).toBe(at);
  } finally { link.dispose(); }
});

test('an old frame is ignored, and seq wraps', () => {
  const state = createMotionState(), steps: number[] = [];
  const body: PredictedBody = { motionState: state, motor: legacyDouble<CharacterMotor>({ captureState: () => undefined, restoreState: () => undefined }), renderOffset: new Vector3(),
    step: command => { steps.push(command.seq); return true; } };
  const predictor = new Predictor(body, PLAYER_CLASS.owner), owner = new Uint32Array(PLAYER_CLASS.owner.length);
  for (const seq of [0xfffe, 0xffff, 0, 1]) predictor.step({ seq, viewTick: 0, steer: standing, yaw: 0, pitch: 0, buttons: 0 });
  predictor.reconcile(0xffff, owner);
  expect(predictor.pending).toBe(2);
  predictor.reconcile(0xfffe, owner);
  expect(predictor.pending).toBe(2);
  predictor.reconcile(1, owner);
  expect(predictor.pending).toBe(0);
});

test('a step and a frame within tolerance allocate nothing', async () => {
  const state = createMotionState();
  const body: PredictedBody = { motionState: state, motor: legacyDouble<CharacterMotor>({ captureState: () => undefined, restoreState: () => undefined }), renderOffset: new Vector3(), step: () => true };
  const predictor = new Predictor(body, PLAYER_CLASS.owner), owner = new Uint32Array(PLAYER_CLASS.owner.length);
  PLAYER_CLASS.owner.forEach((column, index) => { if (column.name === 'grounded') owner[index] = 1; });
  const commands = Array.from({ length: 0x10000 }, (_, seq) => ({ seq, viewTick: 0, steer: standing, yaw: 0, pitch: 0, buttons: 0 }));
  const seen: number[] = [], observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) seen.push(entry.startTime); });
  observer.observe({ entryTypes: ['gc'] });
  await new Promise(resolve => { setTimeout(resolve, 0); });
  const start = performance.now();
  for (let at = 0; at < 2_000_000; at++) {
    const command = commands[at & 0xffff];
    if (command === undefined) throw new Error('No command');
    predictor.step(command); predictor.reconcile(command.seq, owner);
  }
  const end = performance.now();
  await new Promise(resolve => { setTimeout(resolve, 20); });
  observer.disconnect();
  expect(predictor.corrections).toBe(0);
  expect(seen.filter(time => time >= start && time <= end).length).toBeLessThanOrEqual(2);
}, 30_000);
