import { Matrix4, type BufferGeometry } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import { readWholeGeometry } from '../plugin/geometry';
import type { ShardProduct } from './shardProduct';

type WholeLibrary = Extract<WorldScenesSection['libraries'][number], { kind: 'whole' }>;

/** The models `ids` of a declared whole-geometry library, read from only the shardfile tiles that hold them.
 * `geometry` hands each partition out once as is and any repeat or posed alias as a copy; `done` frees the rest.
 * Client-only presentation. */
export async function readWholeLibrary(owner: Scope, product: ShardProduct, row: WholeLibrary, ids: ReadonlySet<string>, pause?: () => Promise<void>): Promise<{ geometry: (id: string) => BufferGeometry | null; done: () => void }> {
  const models = new Map(row.models.filter(model => ids.has(model.id)).map(model => [model.id, model]));
  const files = [...new Set([...models.values()].flatMap(model => model.files))], taken = new Set<string>();
  for (const file of files) if (!product.shardfile.library.includes(file)) throw new Error(`Missing whole library file: ${file}`);
  const scope = owner.child(`whole/${row.id}`);
  try {
    const views = await readWholeGeometry(scope, product.shardfile, files, pause);
    return { done: () => { scope.dispose(); }, geometry: id => {
      const model = models.get(id), view = model === undefined ? undefined : views.get(model.part);
      if (model === undefined || view === undefined) return null;
      const fresh = view.matrix.equals(new Matrix4()) && model.matrix === undefined && !taken.has(model.part);
      taken.add(model.part);
      if (fresh) view.release?.();
      const geometry = fresh ? view.geometry : view.geometry.clone().applyMatrix4(view.matrix);
      return model.matrix === undefined ? geometry : geometry.applyMatrix4(new Matrix4().fromArray(model.matrix));
    } };
  } catch (error) { scope.dispose(); throw error; }
}
