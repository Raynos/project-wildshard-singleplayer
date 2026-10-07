import { describe, expect, it } from 'vitest';
import { InstancedMesh, type Object3D } from 'three';
import { ENTRY_ASPHALT } from '../../../src/engine/core/config';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import type { ColliderDesc } from '../../../src/engine/world/registry';
import { ISLET, RISING_ISLETS, type RisingIslet } from '../../../src/shards/far-reach/world/islets';
import { lipCollider } from '../../../src/shards/far-reach/world/risingIslet';
import { DOCK, dockColliders, skyDockPiece } from '../../../src/shards/far-reach/world/skyDock';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// G200 (Jake's pick B, art/grid/round-22-landings-standalone): played alone, each Rising Islet lip ends at a railed timber
// sky dock with a beacon. Walking at the rails from the dock and the lip never drops a player into the cloud sea.
async function world(entry: RisingIslet, docked: boolean): Promise<{ physics: Physics; motor: CharacterMotor }> {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  const boxes: ColliderDesc[] = [lipCollider(entry), ...(docked ? dockColliders(entry) : [])];
  for (const c of boxes) {
    if (c.kind !== 'box') continue;
    const body = physics.world.createRigidBody(physics.R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z));
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(c.hx, c.hy, c.hz), body);
  }
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
  return { physics, motor };
}
/** walk at 5 m/s from (t, u) toward (dt, du) for 6 s under gravity; the lowest the feet got */
function walk(physics: Physics, motor: CharacterMotor, entry: RisingIslet, t: number, u: number, dt: number, du: number): number {
  const a = entry.at(t, u, 0.05), b = entry.at(t + dt, u + du, 0), d = Math.hypot(b.x - a.x, b.z - a.z), feet = { x: a.x, y: 0.05, z: a.z };
  let vy = 0, low = feet.y;
  for (let i = 0; i < 360; i++) {
    physics.step(); vy -= 22 / 60;
    const moved = motor.move(feet, { x: ((b.x - a.x) / d) * 5 / 60, y: vy / 60, z: ((b.z - a.z) / d) * 5 / 60 }); if (moved.grounded && vy < 0) vy = 0;
    low = Math.min(low, feet.y);
  }
  return low;
}

describe('G200: Sky Reach sky docks (standalone)', () => {
  it('draws all four docks in two instanced draws, a beacon each, colliding as plain boxes', () => {
    const piece = skyDockPiece(), meshes: Object3D[] = piece.object?.children ?? [];
    expect(meshes).toHaveLength(2); for (const m of meshes) expect(m).toBeInstanceOf(InstancedMesh);
    const beacon = meshes[1]; expect(beacon instanceof InstancedMesh ? beacon.count : 0).toBe(RISING_ISLETS.length);
    expect(piece.colliders?.length).toBe(RISING_ISLETS.reduce((n, entry) => n + dockColliders(entry).length, 0));
    for (const entry of RISING_ISLETS) {
      // the deck's top is flush with the lip (y 0) and abuts its outer edge; the dock stays in the cell
      const [deck] = dockColliders(entry); if (deck?.kind !== 'box') throw new Error('the deck is a box');
      expect(deck.y + deck.hy).toBeCloseTo(0, 9);
      const out = entry.at(0, DOCK.u0, 0), lip = entry.at(0, ENTRY_ASPHALT, 0);
      expect(Math.max(Math.abs(out.x), Math.abs(out.z))).toBeLessThan(250);
      expect(Math.hypot(lip.x - out.x, lip.z - out.z)).toBeCloseTo(ENTRY_ASPHALT - DOCK.u0, 9);
    }
  });

  it('keeps a walker on the dock and the lip at every open edge, and leaves the islet side open', async () => {
    for (const entry of RISING_ISLETS) {
      const { physics, motor } = await world(entry, true), mid = ENTRY_ASPHALT + ISLET.lip.depth / 2;
      try {
        // off the dock's far end, its two sides, the lip's outer corners beside the jetty and the lip's two ends
        expect(walk(physics, motor, entry, 0, 10, 0, -20)).toBeGreaterThan(-0.2);
        expect(walk(physics, motor, entry, 0, 10, 20, 0)).toBeGreaterThan(-0.2);
        expect(walk(physics, motor, entry, 0, 10, -20, 0)).toBeGreaterThan(-0.2);
        expect(walk(physics, motor, entry, 3.6, mid, 0, -20)).toBeGreaterThan(-0.2);
        expect(walk(physics, motor, entry, -3.6, mid, 0, -20)).toBeGreaterThan(-0.2);
        expect(walk(physics, motor, entry, 0, mid, 20, 0)).toBeGreaterThan(-0.2);
        expect(walk(physics, motor, entry, 0, mid, -20, 0)).toBeGreaterThan(-0.2);
        // from the dock onto the lip and over its inner edge (where the islet rests; absent here, so the walker drops)
        expect(walk(physics, motor, entry, 0, 8, 0, 20)).toBeLessThan(-5);
      } finally { motor.dispose(); physics.dispose(); }
    }
  });

  it('without the dock (a grid cell: the road socket continues) the lip alone is open on its outer edge', async () => {
    const entry = RISING_ISLETS[0]; if (entry === undefined) throw new Error('no entry');
    const { physics, motor } = await world(entry, false);
    try { expect(walk(physics, motor, entry, 0, ENTRY_ASPHALT + 0.75, 0, -20)).toBeLessThan(-5); } finally { motor.dispose(); physics.dispose(); }
  });
});
