import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PineQuestHost } from '#shards/pine-hollow/quest/index';
import { fakeWorld } from '../../fake/world';

function person(): GLTF {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(0.4, 1.8, 0.3).translate(0, 0.9, 0), new MeshStandardMaterial()));
  return { scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' }, parser: {} as GLTF['parser'], userData: {} };
}

async function outcome(promise: Promise<unknown>): Promise<unknown> {
  try { return await promise; } catch (error: unknown) { return error; }
}

beforeEach(() => { vi.resetModules(); });

describe('Pine people boot barrier (E357 R9)', { timeout: 30_000 }, () => {
  it('waits for every person, then creates a generated figure before its first update', async () => {
    const pending: ((value: GLTF) => void)[] = [];
    let requested: () => void = () => undefined;
    const requests = new Promise<void>((resolve) => { requested = resolve; });
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => new Promise<GLTF>((resolve) => {
      pending.push(resolve); if (pending.length === 3) requested();
    }));
    const { loadNpcModel, preloadNpcModels, NPC_KINDS } = await import('#shards/pine-hollow/quest/npcModels');
    let ready = false;
    const done = (async () => { await preloadNpcModels(); ready = true; })();
    try {
      await requests; expect(pending).toHaveLength(3);
      const last = pending.at(-1); if (last === undefined) throw new Error('No NPC requests');
      for (const resolve of pending.slice(0, -1)) resolve(person());
      await Promise.all(NPC_KINDS.slice(0, -1).map(loadNpcModel));
      expect(ready).toBe(false);
      last(person()); await done;
      const { makeNpcFigure } = await import('#shards/pine-hollow/models/people');
      const fig = makeNpcFigure('miller', fakeWorld().sky, { x: 0, y: 0, z: 0 }, 0);
      expect(fig.group.children.some((child) => child instanceof SkinnedMesh)).toBe(true);
    } finally {
      for (const resolve of pending) resolve(person()); await done;
    }

  });

  it('waits at quest installation and proceeds with a stand-in only after NPC loading fails', async () => {
    const pending: ((reason: Error) => void)[] = [];
    let requested: () => void = () => undefined;
    const requests = new Promise<void>((resolve) => { requested = resolve; });
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => new Promise<GLTF>((_resolve, reject) => {
      pending.push(reject); if (pending.length === 3) requested();
    }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const engine = await import('#engine'), reached = new Error('Quest UI reached');
    const loadQuest = vi.spyOn(engine, 'loadQuest').mockRejectedValue(reached);
    const { installPineQuest } = await import('#shards/pine-hollow/quest/index');
    const scope = { disposed: false };
    const done = outcome(installPineQuest({ ctx: { scope } } as PineQuestHost));
    try {
      await requests; expect(pending).toHaveLength(3); expect(loadQuest).not.toHaveBeenCalled();
      for (const reject of pending) reject(new Error('NPC unavailable'));
      expect(await done).toBe(reached);
      expect(loadQuest).toHaveBeenCalledTimes(1); expect(warning).toHaveBeenCalledTimes(3);
    } finally {
      scope.disposed = true;
      for (const reject of pending) reject(new Error('Test cleanup'));
      await done; loadQuest.mockRestore();
    }

  });
});
