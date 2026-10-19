import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Matrix4, Vector3 } from 'three';

const native = JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json'));
const scratch = `tmp/bellback-world-replay-test-${process.pid}`;
mkdirSync(scratch, { recursive: true });
function row(world) {
  const bones = Object.fromEntries(native.bones.map(bone => {
    const parent = native.bones.find(item => item.name === bone.parent);
    return [bone.name, [...bone.pos.map((value, i) => value - (parent?.pos[i] ?? 0)), 0, 0, 0, 1]];
  }));
  return { frame: 1, gameTime: 1, alive: true, world: world.toArray(), bones };
}
function measure(input) {
  writeFileSync(`${scratch}/trace.json`, JSON.stringify(input));
  execFileSync(process.execPath, ['scripts/measure-bellback-world-contact.mjs', `${scratch}/trace.json`, `${scratch}/result.json`, '900'], { stdio: 'pipe' });
  return JSON.parse(readFileSync(`${scratch}/result.json`));
}
await test('exact bind hierarchy returns original floor and every original mesh', () => {
  const result = measure([row(new Matrix4().makeTranslation(0, 900, 0))]);
  assert.equal(result.summary.minimum, 0);
  assert.equal(result.frames[0].parts.length, 8);
  assert.equal(result.frames[0].originalMeshes.length, 73);
});
await test('world roll is applied to every weighted vertex instead of local floor', () => {
  const world = new Matrix4().makeRotationZ(.72); world.setPosition(2, 900.9, -3);
  const result = measure([row(world)]), point = new Vector3();
  let minimum = Infinity;
  for (const part of native.parts) for (let i = 0; i < part.positions.length; i += 3) {
    point.fromArray(part.positions, i).applyMatrix4(world); minimum = Math.min(minimum, point.y - 900);
  }
  assert.ok(Math.abs(result.summary.minimum - minimum) < 1e-10);
});
await test('incomplete bone trace refuses', () => {
  const input = row(new Matrix4()); delete input.bones.bell;
  assert.throws(() => measure([input]));
});
test.after(() => rmSync(scratch, { recursive: true }));
