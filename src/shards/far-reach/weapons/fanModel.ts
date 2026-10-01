import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, type BufferGeometry } from 'three';
import { box, Facets, type V3 } from '../world/facets';

/** The war fan: twelve dark ribs and a teal leaf, opened in a half circle, plus the gust ring it throws. */
export function buildFan(): { model: Group; leaf: Group; gust: Mesh; parts: BufferGeometry[] } {
  const ribs = new Facets(0.04), leaf = new Facets(0.1), n = 12, r1 = 0.42, at = { applyTo: (p: [number, number, number]): V3 => p };
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI, c = Math.cos(a), s = Math.sin(a);
    const m = { applyTo: ([x, y, z]: [number, number, number]): V3 => [x * c - y * s, x * s + y * c, z] };
    box(ribs, m, [0, (r1 + 0.04) / 2, 0.004], 0.0045, (r1 + 0.04) / 2, 0.004, [0.12, 0.09, 0.07]);
    if (i === n) continue;
    const a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI, c1 = Math.cos(a1), s1 = Math.sin(a1), tone = i % 2 ? 1 : 0.86;
    const col = [0.07 * tone, 0.45 * tone, 0.5 * tone] as const;
    const p = (r: number, cc: number, ss: number): V3 => [-ss * r, cc * r, 0];
    leaf.quad(p(0.15, c, s), p(r1, c, s), p(r1, c1, s1), p(0.15, c1, s1), col);
  }
  box(ribs, at, [0, -0.07, 0.004], 0.025, 0.09, 0.02, [0.22, 0.14, 0.08]);
  const ribMesh = new Mesh(ribs.geometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }));
  const leafMesh = new Mesh(leaf.geometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide, roughness: 0.75, emissive: 0x0a3a40, emissiveIntensity: 0.25 }));
  const fan = new Group(); fan.add(leafMesh, ribMesh);
  const model = new Group(); model.add(fan);
  fan.position.set(0.24, -0.33, -0.6); fan.rotation.set(-0.45, -0.55, -0.75);
  const ringGeometry = new RingGeometry(0.55, 0.8, 24);
  const gust = new Mesh(ringGeometry, new MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  gust.position.set(0, -0.05, -1.4); gust.visible = false; model.add(gust);
  return { model, leaf: fan, gust, parts: [ribMesh.geometry, leafMesh.geometry, ringGeometry] };
}
