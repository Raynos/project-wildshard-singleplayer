import { InstancedMesh, Mesh, MeshStandardMaterial, Scene, type BufferGeometry } from 'three';
import { bake, BakedPiece, WholeShape, type BakedScene } from '@wildshard/sdk/bake';
import { driftwoodFixedSource } from './fixedSource';
import { bridgeUnitGeometries } from './ropeBridge';

/** Original static world draws and own-space equipment/cover templates; each source draw is assembled exactly once. */
export function driftwoodScene(project: string, head: BufferGeometry): { baked: BakedScene; fixed: ReturnType<typeof driftwoodFixedSource> } {
  const fixed = driftwoodFixedSource(), scene = new Scene(); scene.name = 'driftwood-isle';
  fixed.geometries.set('wendell-head', head);
  // Append after the head so every existing template retains its native identity.
  for (const [id, geometry] of Object.entries(bridgeUnitGeometries())) fixed.geometries.set(id, geometry);
  const material = new MeshStandardMaterial({ vertexColors: true });
  let library = 0;
  for (const [id, geometry] of fixed.geometries) {
    const pose = fixed.world.get(id);
    if (pose !== undefined) {
      const mesh = new Mesh(geometry, material); mesh.name = id; mesh.matrixAutoUpdate = false; mesh.matrix.copy(pose);
      scene.add(new WholeShape(id, mesh, { nativeAttributes: true, partition: true }));
    } else {
      const key = `template-${library++}`, mesh = new InstancedMesh(geometry, material, 1);
      const vertexCount = geometry.getAttribute('position').count, indexCount = geometry.getIndex()?.count ?? 0;
      const metadata = { id, vertices: Array.from({ length: vertexCount }, (_, i) => i),
        triangles: Array.from({ length: (indexCount || vertexCount) / 3 }, (_, i) => i), vertexCount, indexCount,
        index: geometry.getIndex() === null ? 'none' : geometry.getIndex()?.array instanceof Uint16Array ? 'u16' : 'u32' };
      scene.add(new BakedPiece(key, [[key, mesh]], [], { nativeAttributes: true, compactIndex: true, nodeExtras: () => ({ wholePartition: metadata }) }));
    }
  }
  const baked = bake(scene, { slug: 'driftwood-isle', name: 'Driftwood Isle' }, { project });
  material.dispose();
  return { baked, fixed };
}
