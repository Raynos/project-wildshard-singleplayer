import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PineQuestHost } from '#shards/pine-hollow/quest/index';
import { fakeWorld } from '../../fake/world';

function person(): GLTF {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(0.4, 1.8, 0.3).translate(0, 0.9, 0), new MeshStandardMaterial()));
  return { scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' }, parser: {} as GLTF['parser'], userData: {} };
}

beforeEach(() => { vi.resetModules(); });

describe('Pine people boot barrier (E357 R9)', () => {
  it('waits for every person, then creates a generated figure before its first update', async () => {
    const pending: ((value: GLTF) => void)[] = [];
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => new Promise<GLTF>((resolve) => { pending.push(resolve); }));
    const { preloadNpcModels } = await import('#shards/pine-hollow/quest/npcModels');
    let ready = false;
    const done = preloadNpcModels().then(() => { ready = true; return undefined; });
    expect(pending).toHaveLength(3);
    const last = pending.at(-1); if (last === undefined) throw new Error('No NPC requests');
    for (const resolve of pending.slice(0, -1)) resolve(person());
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(ready).toBe(false);
    last(person()); await done;
    const { makeNpcFigure } = await import('#shards/pine-hollow/models/people');
    const fig = makeNpcFigure('miller', fakeWorld().sky, { x: 0, y: 0, z: 0 }, 0);
    expect(fig.group.children.some((child) => child instanceof SkinnedMesh)).toBe(true);
  });

  it('waits at quest installation and proceeds with a stand-in only after NPC loading fails', async () => {
    const pending: ((reason: Error) => void)[] = [];
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => new Promise<GLTF>((_resolve, reject) => { pending.push(reject); }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const engine = await import('#engine'), reached = new Error('Quest UI reached');
    const loadQuest = vi.spyOn(engine, 'loadQuest').mockRejectedValue(reached);
    const { installPineQuest } = await import('#shards/pine-hollow/quest/index');
    const installing = installPineQuest({ ctx: { scope: { disposed: false } } } as PineQuestHost);
    const done = expect(installing).rejects.toBe(reached);
    await Promise.resolve(); expect(loadQuest).not.toHaveBeenCalled();
    for (const reject of pending) reject(new Error('NPC unavailable'));
    await done; expect(loadQuest).toHaveBeenCalledTimes(1); expect(warning).toHaveBeenCalledTimes(3);
  });
});
