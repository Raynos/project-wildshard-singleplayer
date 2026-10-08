import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fakeWorld } from './fake/world';
import { addModelInstances, awaitNalatiModelLoads, loadModelRaw, loadNalatiModel, setModelShade } from '../src/shards/nalati-grasslands/world/glbPaint';

async function decoded(): Promise<GLTF> {
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify({ asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }), '');
  gltf.scene.add(new Mesh(new BoxGeometry(), new MeshLambertMaterial())); return gltf;
}

describe('Nalati owned model settlement', () => {
  it('starts no loads and awaits raw, nested producer and root-addition callbacks without a timer', async () => {
    setModelShade(false);
    const { sky } = fakeWorld(), root = new Group();
    const producer = vi.spyOn(GLTFLoader.prototype, 'loadAsync');
    await awaitNalatiModelLoads(sky); expect(producer).not.toHaveBeenCalled();
    const model = await decoded(), completions = new Map<string, (value: GLTF) => void>();
    producer.mockImplementation(url => new Promise(resolve => { completions.set(url, resolve); }));
    const first = loadModelRaw('boulder-1').then(() => addModelInstances(root, sky, 'chest', [{ x: 4, y: 0, z: -2 }]));
    let settled = false;
    const capture = awaitNalatiModelLoads(sky).then(() => { settled = true; return settled; });
    await Promise.resolve(); expect(settled).toBe(false);
    const boulder = [...completions].find(([url]) => url.includes('boulder-1'));
    if (boulder === undefined) throw new Error('Missing raw model request');
    boulder[1](model);
    // Follow the actual producer promise, rather than waiting a guessed number of microtasks.
    await loadModelRaw('boulder-1');
    const chest = [...completions].find(([url]) => url.includes('chest'));
    if (chest === undefined) throw new Error('Missing nested model request');
    expect(settled).toBe(false); expect(root.children).toHaveLength(0);
    chest[1](model); await capture; await first;
    expect(settled).toBe(true); expect(root.children).toHaveLength(1);
    expect(root.children[0]?.name).toBe('nalati-model-chest');
    expect(producer).toHaveBeenCalledTimes(2);
    await awaitNalatiModelLoads(sky); expect(producer).toHaveBeenCalledTimes(2);
  });

  it('rebuilds generated geometry and painted material after each regional retirement', async () => {
    setModelShade(false);
    const { sky } = fakeWorld(), producer = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(decoded);
    let previous: unknown;
    for (let entry = 0; entry < 3; entry++) {
      const model = await loadNalatiModel(sky, 'cauldron');
      expect(model.geometry).not.toBe(previous); previous = model.geometry;
      expect(await loadNalatiModel(sky, 'cauldron')).toBe(model);
      model.material.dispose(); model.geometry.dispose();
      expect(producer).toHaveBeenCalledTimes(entry + 1);
    }
  });

  it('refuses capture when a requested asset fails even if its presentation catches the failure', async () => {
    const { sky } = fakeWorld(), root = new Group();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('Missing authored saddle'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const presentation = addModelInstances(root, sky, 'saddle', [{ x: 0, y: 0, z: 0 }]);
    await expect(awaitNalatiModelLoads(sky)).rejects.toThrow('Missing authored saddle');
    await expect(presentation).resolves.toBeNull(); expect(root.children).toHaveLength(0);
    expect(warning).toHaveBeenCalledOnce();
  });
});
