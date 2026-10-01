import { BufferGeometry, Color, Float32BufferAttribute, Mesh, type MeshStandardMaterial } from 'three';
import type { ColliderDesc, Rng } from '#engine';
import { TOP, type Island } from '../layout';

const GRASS = [new Color(0x6f8a4a), new Color(0x7d9550), new Color(0x637d43)];
const LIP = new Color(0x4f5a34), ROCK_HI = new Color(0x6a4a52), ROCK_LO = new Color(0x3d2b36);
const SIDES = 16;

/** One flat-shaded island: a grass top, a short lip and a jagged rock cone below it, all faceted vertex colour. */
export function islandMesh(island: Island, random: Rng, material: MeshStandardMaterial): Mesh {
  const rim: [number, number][] = [];
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2, r = island.r * random.range(0.95, 1);
    rim.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const rings: { y: number; s: number; c: Color }[] = [
    { y: -1.2, s: 1.0, c: LIP }, { y: -island.depth * 0.3, s: 0.78, c: ROCK_HI },
    { y: -island.depth * 0.65, s: 0.45, c: ROCK_LO },
  ];
  const pos: number[] = [], col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], color: Color): void => {
    pos.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
  };
  const at = (i: number, ring: number): number[] => {
    const p = rim[i % SIDES] ?? [0, 0];
    if (ring < 0) return [p[0], 0, p[1]];
    const r = rings[ring]; if (r === undefined) return [0, -island.depth, 0];
    const wobble = 1 + Math.sin(i * 2.7 + ring) * 0.06;
    return [p[0] * r.s * wobble, r.y, p[1] * r.s * wobble];
  };
  for (let i = 0; i < SIDES; i++) {
    tri([0, 0, 0], at(i, -1), at(i + 1, -1), GRASS[i % GRASS.length] ?? LIP);
    for (let ring = -1; ring < rings.length - 1; ring++) {
      const color = (rings[ring + 1] ?? rings[0])?.c ?? LIP;
      tri(at(i, ring), at(i, ring + 1), at(i + 1, ring + 1), color); tri(at(i, ring), at(i + 1, ring + 1), at(i + 1, ring), color);
    }
    const tip = [Math.sin(i) * 0.6, -island.depth, Math.cos(i) * 0.6];
    tri(at(i, rings.length - 1), tip, at(i + 1, rings.length - 1), ROCK_LO);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3)); geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material); mesh.position.set(island.x, TOP, island.z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** The walkable top: a convex hull of the rim (the collider is never bigger than the drawn grass). */
export function islandCollider(island: Island): ColliderDesc {
  const points: number[] = [];
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2, r = island.r * 0.95;
    points.push(Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r * 0.8, -3, Math.cos(a) * r * 0.8);
  }
  return { kind: 'hull', x: island.x, y: TOP, z: island.z, points: new Float32Array(points), surface: 'grass' };
}
