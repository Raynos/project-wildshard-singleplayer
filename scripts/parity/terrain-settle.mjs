/** Await the actual standalone tile owner at the current viewer, driving only bounded captured frames.
 * This function is serialized by Playwright; all dependencies belong to the live page.
 * @param {number} [maxFrames]
 * @returns {Promise<{frames:number}>} */
export async function settlePresentationTerrain(maxFrames = 1200) {
  if (!Number.isInteger(maxFrames) || maxFrames < 1 || maxFrames > 1200) throw new Error('Invalid terrain capture bound');
  const world = window.__wildshard.requireWorld();
  const handle = window.__wildshard.shard.shardfileResidency;
  if (handle === null || typeof handle !== 'object') throw new Error('Missing actual shardfile residency owner');
  const tiles = Reflect.get(handle, 'tiles');
  if (tiles === null || typeof tiles !== 'object') throw new Error('Missing actual terrain tile owner');
  const refresh = Reflect.get(tiles, 'refresh');
  if (typeof refresh !== 'function') throw new Error('Missing actual terrain refresh queue');
  /** @type {unknown} */ const control = Reflect.get(window, '__parity');
  if (control === null || typeof control !== 'object') throw new Error('Missing captured frame owner');
  const advance = Reflect.get(control, 'advance');
  if (typeof advance !== 'function') throw new Error('Missing captured frame driver');
  const { x, z } = world.player.position;
  const queue = Reflect.apply(refresh, tiles, [x, z]);
  if (!(queue instanceof Promise)) throw new Error('Terrain refresh must return its real completion promise');
  /** @type {{complete:boolean;succeeded:boolean;failure:unknown}} */
  const state = { complete: false, succeeded: false, failure: undefined };
  void (async () => {
    try { await queue; state.succeeded = true; }
    catch (error) { state.failure = error; }
    finally { state.complete = true; }
  })();
  let frames = 0;
  for (; frames < maxFrames; frames++) {
    if (state.complete) break;
    const frame = Reflect.apply(advance, control, [1]);
    if (!(frame instanceof Promise)) throw new Error('Captured frame driver must return its completion promise');
    await frame;
  }
  if (!state.complete) throw new Error('Terrain capture queue did not settle within its frame bound');
  if (!state.succeeded) throw state.failure;
  return { frames };
}
