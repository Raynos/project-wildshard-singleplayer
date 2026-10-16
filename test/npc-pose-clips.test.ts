import { Group, Mesh } from 'three';
import { expect, test } from 'vitest';
import { playClips, type ClipCtx } from '../src/game/plugin/animation';
import { CASTAWAY_POSE, TRADER_POSE } from '../src/shards/driftwood-isle/data/npcPose';

function context(): ClipCtx {
  return { bones: { head: new Mesh(), arm: new Mesh(), flames: new Mesh(), figure: new Group(), upper: new Mesh(), fore: new Mesh() },
    t: 3, phase: .4, speed: 0, alive: true, deathT: 0, attack: -1, mem: { weight: 1, headPitch: .2, headYaw: -.3, turn: .4 } };
}

test('trader clips pose the existing pivots for idle, beckon, tidy and offer', () => {
  const c = context(), { upper, fore, figure, head } = c.bones;
  if (upper === undefined || fore === undefined || figure === undefined || head === undefined) throw new Error('Missing test pivot');
  for (const gesture of [0, 1, 2, 3]) {
    c.mem['gesture'] = gesture;
    playClips(TRADER_POSE, c);
    expect(figure.rotation.y).toBe(.4);
    expect(head.rotation.y).toBe(-.3);
    if (gesture === 0) {
      expect(upper.rotation.x).toBeCloseTo(Math.sin(c.t * 1.1) * .05);
      expect(fore.rotation.x).toBe(-.12);
    } else if (gesture === 1) {
      expect(upper.rotation.z).toBeCloseTo(-.75);
      expect(fore.rotation.x).toBeCloseTo(-.12 - (1.5 + Math.sin(c.phase * 11) * .35));
    } else if (gesture === 2) {
      expect(figure.rotation.x).toBeCloseTo(.07);
      expect(fore.rotation.x).toBeCloseTo(-.12 - .28 + Math.sin(c.phase * 5) * .08);
    } else {
      expect(upper.rotation.x).toBeCloseTo(-.7);
      expect(fore.rotation.x).toBeCloseTo(-.47);
      expect(figure.rotation.x).toBe(0);
    }
  }
});

test('castaway clips retain the wave envelope, talking arm and moving head/flame pivots', () => {
  const c = context(), { arm, head, flames } = c.bones;
  if (arm === undefined || head === undefined || flames === undefined) throw new Error('Missing test pivot');
  c.mem['waving'] = 1;
  for (const phase of [0, .1, 1, 2.15, 2.3]) {
    c.phase = phase;
    playClips(CASTAWAY_POSE, c);
    const weight = Math.min(1, phase * 4) * Math.min(1, Math.max(0, (2.2 - phase) * 4));
    expect(arm.rotation.z).toBeCloseTo(-2.6 * weight + Math.sin(phase * 12) * .35 * weight);
    expect(arm.rotation.x).toBe(0);
  }
  c.mem['waving'] = 0; c.mem['talking'] = 1;
  playClips(CASTAWAY_POSE, c);
  expect(arm.rotation.z).toBeCloseTo(.08 + Math.max(0, Math.sin(c.t * 2.3)) * .35);
  const first = [head.rotation.x, head.position.y, flames.rotation.y];
  c.t += .5;
  playClips(CASTAWAY_POSE, c);
  expect([head.rotation.x, head.position.y, flames.rotation.y]).not.toEqual(first);
});
