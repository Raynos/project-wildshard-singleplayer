// SF57 leak5 (E435): the shadow warm-up's disposer (held by the entered frame's owner until it leaves) holds only its
// temporary depth materials, never the stand-ins of the casters it compiled (and so their geometry).
// oxlint-disable-next-line import/no-nodejs-modules -- the collection witness needs V8's own collector
import { setFlagsFromString } from 'node:v8';
// oxlint-disable-next-line import/no-nodejs-modules -- the collection witness needs V8's own collector
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { shadowJobs } from '../../src/engine/render/precompile';

setFlagsFromString('--expose_gc');
const collect: unknown = runInNewContext('gc');
const gc = (): void => { if (typeof collect === 'function') Reflect.apply(collect, undefined, []); };
const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

it('a shadow job disposer does not keep the compiled casters alive', async () => {
  const made = ((): { dispose: () => void; geometry: WeakRef<BoxGeometry> } => {
    const scene = new Scene(), geometry = new BoxGeometry(), caster = new Mesh(geometry, new MeshStandardMaterial());
    caster.castShadow = true; scene.add(caster);
    const dispose = shadowJobs(scene, null)[0]?.dispose;
    if (dispose === undefined) throw new Error('the first shadow job carries the disposer');
    return { dispose, geometry: new WeakRef(geometry) };
  })();
  let alive = true;
  for (let i = 0; i < 20 && alive; i++) { await tick(); gc(); await tick(); alive = made.geometry.deref() !== undefined; }
  expect(alive).toBe(false); // the scene is gone and only the disposer is held: its caster's geometry is collected
  made.dispose();
});
