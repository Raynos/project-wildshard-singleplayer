import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NpcModels, NPC_KINDS } from '../../../src/shards/pine-hollow/quest/npcModels';
import { makeNpcFigure } from '../../../src/shards/pine-hollow/models/people';
import { installPineQuest, type PineQuestHost } from '../../../src/shards/pine-hollow/quest/index';
import { fakeWorld } from '../../fake/world';

function person(): GLTF {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(0.4, 1.8, 0.3).translate(0, 0.9, 0), new MeshStandardMaterial()));
  return { scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' }, parser: {} as GLTF['parser'], userData: {} };
}

async function outcome(promise: Promise<unknown>): Promise<unknown> {
  try { return await promise; } catch (error: unknown) { return error; }
}

// each test builds its own people with its own file loader (no module reset, no loader spy, E422)
describe('Pine people boot barrier (E357 R9)', { timeout: 30_000 }, () => {
  it('waits for every person, then creates a generated figure before its first update', async () => {
    const pending: ((value: GLTF) => void)[] = [];
    let requested: () => void = () => undefined;
    const requests = new Promise<void>((resolve) => { requested = resolve; });
    const models = new NpcModels(() => new Promise<GLTF>((resolve) => {
      pending.push(resolve); if (pending.length === 3) requested();
    }));
    let ready = false;
    const done = (async () => { await models.preload(); ready = true; })();
    try {
      await requests; expect(pending).toHaveLength(3);
      const last = pending.at(-1); if (last === undefined) throw new Error('No NPC requests');
      for (const resolve of pending.slice(0, -1)) resolve(person());
      await Promise.all(NPC_KINDS.slice(0, -1).map((kind) => models.load(kind)));
      expect(ready).toBe(false);
      last(person()); await done;
      const fig = makeNpcFigure('miller', fakeWorld().sky, { x: 0, y: 0, z: 0 }, 0, models);
      expect(fig.group.children.some((child) => child instanceof SkinnedMesh)).toBe(true);
    } finally {
      for (const resolve of pending) resolve(person()); await done;
    }

  });

  it.each(['map', 'geometry'] as const)('reloads a retired NPC %s instead of reusing disposed regional resources', async retired => {
    const load = vi.fn(() => {
      const gltf = person();
      gltf.scene.traverse(object => {
        if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) object.material.map = new Texture();
      });
      return Promise.resolve(gltf);
    });
    const models = new NpcModels(load), sky = fakeWorld().sky;
    let previous: Texture | null = null;
    for (let entry = 0; entry < 3; entry++) {
      const source = await models.load('miller');
      if (source?.map === null || source === null) throw new Error('Missing NPC source map');
      const rig = models.rig('miller', sky);
      if (rig === null || !(rig.mesh.material instanceof MeshStandardMaterial)) throw new Error('Missing NPC rig');
      expect(rig.mesh.material.map).toBe(source.map);
      expect(source.map).not.toBe(previous);
      previous = source.map;
      if (retired === 'map') source.map.dispose(); else rig.mesh.geometry.dispose();
      rig.mesh.material.dispose();
      expect(models.rig('miller', sky)).toBeNull();
      expect(load).toHaveBeenCalledTimes(entry + 1);
    }
  });

  it('waits at quest installation and proceeds with a stand-in only after NPC loading fails', async () => {
    const pending: ((reason: Error) => void)[] = [];
    let requested: () => void = () => undefined;
    const requests = new Promise<void>((resolve) => { requested = resolve; });
    const models = new NpcModels(() => new Promise<GLTF>((_resolve, reject) => {
      pending.push(reject); if (pending.length === 3) requested();
    }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reached = new Error('Quest UI reached');
    const loadQuest = vi.fn(() => Promise.reject(reached));
    const scope = { disposed: false };
    const done = outcome(installPineQuest({ ctx: { scope } } as PineQuestHost, { preload: () => models.preload(), loadQuest }));
    try {
      await requests; expect(pending).toHaveLength(3); expect(loadQuest).not.toHaveBeenCalled();
      for (const reject of pending) reject(new Error('NPC unavailable'));
      expect(await done).toBe(reached);
      expect(loadQuest).toHaveBeenCalledTimes(1); expect(warning).toHaveBeenCalledTimes(3);
    } finally {
      scope.disposed = true;
      for (const reject of pending) reject(new Error('Test cleanup'));
      await done;
    }

  });
});
