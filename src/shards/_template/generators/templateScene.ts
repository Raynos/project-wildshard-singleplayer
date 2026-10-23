import { Scene } from 'three';
import { Scatter, type BakeInputs } from '@wildshard/sdk/bake';
import { templateProps } from './templatePropsSource';

/** The template's props as one three.js scene for `bake(scene, identity)`: the merged static shapes, the crates and lamp posts
 * as scatter; the library panels, lantern and proxies stay build inputs. Same triangles and order as `templateProps`. */
export function templateScene(count = 20): { scene: Scene; props: NonNullable<BakeInputs['props']>; dispose: () => void } {
  const fixture = templateProps(count), { static: shapes, scatter = [], ...props } = fixture.source, scene = new Scene();
  scene.add(shapes);
  scatter.forEach((batch, i) => { scene.add(new Scatter(i === 0 ? 'template.crates' : 'template.posts', batch.model, batch.transforms)); });
  return { scene, props, dispose: fixture.dispose };
}
