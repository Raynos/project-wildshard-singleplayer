// E285: Rapier's controller now and then stops a whole move on the flat floor the capsule already rests on (one contact,
// normal straight up, time of impact 0). Player.step ends a dash on any step that moves < 30 % of what it asked for, so
// ~1 dodge in 6 died mid-air, in the practice arena and on the terrain. The motor retries such a stall flat.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '#engine-internal/physics/rapier';
import { Physics } from '#engine-internal/physics/Physics';
import { CharacterMotor } from '#engine-internal/physics/CharacterMotor';
import { groups } from '#engine-internal/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());
const MOTOR = { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] } as const;

describe('dash on a flat floor', () => {
  it('never stalls on the floor it stands on (the arena floor 900 m up, dashes in four directions)', async () => {
    const R = await rapier();
    const ph = new Physics(R);
    ph.world.createCollider(R.ColliderDesc.cuboid(50, 0.14, 50).setTranslation(0, 900 - 0.14, -235).setCollisionGroups(groups('WORLD')));
    const motor = new CharacterMotor(ph, MOTOR);
    const feet = { x: 0, y: 900.02, z: -230 };
    for (let i = 0; i < 30; i++) { motor.move(feet, { x: 0, y: -0.37 / 60, z: 0 }); ph.step(); }
    let stalls = 0, steps = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (let d = 0; d < 80; d++) {
      const [dx, dz] = dirs[d % 4] ?? [1, 0];
      for (let i = 0; i < 15; i++) { // DODGE_TIME 0.25 s at 12.8 m/s, gravity's one-step pull as Player.step asks
        const r = motor.move(feet, { x: dx * 0.2133, y: -0.006, z: dz * 0.2133 });
        steps++; if (r.horizontalFreedom < 0.3) stalls++;
        ph.step();
      }
      for (let i = 0; i < 10; i++) { motor.move(feet, { x: 0, y: -0.006, z: 0 }); ph.step(); }
    }
    expect(stalls, `${stalls} of ${steps} dash steps stalled`).toBe(0);
    expect(feet.y).toBeGreaterThan(899.9);
    ph.dispose();
  });
});
