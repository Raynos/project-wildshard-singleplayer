import { DUNE_STRIDER } from '../runtime/species/strider';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, type BufferGeometry } from 'three';
import { bindRigid, duneMesh, fit } from '../world/meshes';
import { placed, skinParts } from './skin';

const HIDE: [number, number, number] = [0.26, 0.13, 0.08], DARK: [number, number, number] = [0.12, 0.06, 0.04], HORN: [number, number, number] = [0.42, 0.34, 0.24];
const LEGS: readonly [string, number, number][] = [['legFL', -0.42, 0.75], ['legFR', 0.42, 0.75], ['legBL', -0.42, -0.8], ['legBR', 0.42, -0.8]];
/** A tall, slab-bodied grazer on four long legs, a hump, a low neck and a broad horned head. */
export function striderGeometry(): ReturnType<typeof skinParts> {
  const parts = [
    { geometry: placed(new IcosahedronGeometry(0.75, 1), 0, 2.05, 0, [0.85, 0.75, 1.6]), color: HIDE, bone: 0 },
    { geometry: placed(new IcosahedronGeometry(0.45, 0), 0, 2.55, -0.2, [1, 0.8, 1.3]), color: DARK, bone: 0 },
    { geometry: placed(new CylinderGeometry(0.22, 0.32, 1.1, 6), 0, 2.15, 1.35, [1, 1, 1], [1.1, 0, 0]), color: HIDE, bone: 1 },
    { geometry: placed(new BoxGeometry(0.5, 0.42, 0.7), 0, 1.95, 1.95), color: DARK, bone: 1 },
    { geometry: placed(new ConeGeometry(0.09, 0.9, 5), 0.35, 2.3, 1.85, [1, 1, 1], [0.6, 0, -0.9]), color: HORN, bone: 1 },
    { geometry: placed(new ConeGeometry(0.09, 0.9, 5), -0.35, 2.3, 1.85, [1, 1, 1], [0.6, 0, 0.9]), color: HORN, bone: 1 },
    { geometry: placed(new ConeGeometry(0.1, 0.9, 4), 0, 1.9, -1.55, [1, 1, 1], [-2.2, 0, 0]), color: DARK, bone: 6 },
  ];
  LEGS.forEach(([, x, z], i) => {
    parts.push({ geometry: placed(new CylinderGeometry(0.09, 0.13, 1.0, 5), x, 1.35, z), color: HIDE, bone: 2 + i });
    parts.push({ geometry: placed(new CylinderGeometry(0.06, 0.08, 0.95, 5), x, 0.48, z), color: DARK, bone: 2 + i });
  });
  return skinParts(parts);
}
const bones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 2.0, 0] }, { name: 'head', parent: 'body', pos: [0, 2.2, 1.0] },
  ...LEGS.map(([name, x, z]): { name: string; parent: string; pos: [number, number, number] } => ({ name, parent: 'body', pos: [x, 1.85, z] })),
  { name: 'tail', parent: 'body', pos: [0, 2.0, -1.2] },
];
/**
 * The generated strider (C6: Hunyuan3D-2 from `art/sunscar-dunes/round-7-models/ref-strider.jpg`, its head along −X,
 * turned to +Z): 3.6 m nose to tail, hooves at y 0. Facets low under the body ride the leg of their quadrant (each leg
 * bone at its leg's top), the front fifth above the withers is the head and horns, the back tenth the tail.
 */
function striderMesh(source: BufferGeometry): { bones: ReturnType<typeof bones>; geometry: BufferGeometry; h: number } {
  const g = fit(source, { size: 3.6, by: 'span', yaw: Math.PI / 2 }), b = g.boundingBox, p = g.getAttribute('position');
  const h = b ? b.max.y : 2.8, z0 = b ? b.min.z : -1.8, z1 = b ? b.max.z : 1.8, legTop = h * 0.5, head = z1 - (z1 - z0) * 0.2, tail = z0 + (z1 - z0) * 0.1;
  // each leg's top: the mean x / z of its quadrant's low vertices (FL, FR, BL, BR as in LEGS: left is −X)
  const quad = (x: number, z: number): number => (z > 0 ? 0 : 2) + (x < 0 ? 0 : 1), sum = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < p.count; i++) if (p.getY(i) < legTop * 0.8) { const q = sum[quad(p.getX(i), p.getZ(i))]; if (q) { q[0] = (q[0] ?? 0) + p.getX(i); q[1] = (q[1] ?? 0) + p.getZ(i); q[2] = (q[2] ?? 0) + 1; } }
  const top = (q: number): [number, number, number] => {
    const s = sum[q], n = s?.[2] ?? 0, [, x, z] = LEGS[q] ?? ['', 0, 0];
    return n > 0 ? [(s?.[0] ?? 0) / n, legTop, (s?.[1] ?? 0) / n] : [x, legTop, z];
  };
  bindRigid(g, (x, y, z) => y < legTop ? 2 + quad(x, z) : z > head && y > h * 0.55 ? 1 : z < tail ? 6 : 0);
  return { geometry: g, h, bones: [{ name: 'body', parent: null, pos: [0, h * 0.7, 0] }, { name: 'head', parent: 'body', pos: [0, h * 0.75, head] },
    ...LEGS.map(([name], i): { name: string; parent: string; pos: [number, number, number] } => ({ name, parent: 'body', pos: top(i) })),
    { name: 'tail', parent: 'body', pos: [0, h * 0.7, tail] }] };
}
/** The strider's body: the generated model when it loaded, else the code one. */
function striderBody(): { bones: ReturnType<typeof bones>; geometry: BufferGeometry; h: number } {
  const source = duneMesh('dune-strider');
  return source ? striderMesh(source) : { bones: bones(), geometry: striderGeometry(), h: 2.8 };
}
/** The strider as one skinned geometry for the Model Explorer: the generated model when it loaded. */
export const striderSpecimen = (): BufferGeometry => striderBody().geometry;
export const DUNE_STRIDER_LOOK: SpeciesLook = { id: 'sunscar.look.duneStrider', species: DUNE_STRIDER.id, kind: 'duneStrider', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneStrider', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => {
    const body = striderBody();
    return { bones: body.bones, furParts: [], hardParts: [body.geometry], eyeParts: [],
      dims: { bodyY: body.h * 0.7, bodyHalfLen: 1.3, bodyRadius: 0.75, headRadius: 0.4, legLen: body.h * 0.5, feet: [], halfWidth: 0.7 } };
  },
  animate: ({ bones: b, t, alive, deathT, speed, phase, mem }) => {
    const body = b['body'], head = b['head'], tail = b['tail'], paw = mem['paw'] ?? 0, winded = mem['winded'] ?? 0;
    const gait = Math.min(1, Math.abs(speed) / 2) * (speed > 6 ? 0.75 : 0.45), swing = Math.sin(phase * Math.PI * 2);
    LEGS.forEach(([name], i) => {
      const leg = b[name]; if (!leg) return;
      const front = i < 2, side = i % 2 === 0 ? 1 : -1;
      leg.rotation.x = alive ? swing * gait * (front === (i % 2 === 0) ? 1 : -1) : -0.3;
      if (front && side > 0 && paw > 0) leg.rotation.x = -0.9 + Math.abs(Math.sin(t * 9)) * 0.9; // the paw: lift and stamp
      leg.rotation.z = alive ? 0 : side * 0.9 * Math.min(1, Math.max(0, deathT));
    });
    if (body) {
      const base = mem['bodyY'] ?? body.position.y; mem['bodyY'] = base;
      body.position.y = base - (alive ? winded * 0.25 : 1.2 * Math.min(1, Math.max(0, deathT)));
      body.rotation.z = alive ? 0 : 0.25 * Math.min(1, Math.max(0, deathT));
    }
    if (head) head.rotation.x = alive ? (paw > 0 ? 0.35 : 0) + winded * 0.5 + Math.sin(t * 1.3) * 0.05 : 0.7;
    if (tail) tail.rotation.y = alive ? Math.sin(t * 2.1) * 0.3 : 0;
  },
};
