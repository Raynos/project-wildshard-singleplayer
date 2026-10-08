import { expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Physics } from '../../../src/engine/physics/Physics';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { addPiece } from '../../../src/engine/physics/pieces';
import { groups } from '../../../src/engine/physics/groups';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { setTerrainHeight } from '../../../src/engine/world/terrainHeight';
import { configureLevel } from '../../../src/engine/level/selection';
import { toLevelSpec } from '../../../src/game/shard/spec';
import manifest, { JETTIES } from '../../../src/shards/driftwood-isle/manifest';
import { Pier } from '../../../src/shards/driftwood-isle/world/Pier';
import { G164_LOWERED } from '../../../src/shards/driftwood-isle/world/build';
import { fakeWorld } from '../../fake/world';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

it.each([1, -1])('walks the actual east jetty in direction %i without extending into the wreck', async (direction) => {
  const terrain = manifest.ground.terrain, jetty = JETTIES[2];
  if (terrain === undefined || jetty === undefined) throw new Error('Missing east jetty terrain');
  configureLevel(toLevelSpec(manifest)); setTerrainHeight(terrain.heightAt);
  const scope = new Scope('east-jetty'), physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  const { pierStart: cut, level, seaRamp } = G164_LOWERED;
  const pier = withOwner(scope, () => new Pier(fakeWorld().sky, { x: jetty.x + Math.sin(jetty.rot) * cut, z: 0, rot: jetty.rot,
    length: jetty.length - cut, width: 3, deckY: level + 1.2, landing: jetty.landing ?? false, seaRamp }).build());
  const placed = pier.placed; if (placed === null) throw new Error('Missing actual placed pier');
  expect(pier.floorHeightAt(177.7, 0)).toBeUndefined();
  expect(pier.floorHeightAt(178, 0)).toBeCloseTo(terrain.heightAt(178, 0) + 0.12, 3);
  addPiece(physics, { id: 'jetty-2', name: 'East jetty', category: 'props', file: 'fixture', colliders: [...placed.colliders], surface: 'wood' });
  physics.world.createCollider(physics.R.ColliderDesc.cuboid(100, 0.5, 20).setTranslation(195, -1.3, 0).setCollisionGroups(groups('WORLD')));
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] });
  const feet = { x: direction === 1 ? 159.6 : 230, y: direction === 1 ? -0.7 : 0.9, z: 0 }; let vy = 0;
  try {
    for (let tick = 0; tick < 1200; tick++) {
      physics.step(); vy -= 22 / 60;
      const moved = motor.move(feet, { x: direction * 4.3 / 60, y: vy / 60, z: 0 }); if (moved.grounded && vy < 0) vy = 0;
    }
    expect(direction === 1 ? feet.x > 230 : feet.x < 159.6).toBe(true);
  } finally { motor.dispose(); physics.dispose(); scope.dispose(); setTerrainHeight(() => 0); }
});
