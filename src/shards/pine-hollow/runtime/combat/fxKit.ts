import * as THREE from 'three';
import { fxMaterial, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';

/**
 * Pine Hollow's fight puffs (PH-C2 / PH-C3) on the shared FX program (src/engine/fx/groundFx.ts), built at boot (a
 * mid-fight compile is a multi-second hitch on iOS): a pale shimmer sphere that swells and fades (the Ghost Stag's fade,
 * a roar's breath), a pool made once, parked invisible and driven by uniforms. The King's fog wall and fallen-lantern
 * flames are material graphs (data/kingFxLook.ts).
 */

/** most spheres one pool holds (throws past it) */
const MAX_PUFFS = 16;

/** a pool of expanding shimmer spheres (FX dome mode, additive) */
export class Puffs {
  private readonly items: { mesh: THREE.Mesh; mat: FxMaterial; t: number; life: number; r0: number; r1: number; a: number }[] = [];
  private next = 0;
  /** `parent`: what the parked spheres hang under (the world's root) */
  constructor(parent: THREE.Object3D, color: THREE.ColorRepresentation, n = 4) {
    if (n > MAX_PUFFS) throw new Error(`[fx] a puff pool of ${String(n)} is over ${String(MAX_PUFFS)}`);
    const g = new THREE.SphereGeometry(1, 20, 12);
    for (let i = 0; i < Math.min(n, MAX_PUFFS); i++) {
      const mat = fxMaterial(FX.dome, color, 0);
      const mesh = new THREE.Mesh(g, mat);
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 28;
      parent.add(mesh);
      this.items.push({ mesh, mat, t: 0, life: 0, r0: 0.5, r1: 3, a: 1 });
    }
  }
  /** a puff at `at`, radius r0 → r1 over `life` s, peak alpha `a` */
  burst(at: THREE.Vector3, r0: number, r1: number, life = 0.7, a = 0.9): void {
    const it = this.items[this.next];
    if (it === undefined) return;
    this.next = (this.next + 1) % this.items.length;
    it.mesh.position.copy(at); it.t = 0; it.life = life; it.r0 = r0; it.r1 = r1; it.a = a;
    it.mesh.scale.setScalar(r0); it.mesh.visible = true;
  }
  update(dt: number, t: number): void {
    const items = this.items;
    for (let i = 0; i < Math.min(items.length, MAX_PUFFS); i++) {
      const it = items[i];
      if (it === undefined || !it.mesh.visible) continue;
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      it.mesh.scale.setScalar(it.r0 + (it.r1 - it.r0) * (1 - (1 - k) * (1 - k)));
      it.mat.uniforms.uAlpha.value = it.a * (1 - k) * Math.min(1, it.t * 12);
      it.mat.uniforms.uTime.value = t;
      if (k >= 1) it.mesh.visible = false;
    }
  }
}
