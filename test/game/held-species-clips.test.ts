import { Bone } from 'three';
import { expect, it } from 'vitest';
import { playClips, type ClipCtx } from '../../src/game/plugin/animation';
import { ROC_CLIPS } from '../../src/shards/far-reach/data/rocClips';

/** Independent shipping imperative oracle retained after the product callback retires. */
function original({ bones, t, dt, alive, mem }: ClipCtx & { dt: number }): void {
  const burst = Math.max(0, Math.sin(t * 1.05) - 0.85) / 0.15;
  const flap = alive ? 0.1 + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 3.8) * 0.45 * burst : 0.9;
  const l = bones['wingL'], r = bones['wingR'], tail = bones['tail'], body = bones['body'];
  if (l) l.rotation.z = flap; if (r) r.rotation.z = -flap; if (tail) tail.rotation.x = alive ? Math.sin(t * 1.1) * 0.15 : 0;
  const lean = (mem['rocBank'] ?? 0) + ((alive ? mem['rocLean'] ?? 0 : 0) - (mem['rocBank'] ?? 0)) * Math.min(1, dt * 3);
  mem['rocBank'] = lean; if (body) body.rotation.z = lean;
  const head = bones['head'];
  if (head) head.rotation.y = alive ? Math.max(-0.6, Math.min(0.6, -lean * 1.8)) + Math.sin(t * 0.45) * 0.12 : 0;
}
const names = ['wingL', 'wingR', 'tail', 'body', 'head'] as const;
function frame(missing: boolean): ClipCtx & { dt: number } {
  const bones: Record<string, Bone> = {};
  for (const name of names) if (!(missing && name === 'body')) bones[name] = new Bone();
  return { bones, t: 0, dt: 0, phase: 0, speed: 0, alive: true, deathT: -1, attack: -1, mem: {} };
}
function bits(ctx: ClipCtx): Uint8Array {
  const values: number[] = [];
  for (const name of names) {
    const bone = ctx.bones[name]; if (bone === undefined) continue;
    bone.updateMatrix(); values.push(...bone.matrix.elements);
  }
  values.push(ctx.mem['rocBank'] ?? 0);
  return new Uint8Array(Float64Array.from(values).buffer);
}

it.each([20, 30, 60])('keeps every original held-rig matrix bit and eased continuation at %i Hz', hz => {
  for (const missing of [false, true]) {
    const before = frame(missing), after = frame(missing);
    for (let tick = 0; tick < hz * 25; tick++) {
      const dt = tick % 71 === 0 ? 0 : tick === 400 ? 0.5 : 1 / hz;
      for (const context of [before, after]) {
        context.t += dt; context.dt = dt; context.alive = tick < hz * 20;
        context.mem['rocLean'] = tick % 127 === 0 ? -0 : Math.sin(tick * 0.031) * 0.7;
        if (tick === hz * 10) context.mem = structuredClone(context.mem);
      }
      original(before); playClips(ROC_CLIPS, after);
      expect(bits(after)).toEqual(bits(before));
      expect(after.mem).toEqual(before.mem);
    }
  }
});

it('refuses missing frame authority and invalid bounds before writing eased memory', () => {
  const context = frame(false), mem = { ...context.mem };
  const missingFrame: ClipCtx = { ...context }; delete missingFrame.dt;
  expect(() => playClips([{ mem: 'bank', ease: 3, cases: [{ sum: [1] }] }], missingFrame)).toThrow('finite nonnegative');
  expect(context.mem).toEqual(mem);
  expect(() => playClips([{ bone: 'head', channel: 'rotation.y', cases: [{ sum: [{ of: [{ bounded: [1], min: 2, max: 1 }] }] }] }], context)).toThrow('bounded');
  expect(context.bones['head']?.rotation.y).toBe(0);
});
