import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three';

/**
 * A luminous wake as a generic system (SHARD-PLATFORM M3; ex Sky Reach's world/rayWake.ts, E399 round 10): a ribbon along a
 * moving thing's own recent path, facing the camera, widest just behind it and fading to nothing at its far end. It records
 * where the thing really went (one sample every `every` seconds), so it curls as the thing turns. Additive, no depth write:
 * a glow, not a surface. Nothing here knows a shard: the samples, timing, width, colour and name are the shard's row.
 */

/** A wake's row: how many samples, seconds between them, its width at the head (m), its colour (linear RGB) and mesh name. */
export interface WakeRibbonRow {
  readonly samples: number;
  readonly every: number;
  readonly width: number;
  readonly color: readonly [number, number, number];
  readonly name: string;
}

/** A wake's mesh (add it to the scene) and its tick: the head's position, whether the thing is alive, the camera, dt. */
export interface WakeRibbon { readonly mesh: Mesh<BufferGeometry, ShaderMaterial>; update: (at: Vector3, alive: boolean, camera: Vector3, dt: number) => void }

/** A wake ribbon (see the module note). */
export function wakeRibbon(row: WakeRibbonRow): WakeRibbon {
  const n = row.samples, pos = new Float32Array(n * 2 * 3), fade = new Float32Array(n * 2), sideA = new Float32Array(n * 2), index: number[] = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  for (let i = 0; i < n; i++) { const f = 1 - i / (n - 1); fade[i * 2] = f; fade[i * 2 + 1] = f; sideA[i * 2] = 1; sideA[i * 2 + 1] = -1; }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('aFade', new BufferAttribute(fade, 1)); g.setAttribute('aSide', new BufferAttribute(sideA, 1)); g.setIndex(index);
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
    vertexShader: 'attribute float aFade; attribute float aSide; varying float vFade; varying float vSide; void main(){ vFade = aFade; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying float vFade; varying float vSide; void main(){ float a = vFade * vFade * (1.0 - vSide * vSide * 0.85) * 0.9; gl_FragColor = vec4(vec3(${row.color.join(', ')}) * a, a); }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.name = row.name;
  const trail: Vector3[] = Array.from({ length: n }, () => new Vector3()), side = new Vector3(), dir = new Vector3(), toCam = new Vector3();
  let clock = 0, seeded = false;
  return { mesh, update: (at, alive, camera, dt) => {
    mesh.visible = alive; if (!alive) { seeded = false; return; }
    if (!seeded) { for (const p of trail) p.copy(at); seeded = true; }
    clock += dt;
    if (clock >= row.every) { clock = 0; for (let i = n - 1; i > 0; i--) trail[i]?.copy(trail[i - 1] ?? at); }
    trail[0]?.copy(at);
    for (let i = 0; i < n; i++) {
      const p = trail[i] ?? at, q = trail[Math.min(n - 1, i + 1)] ?? p;
      dir.subVectors(p, q); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      toCam.subVectors(camera, p);
      side.crossVectors(dir, toCam).normalize().multiplyScalar(row.width * (1 - i / (n - 1)) * 0.5 + 0.05);
      pos.set([p.x + side.x, p.y + side.y, p.z + side.z], i * 6); pos.set([p.x - side.x, p.y - side.y, p.z - side.z], i * 6 + 3);
    }
    const attr = g.getAttribute('position'); attr.needsUpdate = true;
  } };
}
