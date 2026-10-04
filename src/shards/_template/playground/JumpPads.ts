import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
/** The same three practice pads for the live course and the trusted bake; SF16 supplies an in-cell origin. */
export function jumpCoursePads(baseHeight: number, x = 0): Group {
  const root = new Group();
  for (let i = 0; i < 3; i++) { const pad = new Mesh(new BoxGeometry(3, 0.3, 3), new MeshStandardMaterial({ color: 0x888888, flatShading: true })); pad.position.set(x, baseHeight + i * 0.3, -i * 4); root.add(pad); }
  return root;
}
