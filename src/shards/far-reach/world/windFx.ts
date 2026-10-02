import { BufferGeometry, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, ShaderMaterial, Vector3, type Object3D } from 'three';

/**
 * Visible wind (style bible §7, loop 3): the GUST is a cone of streaks with tumbling petals; the updraft is a soft
 * spiral of streaks with rising leaves. A streak is a crossed pair of thin quads, instanced, alpha-blended with a
 * per-instance fade (instanceColor) so the whole effect is one draw per kind and no textures.
 */

/** A crossed pair of quads, `z` 0 → −1 (length 1), 1 wide; uv.x runs along the length. */
function streakGeometry(): BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const [ax, ay] of [[0.5, 0], [0, 0.5]] as const) {
    const q = [[-ax, -ay, 0, 0, 0], [ax, ay, 0, 0, 1], [ax, ay, -1, 1, 1], [-ax, -ay, 0, 0, 0], [ax, ay, -1, 1, 1], [-ax, -ay, -1, 1, 0]];
    for (const [x, y, z, u, v] of q) { pos.push(x ?? 0, y ?? 0, z ?? 0); uv.push(u ?? 0, v ?? 0); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); return g;
}

/** Streaks: bright in the middle of their length and width, tapering to nothing at the ends; instanceColor is the tint × fade. */
function streakMaterial(): ShaderMaterial {
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, fog: false,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vTint;
      void main(){ vUv = uv; vTint = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec3 vTint;
      void main(){
        float along = smoothstep(0.0, 0.35, vUv.x) * (1.0 - smoothstep(0.55, 1.0, vUv.x));
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        // instanceColor carries the tint × fade: the brightest channel is the fade, the colour stays near white
        float fade = max(vTint.r, max(vTint.g, vTint.b));
        gl_FragColor = vec4(vTint / max(fade, 1e-3), fade * along * across);
      }` });
}

const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), fwd = new Vector3(0, 0, -1), c = new Color();
function place(mesh: InstancedMesh, i: number, at: Vector3, dir: Vector3, width: number, length: number, tint: Color, fade: number): void {
  q.setFromUnitVectors(fwd, dir); m.compose(at, q, s.set(width, width, length)); mesh.setMatrixAt(i, m);
  mesh.setColorAt(i, c.copy(tint).multiplyScalar(Math.max(0, fade)));
}
function instanced(geometry: BufferGeometry, material: ShaderMaterial, count: number, name: string): InstancedMesh<BufferGeometry, ShaderMaterial> {
  const mesh = new InstancedMesh(geometry, material, count); mesh.name = name; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3); mesh.instanceColor.setUsage(DynamicDrawUsage);
  for (let i = 0; i < count; i++) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); }
  return mesh;
}
/** Tumbling petals / leaves: small double-sided quads, normal blending; a dead one scales to nothing. */
function flakes(count: number, name: string): InstancedMesh<BufferGeometry, MeshBasicMaterial> {
  const mesh = new InstancedMesh(new CircleGeometry(0.5, 5).scale(1, 0.55, 1), new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }), count);
  mesh.name = name; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  for (let i = 0; i < count; i++) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); }
  return mesh;
}

/** The GUST: how many streaks and petals, how long they live, how far they fly. */
export const GUST_FX = { streaks: 30, petals: 14, life: 0.6, speed: 20, start: 1.0, spread: 1.7 } as const;
const STREAK_TINT = new Color(0xeaf8ff), STREAK_WARM = new Color(0xffe6c4), PETALS = [0xffd4dc, 0xfff1e0, 0xffc6a8, 0xf5b8d0];

interface Bit { dir: Vector3; origin: Vector3; spin: number; speed: number; width: number; warm: boolean; delay: number; size: number }
export interface GustFx { readonly objects: readonly Object3D[]; readonly dispose: () => void; readonly fire: (from: Vector3, dir: Vector3) => void; readonly update: (dt: number) => void }

export function gustFx(random: () => number): GustFx {
  const streaks = instanced(streakGeometry(), streakMaterial(), GUST_FX.streaks, 'far.gust.streaks'), petals = flakes(GUST_FX.petals, 'far.gust.petals');
  const bits: Bit[] = [], leafs: Bit[] = [], spinQ = new Quaternion(), axis = new Vector3(), side = new Vector3(), up = new Vector3();
  let age = 99, from = new Vector3(), base = new Vector3(0, 0, -1);
  const cone = (dir: Vector3, spread: number): Vector3 => {
    side.set(0, 1, 0).cross(dir); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize(); up.copy(dir).cross(side).normalize();
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * spread;
    return dir.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
  };
  return { objects: [streaks, petals],
    dispose: () => { streaks.removeFromParent(); petals.removeFromParent(); streaks.geometry.dispose(); petals.geometry.dispose(); streaks.material.dispose(); petals.material.dispose(); streaks.dispose(); petals.dispose(); },
    fire: (origin, dir) => {
      age = 0; from = origin.clone(); base = dir.clone().normalize(); bits.length = 0; leafs.length = 0;
      // speed lines: streaks leave a wide patch around the fan and fly out along the gust, so they read as long lines
      // radiating from the crosshair, not as dots seen end-on
      side.set(0, 1, 0).cross(base).normalize(); up.copy(base).cross(side).normalize();
      for (let i = 0; i < GUST_FX.streaks; i++) {
        const a = random() * Math.PI * 2, r = 0.35 + random() * GUST_FX.spread * 0.5;
        const start = from.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.7);
        bits.push({ dir: cone(base, 0.16), origin: start, spin: (random() - 0.5) * 1.2, speed: GUST_FX.speed * (0.75 + random() * 0.5),
          width: 0.05 + random() * 0.07, warm: random() < 0.3, delay: random() * 0.1, size: 0 });
      }
      for (let i = 0; i < GUST_FX.petals; i++) leafs.push({ dir: cone(base, 0.5), origin: from.clone(), spin: (random() - 0.5) * 14, speed: GUST_FX.speed * (0.35 + random() * 0.25),
        width: 0, warm: false, delay: random() * 0.08, size: 0.035 + random() * 0.03 });
      leafs.forEach((_, i) => { petals.setColorAt(i, c.setHex(PETALS[i % PETALS.length] ?? 0xffffff)); });
      if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    },
    update: (dt) => {
      if (age > GUST_FX.life + 0.2) return;
      age += dt;
      bits.forEach((b, i) => {
        const t = Math.max(0, age - b.delay), k = t / GUST_FX.life;
        if (k <= 0 || k >= 1) { m.makeScale(0, 0, 0); streaks.setMatrixAt(i, m); return; }
        // the streak curls a little round the gust's axis as it flies (wind, not bullets)
        axis.copy(base); spinQ.setFromAxisAngle(axis, b.spin * k); const d = b.dir.clone().applyQuaternion(spinQ);
        const dist = GUST_FX.start + b.speed * t * (1 - k * 0.45), length = 1 + 3.2 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        p.copy(b.origin).addScaledVector(d, dist);
        const fade = Math.min(1, k * 8) * (1 - k) ** 1.3 * 0.8;
        place(streaks, i, p, d, b.width * (1 + k), length, b.warm ? STREAK_WARM : STREAK_TINT, fade);
      });
      leafs.forEach((b, i) => {
        const t = Math.max(0, age - b.delay), k = t / (GUST_FX.life + 0.2);
        if (k <= 0 || k >= 1) { m.makeScale(0, 0, 0); petals.setMatrixAt(i, m); return; }
        p.copy(b.origin).addScaledVector(b.dir, GUST_FX.start + 0.6 + b.speed * t); p.y -= 1.2 * t * t;
        q.setFromAxisAngle(axis.set(Math.sin(i), 1, Math.cos(i * 1.7)).normalize(), b.spin * t);
        m.compose(p, q, s.setScalar(b.size * (1 - k * k))); petals.setMatrixAt(i, m);
      });
      streaks.instanceMatrix.needsUpdate = true; if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true; petals.instanceMatrix.needsUpdate = true;
    } };
}

/** The updraft's spiral: streaks winding up a helix round the ramp's axis, and leaves riding it. */
/** Round 2 (council: the streaks crossing the glass ramp read as cracks): fewer, fainter, wider round the ramp. */
export const UPDRAFT_FX = { streaks: 24, leaves: 14, radius: 3.3, turns: 6, rate: 0.1 } as const;
const LEAVES = [0xb9c868, 0xd9c060, 0x93b552, 0xf0d488];

export interface UpdraftFx { readonly objects: readonly Object3D[]; readonly update: (t: number) => void }

/** `a` → `b` is the column's axis (bottom to top). */
export function updraftFx(a: Vector3, b: Vector3): UpdraftFx {
  const streaks = instanced(streakGeometry(), streakMaterial(), UPDRAFT_FX.streaks, 'far.updraft.streaks'), leaves = flakes(UPDRAFT_FX.leaves, 'far.updraft.leaves');
  for (let i = 0; i < UPDRAFT_FX.leaves; i++) leaves.setColorAt(i, c.setHex(LEAVES[i % LEAVES.length] ?? 0xffffff));
  const axisDir = b.clone().sub(a), len = axisDir.length(); axisDir.normalize();
  const side = new Vector3(1, 0, 0).cross(axisDir).normalize().cross(axisDir).normalize(), up2 = axisDir.clone().cross(side).normalize();
  const at = (f: number, angle: number, r: number, out: Vector3): Vector3 =>
    out.copy(a).addScaledVector(axisDir, f * len).addScaledVector(side, Math.cos(angle) * r).addScaledVector(up2, Math.sin(angle) * r);
  const p2 = new Vector3(), dir = new Vector3(), tint = new Color(0xcdeeff);
  return { objects: [streaks, leaves], update: (t) => {
    for (let i = 0; i < UPDRAFT_FX.streaks; i++) {
      const f = (i / UPDRAFT_FX.streaks + t * UPDRAFT_FX.rate) % 1, angle = f * UPDRAFT_FX.turns * Math.PI * 2 + i * 2.39996, r = UPDRAFT_FX.radius * (0.8 + 0.3 * Math.sin(i * 1.7));
      at(f, angle, r, p); at(f + 0.012, angle + 0.55, r, p2); dir.copy(p2).sub(p).normalize();
      const fade = Math.sin(f * Math.PI) * 0.42;
      place(streaks, i, p2, dir, 0.07, 2.4, tint, fade);
    }
    for (let i = 0; i < UPDRAFT_FX.leaves; i++) {
      const f = (i / UPDRAFT_FX.leaves + t * UPDRAFT_FX.rate * 0.8) % 1, angle = -f * UPDRAFT_FX.turns * 1.4 * Math.PI * 2 + i * 1.3;
      at(f, angle, UPDRAFT_FX.radius * 1.1, p);
      q.setFromAxisAngle(dir.set(Math.sin(i * 3.1), 1, Math.cos(i)).normalize(), t * (3 + i % 3));
      m.compose(p, q, s.setScalar(0.26 * Math.min(1, Math.sin(f * Math.PI) * 3))); leaves.setMatrixAt(i, m);
    }
    streaks.instanceMatrix.needsUpdate = true; if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  } };
}
