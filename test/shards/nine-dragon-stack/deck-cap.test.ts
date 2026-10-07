import { describe, expect, it } from 'vitest';
import { ENTRY_WIDTH } from '../../../src/engine/core/config';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { LIFTS } from '../../../src/shards/nine-dragon-stack/world/liftPlan';
import { entryDeckColliders } from '../../../src/shards/nine-dragon-stack/world/entries';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// G200 (Jake's pick B, art/grid/round-22-landings-standalone): played alone, the lift deck's open end is closed by a
// carved balustrade with a brazier and two lantern pillars; in a grid cell (no caps) the road socket continues there.
async function walkOut(caps: boolean, across: number): Promise<number> {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  for (const c of entryDeckColliders(caps)) {
    if (c.kind !== 'box') continue;
    const body = physics.world.createRigidBody(physics.R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z));
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(c.hx, c.hy, c.hz), body);
  }
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
  const lift = LIFTS[0]; if (lift === undefined) throw new Error('no lift');
  // from 8 m in on the deck, straight out toward the cell edge at 5 m/s for 6 s
  const [x, z] = lift.ix === 0 ? [across, lift.mz + lift.iz * 8] : [lift.mx + lift.ix * 8, across], feet = { x, y: 0.05, z };
  let vy = 0, low = feet.y;
  try {
    for (let i = 0; i < 360; i++) {
      physics.step(); vy -= 22 / 60;
      const moved = motor.move(feet, { x: (-lift.ix * 5) / 60, y: vy / 60, z: (-lift.iz * 5) / 60 }); if (moved.grounded && vy < 0) vy = 0;
      low = Math.min(low, feet.y);
    }
  } finally { motor.dispose(); physics.dispose(); }
  return low;
}

describe('G200: Nine Dragon lift deck balustrade (standalone)', () => {
  it('adds the balustrade, the brazier pedestal and two pillars only with caps', () => {
    expect(entryDeckColliders(true).length - entryDeckColliders(false).length).toBe(LIFTS.length * 4);
  });
  it('keeps a walker on the deck across the whole opening, and leaves it open without caps (the grid)', async () => {
    const h = ENTRY_WIDTH / 2 - 0.45;
    for (const c of [-h, -2, 0, 2, h]) expect(await walkOut(true, c)).toBeGreaterThan(-0.2);
    expect(await walkOut(false, 0)).toBeLessThan(-5);
  });
});
