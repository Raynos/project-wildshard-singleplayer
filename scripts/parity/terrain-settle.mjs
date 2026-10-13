/** Await the actual tile queue without advancing gameplay or effect time.
 * This function is serialized by Playwright; all dependencies belong to the live page.
 * @param {number} [maxWaitMs]
 * @returns {Promise<{frames:number}>} */
export async function settlePresentationTerrain(maxWaitMs = 120000) {
  if (!Number.isInteger(maxWaitMs) || maxWaitMs < 1 || maxWaitMs > 120000) throw new Error('Invalid terrain capture bound');
  const world = window.__wildshard.requireWorld();
  const handle = window.__wildshard.shard.shardfileResidency;
  if (handle === null || typeof handle !== 'object') throw new Error('Missing actual shardfile residency owner');
  const tiles = Reflect.get(handle, 'tiles');
  if (tiles === null || typeof tiles !== 'object') throw new Error('Missing actual terrain tile owner');
  const refresh = Reflect.get(tiles, 'refresh');
  if (typeof refresh !== 'function') throw new Error('Missing actual terrain refresh queue');
  /** @type {unknown} */ const control = Reflect.get(window, '__parity');
  if (control === null || typeof control !== 'object') throw new Error('Missing captured frame owner');
  if (Reflect.get(control, 'free') !== false || Reflect.get(control, 'remaining') !== 0) throw new Error('Terrain settle requires frozen captured frames');
  const game = world.game, gate = game.frameGate;
  const state = () => JSON.stringify({ clock: game.app.clock.snapshot(), pose: [world.player.position.x, world.player.position.y, world.player.position.z, world.player.yaw, world.player.pitch] });
  const before = state();
  game.frameGate = () => false;
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let timer;
  try {
    const { x, z } = world.player.position;
    const queue = Reflect.apply(refresh, tiles, [x, z]);
    if (!(queue instanceof Promise)) throw new Error('Terrain refresh must return its real completion promise');
    await Promise.race([queue, new Promise((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error('Terrain capture queue did not settle within its wall-time bound')); }, maxWaitMs);
    })]);
    if (state() !== before) throw new Error('Terrain settle changed the captured pose or clock');
    return { frames: 0 };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    game.frameGate = gate;
  }
}
