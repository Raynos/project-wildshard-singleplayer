import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { setTerrainHeight } from '../../../src/engine/world/terrainHeight';
import { Physics } from '../../../src/engine/physics/Physics';
import { RopeChain } from '../../../src/engine/physics/ropeChain';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { RopeBridge } from '../../../src/shards/driftwood-isle/world/RopeBridge';
import manifest, { BRIDGE } from '../../../src/shards/driftwood-isle/manifest';
import { MOVERS } from '../../../src/shards/driftwood-isle/data/movers';
import { fakeWorld } from '../../fake/world';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

it('SF30 held legacy bridge carries a walker on its live model terrain and keeps the drawn deck on those bodies', async () => {
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Missing terrain');
  // A placed world may sample a heightfield rather than the baker's analytic terrain. The model is the legacy truth.
  setTerrainHeight((x, z) => Math.fround(terrain.heightAt(x, z)) + 0.37);
  const scope = new Scope('bridge.legacy'), physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  const bridge = withOwner(scope, () => new RopeBridge(fakeWorld().sky, { ...BRIDGE, a: [...BRIDGE.a], b: [...BRIDGE.b] }).build());
  const spec = bridge.chainSpec(), chain = new RopeChain(physics, spec), declared = MOVERS.find((row) => row.kind === 'chain')?.chain;
  const start = spec.segments[0], end = spec.segments.at(-1); if (start === undefined || end === undefined || declared === undefined) throw new Error('Missing bridge');
  expect(Math.abs(start.y - (declared.segments[0]?.y ?? start.y))).toBeGreaterThan(0.36);
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
  const feet = { x: start.x, y: start.y + 0.4, z: start.z }, direction = new Vector3(end.x - start.x, 0, end.z - start.z).normalize();
  let vy = 0, riding = 0;
  try {
    for (let tick = 0; tick < 360; tick++) {
      const carried = motor.carry(feet); vy -= 22 / 60;
      const moved = motor.move(feet, { x: direction.x * 4.3 / 60, y: carried && vy <= 0 ? 0 : vy / 60, z: direction.z * 4.3 / 60 });
      if (moved.grounded && vy < 0) vy = 0; if (carried) riding++;
      physics.step(); chain.capture(); bridge.setPoses(chain, 1); bridge.mesh.updateMatrixWorld(true);
      for (const [index, owner] of spec.owners.entries()) {
        const body = chain.bodies[index]; if (body === undefined) throw new Error('Missing chain body');
        const p = body.translation(), drawn = new Vector3().setFromMatrixPosition(owner.follows.matrixWorld);
        expect(drawn.distanceTo(new Vector3(p.x, p.y, p.z))).toBeLessThan(0.00001);
      }
    }
    expect(riding).toBeGreaterThan(200);
    expect(new Vector3(feet.x - start.x, 0, feet.z - start.z).length()).toBeGreaterThan(20);
  } finally { motor.dispose(); chain.dispose(); physics.dispose(); scope.dispose(); setTerrainHeight(() => 0); }
});
