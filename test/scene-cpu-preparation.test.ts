import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner, currentOwner } from '../src/engine/app/ownership';
import { registerScenePreparation, prepareSceneResources } from '../src/engine/render/scenePreparation';
import { Grass } from '../src/engine/world/Grass';
import { configureLevel } from '../src/engine/level/selection';
import { toLevelSpec } from '../src/game/shard/spec';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import type { SkyRig } from '../src/engine/world/skyRig';
import type { Forest } from '../src/engine/world/forest/Forest';
import { legacyDouble } from './fake/FakeGame';

const noop = (): unknown => new Proxy(() => undefined, { get: () => noop(), apply: () => noop() });
class Canvas { width = 0; height = 0; getContext(): unknown { return noop(); } }
const sky = legacyDouble<SkyRig>({ sunDir: new THREE.Vector3(0, 1, 0), sunColor: new THREE.Color(1, 1, 1), setupMaterial: () => undefined });
const forest = legacyDouble<Forest>({ nearby: () => [], canopyMap: new THREE.DataTexture(new Float32Array(1), 1, 1) });
const sameGrass = (a: Grass, b: Grass): boolean => [a.mesh, a.flowers].every((mesh, index) => {
  const other = [b.mesh, b.flowers][index]; if (other === undefined) return false;
  return [mesh.instanceMatrix, mesh.instanceColor].every((attribute, slot) => {
    const expected = [other.instanceMatrix, other.instanceColor][slot];
    if (attribute === null || expected === null || expected === undefined) throw new Error('Missing grass attribute');
    return attribute.array.length === expected.array.length && attribute.array.every((value, i) => Object.is(value, expected.array[i]));
  });
});

describe('resident render-only CPU preparation', () => {
  it('uses the root local camera and owner once even for overlapping roots', async () => {
    const owner = new Scope('cpu.prepare'), root = new THREE.Group(), child = new THREE.Group(); root.position.x = 555; root.add(child);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(580, 2, -210);
    const prepare = vi.fn((eye: THREE.Vector3) => { expect(eye.toArray()).toEqual([25, 2, -210]); expect(currentOwner()).toBe(owner); return Promise.resolve(); });
    registerScenePreparation(child, owner, prepare);
    await prepareSceneResources([root, child], camera, () => true);
    expect(prepare).toHaveBeenCalledOnce(); expect(root.children).toEqual([child]); expect(root.visible).toBe(true);
    owner.dispose(); await prepareSceneResources([root], camera, () => true); expect(prepare).toHaveBeenCalledOnce();
  });

  it('rejects retirement during an async preparation', async () => {
    const owner = new Scope('cpu.cancel'), root = new THREE.Group();
    registerScenePreparation(root, owner, () => { owner.dispose(); return Promise.resolve(); });
    await expect(prepareSceneResources([root], new THREE.PerspectiveCamera(), () => true)).rejects.toThrow('left its owner');
  });

  it('fills exactly the old first-frame grass and flowers before exposure, with yielded work and no next-frame refill', async () => {
    const owner = new Scope('cpu.grass');
    configureLevel(toLevelSpec(PINE_HOLLOW));
    vi.stubGlobal('document', { createElement: () => new Canvas() });
    const clock = vi.spyOn(performance, 'now'); let now = 0;
    try {
      const reference = withOwner(owner, () => new Grass(sky, forest).build()), prepared = withOwner(owner, () => new Grass(sky, forest).build());
      const root = new THREE.Group(); root.position.x = 555; root.add(prepared.group);
      const camera = new THREE.PerspectiveCamera(); camera.position.set(585, 2, 20);
      reference.update(0, new THREE.Vector3(30, 2, 20));
      expect(sameGrass(prepared, reference)).toBe(false);
      clock.mockImplementation(() => { now += 4; return now; });
      let yielded = false; owner.timeout(0, () => { yielded = true; });
      await prepareSceneResources([root], camera, () => !owner.disposed);
      expect(yielded).toBe(true); expect(sameGrass(prepared, reference)).toBe(true);
      const matrixVersion = prepared.mesh.instanceMatrix.version;
      prepared.update(0, new THREE.Vector3(30, 2, 20));
      expect(prepared.mesh.instanceMatrix.version).toBe(matrixVersion);
      expect(sameGrass(prepared, reference)).toBe(true);
    } finally { clock.mockRestore(); owner.dispose(); vi.unstubAllGlobals(); }
  });
});
