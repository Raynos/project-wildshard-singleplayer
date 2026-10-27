import { InstancedMesh, Mesh, MeshStandardMaterial, Scene, type BufferGeometry } from 'three';
import { bakeOwned, publishScene, BakedPiece, WholeShape, type BakedScene } from '@wildshard/sdk/bake';
import { completeEmptyL1Tiles } from '@wildshard/sdk/bake/tileGrid';
import { compactWholeChannels, compactWholeNormals, gridPositions, wholeGrid } from '@wildshard/sdk/bake/props';
import { meshoptTileBytes } from '@wildshard/sdk/bake/tileEncoder';
import { driftwoodFixedSource } from './fixedSource';
import { bridgeUnitGeometries } from './ropeBridge';
import { originalBridgeDecks } from './driftwoodBridge.mjs';

/** Shapes that keep exact float positions (iPhone downloads I3): the cover and held / effect looks read object-space
 *  position (`positionLocal` / `positionGeometry`, data/lookGraphs.json), which a grid node would change. */
const EXACT_SHAPES = /^(cover-|gull$|iron-sword-|castaway-smoke$|shrine-fireflies$|waterfall-|npc-castaway-flames$)/u;

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
  let library = 0; const copies: BufferGeometry[] = [];
  for (const [id, geometry] of fixed.geometries) {
    const pose = fixed.world.get(id);
    if (pose !== undefined) {
      const mesh = new Mesh(geometry, material); mesh.name = id; mesh.matrixAutoUpdate = false; mesh.matrix.copy(pose);
      // I3: world shapes ship compact too (normals / colours Int8 / Uint8, positions on one Int16 grid per shape)
      // I3: a world shape ships compact too: Int8 / Uint8 normals and colours, positions on one Int16 grid per shape
      scene.add(new WholeShape(id, mesh, { nativeAttributes: true, partition: 'runs', ...EXACT_SHAPES.test(id) ? {} : { compact: true as const } }));
    } else {
      // I3: a template ships Int16 positions on one grid in its own space with Int8 normals and Uint8 colours (a copy: the
      // fixed models read the float source); readWholeGeometry dequantizes them, within half a grid step
      const copy = EXACT_SHAPES.test(id) ? undefined : geometry.clone();
      // (a glowing kit's colours leave [0, 1]: its normals compact alone and its colours stay float)
      const grid = copy === undefined || !(compactWholeChannels(copy) || compactWholeNormals(copy)) ? undefined : wholeGrid(geometry), shipped = grid === undefined || copy === undefined ? geometry : copy;
      if (grid === undefined) copy?.dispose(); else { gridPositions(shipped, grid); copies.push(shipped); }
      const key = `template-${library++}`, mesh = new InstancedMesh(shipped, material, 1);
      const vertexCount = geometry.getAttribute('position').count, indexCount = geometry.getIndex()?.count ?? 0;
      const metadata = { id, vertices: Array.from({ length: vertexCount }, (_, i) => i),
        triangles: Array.from({ length: (indexCount || vertexCount) / 3 }, (_, i) => i), vertexCount, indexCount,
        index: geometry.getIndex() === null ? 'none' : geometry.getIndex()?.array instanceof Uint16Array ? 'u16' : 'u32',
        ...(grid === undefined ? {} : { grid: { origin: [...grid.origin], step: grid.step } }) };
      scene.add(new BakedPiece(key, [[key, mesh]], [], { nativeAttributes: true, compactIndex: true, nodeExtras: () => ({ wholePartition: metadata }),
        ...(grid === undefined ? {} : { grid: () => grid }) }));
    }
  }
  const baked = bakeOwned(scene, { slug: 'driftwood-isle', name: 'Driftwood Isle' }, { props: {
    // T8.2: only this named tile saves delivered gzip bytes; keep every other wire identity.
    encodeTileBlob: (name, bytes) => name === 'props.0.2.4' ? meshoptTileBytes(bytes) : bytes,
  } });
  baked.shardfile.tiles = completeEmptyL1Tiles(baked.shardfile.tiles);
  material.dispose(); for (const copy of copies) copy.dispose();
  return { baked, fixed };
}
