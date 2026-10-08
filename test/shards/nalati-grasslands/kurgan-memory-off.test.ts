import { BufferAttribute, BufferGeometry, Mesh, PointLight, Scene } from 'three';
import { expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { ownSceneTree } from '../../../src/engine/app/sceneOwnership';
import { isDev, setDev } from '../../../src/engine/core/devMode';
import { overrideSetting } from '../../../src/engine/ui/Settings';
import { KurganBoss } from '../../../src/shards/nalati-grasslands/combat/goldenKing';
import { KurganDungeon } from '../../../src/shards/nalati-grasslands/world/KurganDungeon';
import { legacyActor } from '../../fake/legacyActor';

function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }

// A separate document/module lifetime: Memory saver is intentionally read once per reload.
it('retains the shipping eager 12.022 MB static mesh when Memory saver is OFF', () => {
  const previousDev = isDev(); setDev(true); overrideSetting('memorySaver', 'off');
  const owner = new Scope('eager-kurgan'), actual = new KurganDungeon(), add = vi.fn(), scene = new Scene();
  const boss = legacyActor(KurganBoss.prototype, { dungeon: actual, spareLight: new PointLight(), ctx: { game: { scene }, registry: { add } } });
  ownSceneTree(actual.group, owner, { isAcquired: () => false });
  try {
    boss.build(); expect(add).toHaveBeenCalledTimes(2); expect(actual.group.visible).toBe(false);
    const interior = actual.group.getObjectByName('kurgan-interior');
    const geo: unknown = interior instanceof Mesh ? interior.geometry : null;
    if (!isGeometry(geo)) throw new Error('Missing eager static mesh');
    let bytes = 0;
    for (const name of ['position', 'normal', 'color']) {
      const attribute = geo.getAttribute(name);
      if (!(attribute instanceof BufferAttribute)) throw new Error('Missing static attribute');
      bytes += attribute.array.byteLength;
    }
    expect(bytes).toBe(12022128);
  } finally { owner.dispose(); overrideSetting('memorySaver', null); setDev(previousDev); }
});
