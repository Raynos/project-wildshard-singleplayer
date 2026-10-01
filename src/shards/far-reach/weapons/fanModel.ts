import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';

/** The war fan: seven navy silk panels between iron ribs, opened in a half circle, on a short grip. */
export function fanModel(): Group {
  const group = new Group(), silk = new MeshStandardMaterial({ color: 0x2b3f78, flatShading: true, roughness: 0.8, side: 2 });
  const iron = new MeshStandardMaterial({ color: 0x2a2530, flatShading: true, roughness: 0.5, metalness: 0.4 });
  const ribs = 8, reach = 0.42, from = -Math.PI * 0.45, to = Math.PI * 0.45, pos: number[] = [];
  for (let i = 0; i < ribs - 1; i++) {
    const a = from + ((to - from) * i) / (ribs - 1), b = from + ((to - from) * (i + 1)) / (ribs - 1);
    pos.push(0, 0.06, 0, Math.sin(a) * reach, Math.cos(a) * reach, 0, Math.sin(b) * reach, Math.cos(b) * reach, 0);
  }
  const panels = new BufferGeometry(); panels.setAttribute('position', new Float32BufferAttribute(pos, 3)); panels.computeVertexNormals();
  group.add(new Mesh(panels, silk));
  for (let i = 0; i < ribs; i++) {
    const a = from + ((to - from) * i) / (ribs - 1), rib = new Mesh(new BoxGeometry(0.014, reach, 0.014), iron);
    rib.position.set(Math.sin(a) * reach / 2, Math.cos(a) * reach / 2, 0.004); rib.rotation.z = -a; group.add(rib);
  }
  const grip = new Mesh(new BoxGeometry(0.035, 0.16, 0.035), iron); grip.position.y = -0.05; group.add(grip);
  return group;
}
