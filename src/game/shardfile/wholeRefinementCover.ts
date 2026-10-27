import { Group } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';
import { clientTileViews } from './clientViews';
import { prepareClientTile, ring, type ResidentTile, type TileContent } from './tileContent';
import { tileOf } from './tileOrder';
import { tileRing } from './tileDriver';
import { residentTileEntry } from './tileEntry';
import { runtimeLookMaterials, runtimeProduct } from './runtimeProduct';
import type { ControlRefinement } from './controlRefinement';

/** Declared L1 props cover a refine-only native library. The entry ring's
 * parents precede control; other parents share the nearest-first late cursor.
 * A fine read always awaits its parent, and masks it only after publication. */
export function wholeRefinementCover(ctx: ShardContext, owner: Scope, queue: ControlRefinement): {
  readonly content: TileContent; readonly ensure: (tile: number) => Promise<void>;
} {
  const source = ctx.product.shardfile, props = source.props, product = runtimeProduct(source);
  if (props === null) throw new Error('Fine refinement requires declared coarse props');
  const parents = new Map(props.tiles.filter(tile => tile.lod === 1).map(tile => [tile.z * 4 + tile.x, tile]));
  const pending = new Map<number, Promise<void>>(), masks = new Map<number, readonly ResidentTile[]>();
  const live = (): void => { if (owner.disposed || owner.disposing) throw new Error('Coarse refinement owner is retired'); };
  let presentation: Promise<ReturnType<typeof clientTileViews>> | undefined;
  const views = (): Promise<ReturnType<typeof clientTileViews>> => {
    presentation ??= (async () => {
    const looks = await runtimeLookMaterials({ scope: owner, game: ctx.game }, source, true); live();
      return clientTileViews({ terrain: null, ...looks });
    })();
    return presentation;
  };
  const load = (key: number): Promise<void> => {
    let found = pending.get(key); if (found !== undefined) return found;
    const row = parents.get(key); if (row === undefined) return Promise.reject(new Error('Fine refinement lacks its declared coarse parent'));
    found = (async () => {
      live(); const scope = owner.child(`refinement.coarse:${String(key)}`), root = new Group();
      scope.onDispose(() => { root.removeFromParent(); masks.delete(key); });
      try {
        const installer = await views(); live();
        const tiles = await prepareClientTile({ ...source, terrain: null }, product.assets, `1/${String(row.x)}/${String(row.z)}`, scope,
          { terrain: () => { throw new Error('Coarse props cannot install terrain'); }, props: (data, address, bytes, lifetime, additional) => installer.props(data, address, bytes, root, lifetime, additional) });
        live(); masks.set(key, tiles); ctx.root.add(root);
        await product.releaseTransport([row.file, ...row.additionalFiles ?? []]); live();
      } catch (error) { scope.dispose(); throw error; }
    })();
    pending.set(key, found); return found;
  };
  const ensure = (tile: number): Promise<void> => load(Math.floor(tile / 16) * 4 + Math.floor(tile % 8 / 2));
  const content: TileContent = { id: 'whole.refinement.coarse', tiles: () => new Set(), attach: () => Promise.resolve(), coarse: async (scope, rendered) => {
    const at = residentTileEntry(owner) ?? source.spawn, spawn = new Set([...ring(tileOf(at.x, at.z), tileRing())].map(tile => Math.floor(tile / 16) * 4 + Math.floor(tile % 8 / 2)));
    const distance = (key: number): number => (-250 + (key % 4 + 0.5) * 125 - at.x) ** 2 + (-250 + (Math.floor(key / 4) + 0.5) * 125 - at.z) ** 2;
    const order = [...parents.keys()].sort((a, b) => distance(a) - distance(b));
    for (const key of order) if (spawn.has(key)) await load(key);
    for (const key of order) if (!spawn.has(key)) void queue.add(`coarse:${String(key)}`, { x: -250 + (key % 4 + 0.5) * 125, z: -250 + (Math.floor(key / 4) + 0.5) * 125 }, () => load(key));
    ctx.system({ id: 'client.world.refinement-mask', phase: 'update', run: () => {
      if (scope.disposed || scope.disposing) return;
      for (const [key, tiles] of masks) {
        const x = key % 4 * 2, z = Math.floor(key / 4) * 2, hidden = new Set<number>();
        for (let quadrant = 0; quadrant < 4; quadrant++) if (rendered((z + Math.floor(quadrant / 2)) * 8 + x + quadrant % 2)) hidden.add(quadrant);
        for (const tile of tiles) tile.mask(hidden);
      }
    } });
  } };
  return { content, ensure };
}
