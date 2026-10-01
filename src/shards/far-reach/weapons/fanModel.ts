import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, BoxGeometry } from 'three';

const RIBS = 7, SPREAD = 1.9, LENGTH = 0.3;

/** The war fan in camera space: dark lacquer ribs and a deep-blue cloth leaf, small in the lower right of a portrait frame. */
export function buildFan(): Group {
  const fan = new Group(), leaf = new Group();
  const rib = new MeshStandardMaterial({ color: 0x1d1a20, flatShading: true, roughness: 0.5 });
  const cloth = new MeshStandardMaterial({ color: 0x1f5f86, flatShading: true, roughness: 0.8, side: DoubleSide });
  const pos: number[] = [];
  for (let i = 0; i < RIBS; i++) {
    const a = -SPREAD / 2 + (i / (RIBS - 1)) * SPREAD;
    const bar = new Mesh(new BoxGeometry(0.012, LENGTH, 0.008), rib); bar.position.set(Math.sin(a) * LENGTH / 2, Math.cos(a) * LENGTH / 2, 0); bar.rotation.z = -a; leaf.add(bar);
    if (i === RIBS - 1) continue;
    const b = a + SPREAD / (RIBS - 1), r0 = LENGTH * 0.35, r1 = LENGTH * 0.97;
    pos.push(Math.sin(a) * r0, Math.cos(a) * r0, 0, Math.sin(a) * r1, Math.cos(a) * r1, 0, Math.sin(b) * r1, Math.cos(b) * r1, 0,
      Math.sin(a) * r0, Math.cos(a) * r0, 0, Math.sin(b) * r1, Math.cos(b) * r1, 0, Math.sin(b) * r0, Math.cos(b) * r0, 0);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(pos, 3)); geometry.computeVertexNormals();
  leaf.add(new Mesh(geometry, cloth));
  const grip = new Mesh(new BoxGeometry(0.03, 0.12, 0.03), rib); grip.position.y = -0.05; leaf.add(grip);
  leaf.rotation.set(-0.5, 0.35, -0.55);
  fan.add(leaf); fan.position.set(0.24, -0.27, -0.5);
  return fan;
}
