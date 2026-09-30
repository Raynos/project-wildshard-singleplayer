/**
 * The sea-glass glow round a held blade (E314, sea glass charm III: "the sword glows at night", Jake's board 3 C): two
 * additive shells on the blade — a bright aqua core hugging it and a faint wide halo — placed every frame from the blade's
 * grip → tip (Sword.ts hands them over for either rig: the code-built sword or the castaway's skinned arms), faded in with
 * the night. Cheap on purpose: one shared 6-sided spindle (60 triangles), two MeshBasicMaterials (additive, no depth
 * write, no fog: the same program as the viewmodel's depth clearer, so nothing compiles the first night), drawn only
 * while the glow is on (by day both meshes are hidden: no draw).
 *
 *   const glow = new BladeGlow(sword.model);       // camera space, after the viewmodel's depth clear
 *   glow.set(grip, tip, level, t);                // each frame while level > 0 (grip / tip in the model's space)
 *   glow.hide();                                  // day
 */
import * as THREE from 'three';

/** the charm's sea glass (seaGlassChime.ts's aqua), pushed over 1 so the bloom (where the tier has one) catches it */
const AQUA = new THREE.Color(0x5fe6d8).multiplyScalar(1.6);
/** radius ∝ the blade's length: the core ~4 cm on the 0.52 m blade, the halo ~2.1× that */
const CORE_R = 0.08, HALO_R = 0.17;
const CORE_A = 0.5, HALO_A = 0.16;

let spindle: THREE.BufferGeometry | null = null;
/** a unit spindle along +Y (0 → 1), radius 1 at its widest: full along the blade, tapering to the tip */
function spindleGeometry(): THREE.BufferGeometry {
  if (spindle) return spindle;
  const SIDES = 6, rings: [number, number][] = [[-0.04, 0.55], [0.12, 1], [0.6, 0.95], [0.9, 0.6], [1.06, 0.05]];
  const pos: number[] = [];
  const at = (k: number, y: number, r: number): [number, number, number] => {
    const a = (k / SIDES) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  for (let i = 0; i + 1 < rings.length; i++) {
    const [y0, r0] = rings[i] ?? [0, 0], [y1, r1] = rings[i + 1] ?? [1, 0];
    for (let k = 0; k < SIDES; k++) {
      const a = at(k, y0, r0), b = at(k + 1, y0, r0), c = at(k + 1, y1, r1), d = at(k, y1, r1);
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  spindle = g;
  return g;
}

const _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class BladeGlow {
  private readonly core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly halo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

  constructor(parent: THREE.Object3D) {
    const mat = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color: AQUA, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.core = new THREE.Mesh(spindleGeometry(), mat());
    this.halo = new THREE.Mesh(spindleGeometry(), mat());
    for (const [i, m] of [this.core, this.halo].entries()) {
      m.name = i === 0 ? 'blade-glow' : 'blade-glow-halo';
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      m.renderOrder = 1003 + i; // the viewmodel's transparent queue, after the blade (1000) and its clear (999)
      m.visible = false;
      parent.add(m);
    }
  }

  /** place both shells on the blade (grip → tip, the parent's space) at `level` 0…1; `t` (s) makes the glow breathe */
  set(grip: THREE.Vector3, tip: THREE.Vector3, level: number, t: number): void {
    _dir.subVectors(tip, grip);
    const len = _dir.length();
    if (len < 1e-4 || level <= 0.005) { this.hide(); return; }
    _dir.divideScalar(len);
    const breathe = 0.85 + 0.15 * Math.sin(t * 2.1);
    for (const [m, r, a] of [[this.core, CORE_R, CORE_A], [this.halo, HALO_R, HALO_A]] as const) {
      m.visible = true;
      m.position.copy(grip);
      m.quaternion.setFromUnitVectors(UP, _dir);
      m.scale.set(r * len, len, r * len);
      m.material.opacity = a * level * breathe;
    }
  }

  hide(): void { this.core.visible = false; this.halo.visible = false; }

  get visible(): boolean { return this.core.visible; }
}
