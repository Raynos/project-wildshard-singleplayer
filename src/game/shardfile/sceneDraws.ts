import { BufferGeometry, Float32BufferAttribute, Mesh, Points, type Group, type Material } from 'three';
import * as v from 'valibot';
import { SceneDrawsSchema } from '@wildshard/format/sceneDraws';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardProduct } from './shardProduct';
import { sceneModelSource } from './sceneSources';

const books = new WeakMap<Scope, WeakMap<ShardProduct, Map<string, BufferGeometry>>>();

/** Client-only draw construction shared by specimen and resident emitters.
 * The lifetime and already-compiled material book belong to the caller. */
export function drawSceneRows(product: ShardProduct, input: unknown, parent: Group, scope: Scope, materials: ReadonlyMap<string, Material>): void {
  const rows = v.parse(SceneDrawsSchema, input);
  let products = books.get(scope); if (products === undefined) { products = new WeakMap(); books.set(scope, products); }
  let geometries = products.get(product); if (geometries === undefined) { geometries = new Map(); products.set(product, geometries); }
  if (scope.disposed) throw new Error('Scene draw scope is disposed');
  for (const row of rows) {
    const material = materials.get(row.material); if (material === undefined) throw new Error('Missing scene draw material');
    if (row.kind === 'points') {
      const index = new Float32Array(row.count), seed = new Float32Array(row.count);
      for (let i = 0; i < row.count; i++) { index[i] = i; seed[i] = (i * 0.618034) % 1; }
      const geometry = scope.own(new BufferGeometry());
      geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(row.count * 3), 3));
      geometry.setAttribute('aIndex', new Float32BufferAttribute(index, 1)); geometry.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
      const points = new Points(geometry, material); points.name = row.name; points.frustumCulled = false;
      points.scale.setScalar(row.scale); points.position.y = row.y; parent.add(points); scope.onDispose(() => { points.removeFromParent(); });
    } else {
      const key = JSON.stringify([row.geometry.library, row.geometry.model]); let geometry = geometries.get(key);
      if (geometry === undefined) { const source = sceneModelSource(product, row.geometry.library).geometry(row.geometry.model);
        if (source === null) throw new Error('Missing scene draw geometry'); geometry = scope.own(source); geometries.set(key, geometry); }
      const mesh = new Mesh(geometry, material); mesh.frustumCulled = false;
      if (row.kind === 'card') { mesh.name = row.name; mesh.renderOrder = row.order; mesh.position.set(...row.at);
        if (typeof row.scale === 'number') mesh.scale.setScalar(row.scale); else mesh.scale.set(...row.scale); }
      parent.add(mesh); scope.onDispose(() => { mesh.removeFromParent(); });
    }
  }
}
