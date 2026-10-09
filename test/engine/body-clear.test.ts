// oxlint-disable-next-line import/no-nodejs-modules -- The oracle is the exact shipping function before extraction.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fence the shipping source, not a rewritten expected algorithm.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute only the pure shipping law with real native motors.
import { Script } from 'node:vm';
import * as THREE from 'three';
import { beforeAll, expect, it } from 'vitest';
import { clearBody } from '../../src/engine/entities/bodyClear';
import { createSimHost } from '../../src/engine/sim';
import { loadRapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import provenance from '../fixtures/body-clear-oracle/source.json';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

it('keeps the page entry a forwarding call to the defining native law', () => {
  const page = readFileSync('src/engine/entities/AnimalManager.ts', 'utf8');
  expect(page).toContain("import { clearBody as clearNativeBody } from './bodyClear'");
  expect(page).toContain('return clearNativeBody(a, player);');
});

it.each([
  { name: 'side overlap', player: [0.2, 0, 1.6], wall: false },
  { name: 'dead-centre fallback', player: [0, 0, 1.4], wall: false },
  { name: 'clear of body', player: [5, 0, 1.6], wall: false },
  { name: 'other deck height', player: [0, 3, 1.6], wall: false },
  { name: 'blocked by actual wall', player: [0, 0, 1.4], wall: true },
])('matches the exact shipping motor displacement: $name', row => {
  const source = readFileSync('test/fixtures/body-clear-oracle/shipping.txt', 'utf8');
  expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.sha256);
  const script = new Script(`${source.replace('export function clearBody(a: BodyClearable, player: THREE.Vector3): boolean', 'function clearBody(a, player)')}\nclearBody(a, player)`);
  const a = createSimHost(SIM_LEVEL, { rapier }), b = createSimHost(SIM_LEVEL, { rapier });
  try {
    const left = a.entities.get('boar:1'), right = b.entities.get('boar:1');
    if (left === undefined || right === undefined) throw new Error('Missing native boar');
    if (row.wall) for (const host of [a, b]) {
      host.physics.world.createCollider(rapier.ColliderDesc.cuboid(2, 2, 0.15).setTranslation(0, 1, 2.35).setCollisionGroups(groups('WORLD')));
      host.physics.step();
    }
    const player = new THREE.Vector3(row.player[0], row.player[1], row.player[2]);
    const posed = Object.assign(right, { mesh: { position: right.position.clone() } });
    const expected: unknown = script.runInNewContext({ THREE, a: posed, player, CLEAR_PLAYER: 0.38 + 0.3,
      _a: new THREE.Vector3(), _b: new THREE.Vector3(), _c: new THREE.Vector3(), _d: new THREE.Vector3() });
    expect(clearBody(left, player)).toBe(expected);
    expect(left.position).toEqual(right.position);
    expect(posed.mesh.position.x).toBe(right.position.x);
    expect(posed.mesh.position.z).toBe(right.position.z);
  } finally { a.dispose(); b.dispose(); }
});
