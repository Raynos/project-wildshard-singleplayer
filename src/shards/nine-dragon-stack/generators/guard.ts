// Author-only dragon guard; native-byte equality is permanent.
import { Vector3 } from 'three';
import { type KitX, curve } from './kitx';
import { WEAPON_LOOKS as LOOK } from '../data/weaponLooks';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export function buildGuardProcedural(x: KitX): void {
  const X = v(1, 0, 0), Y = v(0, 1, 0), Z = v(0, 0, 1);
  const B = LOOK.brass, D = LOOK.darkBrass;
  // skull, crown up (+x), a heavy brow; the snout forward (+y); the lower jaw hangs open below the blade
  x.ellipsoid(v(0.012, -0.004, 0), X, Y, Z, 0.026, 0.032, 0.022, B, (d) => 1 + 0.08 * Math.sin(d.x * 9 + d.y * 7) * Math.sin(d.z * 8));
  x.ellipsoid(v(0.024, 0.038, 0), X, Y, Z, 0.014, 0.032, 0.017, B, (d) => 1 + 0.1 * Math.max(0, d.x) * Math.sin(d.y * 14));
  x.ellipsoid(v(0.029, 0.066, 0), X, Y, Z, 0.012, 0.012, 0.016, D);
  x.ellipsoid(v(-0.024, 0.03, 0), X, Y, Z, 0.009, 0.03, 0.014, B);
  x.ellipsoid(v(-0.002, -0.012, 0), X, Y, Z, 0.022, 0.026, 0.02, D);
  for (const sz of [1, -1]) {
    // brow ridge and a glowing eye under it
    x.sweep(curve([v(0.03, 0.03, sz * 0.012), v(0.036, 0.012, sz * 0.017), v(0.034, -0.008, sz * 0.02)], 4), (t) => 0.006 * (1 - t * 0.6), 6, B, { capStart: true, capEnd: true });
    x.ellipsoid(v(0.026, 0.018, sz * 0.018), X, Y, Z, 0.004, 0.006, 0.003, LOOK.eye);
    // fangs, top and bottom
    for (const fy of [0.05, 0.03]) {
      x.sweep([v(0.014, fy, sz * 0.01), v(0.004, fy + 0.004, sz * 0.009)], (t) => 0.003 * (1 - t), 5, LOOK.fang, { capStart: true });
      x.sweep([v(-0.018, fy, sz * 0.009), v(-0.009, fy + 0.004, sz * 0.008)], (t) => 0.0026 * (1 - t), 5, LOOK.fang, { capStart: true });
    }
    // two antler horns swept back past the grip
    x.sweep(curve([v(0.034, 0.0, sz * 0.012), v(0.05, -0.03, sz * 0.02), v(0.058, -0.065, sz * 0.024), v(0.05, -0.1, sz * 0.022)], 5), (t) => 0.0055 * (1 - t * 0.85), 7, B, { capStart: true });
    x.sweep(curve([v(0.05, -0.035, sz * 0.02), v(0.066, -0.045, sz * 0.03), v(0.07, -0.06, sz * 0.03)], 3), (t) => 0.003 * (1 - t * 0.8), 6, B);
    // the mane: flame locks swept back and out, alternating light and dark brass
    for (let m = 0; m < 5; m++) {
      const y0 = 0.01 - m * 0.012;
      const xa = 0.02 - m * 0.012;
      const sp = 0.022 + m * 0.004;
      x.sweep(curve([v(xa, y0, sz * 0.014), v(xa + 0.004, y0 - 0.025, sz * sp), v(xa - 0.004, y0 - 0.05, sz * (sp + 0.012)), v(xa - 0.012, y0 - 0.068, sz * (sp + 0.006))], 4),
        (t) => 0.0075 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)), 7, m % 2 === 0 ? B : D, { flat: 0.45, up: v(0, 0, 1), capStart: true });
    }
    // whiskers from the snout, curling back
    x.sweep(curve([v(0.02, 0.07, sz * 0.012), v(0.012, 0.06, sz * 0.03), v(0.0, 0.035, sz * 0.042), v(-0.004, 0.01, sz * 0.04), v(0.004, -0.004, sz * 0.034)], 4), (t) => 0.0022 * (1 - t * 0.7), 5, B);
  }
  // the socket ring the grip enters
  x.sweep([v(0, -0.028, 0), v(0, -0.04, 0)], () => 0.02, 14, D, { capEnd: true });
}

