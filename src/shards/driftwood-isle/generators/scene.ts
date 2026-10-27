import { InstancedMesh, Mesh, MeshStandardMaterial, Scene, type BufferGeometry } from 'three';
import { bakeOwned, publishScene, BakedPiece, WholeShape, type BakedScene } from '@wildshard/sdk/bake';
import { completeEmptyL1Tiles } from '@wildshard/sdk/bake/tileGrid';
import { driftwoodFixedSource } from './fixedSource';
import { bridgeUnitGeometries } from './ropeBridge';
import { originalBridgeDecks } from './driftwoodBridge.mjs';

/** Original static world draws and own-space equipment/cover templates; each source draw is assembled exactly once. */
export function driftwoodScene(project: string, head: BufferGeometry, aoBytes: Uint8Array): { baked: BakedScene; fixed: ReturnType<typeof driftwoodFixedSource> } {
  const result = driftwoodOwnedScene(head, aoBytes);
  const published = publishScene(result.baked.scene, project, 'driftwood-isle');
  result.baked.sceneHash = published.hash; result.baked.scenePath = published.path;
  return result;
}

/** Compile original world and template rows into owned bytes; publication belongs to the caller. */
export function driftwoodOwnedScene(head: BufferGeometry, aoBytes: Uint8Array): { baked: BakedScene; fixed: ReturnType<typeof driftwoodFixedSource> } {
  const fixed = driftwoodFixedSource(aoBytes), scene = new Scene(); scene.name = 'driftwood-isle';
  fixed.geometries.set('wendell-head', head);
  // Append after the head so every existing template retains its native identity.
  for (const [id, geometry] of Object.entries(bridgeUnitGeometries())) fixed.geometries.set(id, geometry);
  const decks = originalBridgeDecks(); fixed.geometries.set('bridge-deck', decks.world); fixed.geometries.set('bridge-specimen-deck', decks.specimen);
  const material = new MeshStandardMaterial({ vertexColors: true });
  let library = 0;
  for (const [id, geometry] of fixed.geometries) {
    const pose = fixed.world.get(id);
    if (pose !== undefined) {
      const mesh = new Mesh(geometry, material); mesh.name = id; mesh.matrixAutoUpdate = false; mesh.matrix.copy(pose);
      scene.add(new WholeShape(id, mesh, { nativeAttributes: true, partition: 'runs' }));
    } else {
      const key = `template-${library++}`, mesh = new InstancedMesh(geometry, material, 1);
      const vertexCount = geometry.getAttribute('position').count, indexCount = geometry.getIndex()?.count ?? 0;
      const metadata = { id, vertices: Array.from({ length: vertexCount }, (_, i) => i),
        triangles: Array.from({ length: (indexCount || vertexCount) / 3 }, (_, i) => i), vertexCount, indexCount,
        index: geometry.getIndex() === null ? 'none' : geometry.getIndex()?.array instanceof Uint16Array ? 'u16' : 'u32' };
      scene.add(new BakedPiece(key, [[key, mesh]], [], { nativeAttributes: true, compactIndex: true, nodeExtras: () => ({ wholePartition: metadata }) }));
    }
  }
  const baked = bakeOwned(scene, { slug: 'driftwood-isle', name: 'Driftwood Isle' });
  baked.shardfile.tiles = completeEmptyL1Tiles(baked.shardfile.tiles);
  material.dispose();
  return { baked, fixed };
}
