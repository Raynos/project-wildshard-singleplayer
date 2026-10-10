import { clipAnimate } from '@wildshard/sdk/species/clips';
import { DUNE_STRIDER, STRIDER_CLIPS } from '../data/species/strider';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type { BufferGeometry } from 'three';
import { bindRigid, fitGeometry, undrawnRig } from '@wildshard/sdk/looks/modelLibrary';
import { duneMesh } from '../world/meshes';

const LEGS: readonly [string, number, number][] = [['legFL', -0.42, 0.75], ['legFR', 0.42, 0.75], ['legBL', -0.42, -0.8], ['legBR', 0.42, -0.8]];
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
  const g = fitGeometry(source, { size: 3.6, by: 'span', yaw: Math.PI / 2 }), b = g.boundingBox, p = g.getAttribute('position');
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
/** The strider's body: the generated model; one that did not load stands undrawn (its load was faulted, SF72). */
function striderBody(): { bones: ReturnType<typeof bones>; geometry: BufferGeometry; h: number } {
  const source = duneMesh('dune-strider');
  return source ? striderMesh(source) : { bones: bones(), geometry: undrawnRig(), h: 2.8 };
}
/** The strider as one skinned geometry for the Model Explorer. */
export const striderSpecimen = (): BufferGeometry => striderBody().geometry;
export const DUNE_STRIDER_LOOK: SpeciesLook = { id: 'sunscar.look.duneStrider', species: DUNE_STRIDER.id, kind: 'duneStrider', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneStrider', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => {
    const body = striderBody();
    return { bones: body.bones, furParts: [], hardParts: [body.geometry], eyeParts: [],
      dims: { bodyY: body.h * 0.7, bodyHalfLen: 1.3, bodyRadius: 0.75, headRadius: 0.4, legLen: body.h * 0.5, feet: [], halfWidth: 0.7 } };
  },
  animate: clipAnimate(STRIDER_CLIPS),
};
