import { describe, expect, it } from 'vitest';
import { ENTRY_WIDTH } from '../../../src/engine/core/config';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { DECK_PORTALS, type DeckPortal } from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { entryCapsFor } from '../../../src/shards/nine-dragon-stack/world/entries';
import { entryDeckColliders } from '../../../src/shards/nine-dragon-stack/world/floorRows';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// G200 (Jake's pick B, art/grid/round-22-landings-standalone): played alone, a deck's open end is closed by a carved
// balustrade with a brazier and two lantern pillars (G224: on all four decks, the square's portal sets you down on any of
// them); in a grid cell (no caps) the road socket continues there.
async function walkOut(caps: boolean, across: number, deck: DeckPortal): Promise<number> {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  for (const c of entryDeckColliders(caps)) {
    if (c.kind !== 'box') continue;
    const body = physics.world.createRigidBody(physics.R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z));
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(c.hx, c.hy, c.hz), body);
  }
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
  const lift = { ix: deck.nx, iz: deck.nz };
  // from 8 m in on the deck, straight out toward the cell edge at 5 m/s for 6 s
  const [x, z] = lift.ix === 0 ? [across, deck.mz + lift.iz * 8] : [deck.mx + lift.ix * 8, across], feet = { x, y: 0.05, z };
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

describe('G200: Nine Dragon deck balustrades (standalone)', () => {
  it('caps only standalone: a grid cell (its 500 m cube) gets none', () => {
    expect(entryCapsFor(null)).toBe(true); expect(entryCapsFor({ half: 250 })).toBe(false);
  });
  it('adds the balustrade, the brazier pedestal and two pillars only with caps', () => {
    expect(entryDeckColliders(true).length - entryDeckColliders(false).length).toBe(DECK_PORTALS.length * 4);
  });
  it('keeps a walker on the deck across the whole opening, and leaves it open without caps (the grid)', async () => {
    const h = ENTRY_WIDTH / 2 - 0.45;
    for (const deck of DECK_PORTALS) {
      for (const c of [-h, -2, 0, 2, h]) expect(await walkOut(true, c, deck)).toBeGreaterThan(-0.2);
      expect(await walkOut(false, 0, deck)).toBeLessThan(-5);
    }
  });
});
