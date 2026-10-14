import { expect, test } from 'vitest';
import { MeshStandardMaterial, Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { SkyRig } from '../src/engine/world/skyRig';

test('sky setup preserves graph-owned maps while classic materials retain their filler slots', () => {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing sky rig');
  Reflect.set(sky, 'materials', new WeakSet());
  Reflect.set(sky, 'csm', { setupMaterial: (): void => undefined });
  Reflect.set(sky, 'shadowFade', null);
  const graph = new MeshStandardNodeMaterial(), classic = new MeshStandardMaterial(), lent = new Texture();
  graph.roughnessMap = lent;
  try {
    sky.setupMaterial(graph); sky.setupMaterial(classic);
    expect(graph.map).toBeNull(); expect(graph.normalMap).toBeNull();
    expect(graph.roughnessMap).toBe(lent); expect(graph.aoMap).toBeNull();
    expect(classic.map).toBeInstanceOf(Texture); expect(classic.normalMap).toBeInstanceOf(Texture);
    expect(classic.roughnessMap).toBeInstanceOf(Texture); expect(classic.aoMap).toBeInstanceOf(Texture);
  } finally { graph.dispose(); classic.dispose(); lent.dispose(); }
});
