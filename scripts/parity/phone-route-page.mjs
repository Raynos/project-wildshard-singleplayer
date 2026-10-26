// G745: read actual page/physics/render owners; never install a replacement game service.

/** RWI has no Playwright tap port: dispatch the same touch/control events,
 * including pointerdown (HOVER binds there), under emulateUserGesture.
 * @param {string} selector */
export function phoneTouchButton(selector) {
  const button = document.querySelector(selector);
  if (!(button instanceof HTMLButtonElement) || button.disabled || button.getClientRects().length === 0) throw new Error('Unavailable actual phone control');
  const rect = button.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true,
    clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
  button.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
  button.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  button.click();
  return true;
}

/** Read the rendered G718 pill and completed draws, not simulation ticks or p50. */
export function phoneRouteObservation() {
  const api = window.__wildshard, world = api?.world;
  if (world === undefined) return null;
  const exposed = api.shard.grid;
  if (typeof exposed !== 'object' || exposed === null || !('state' in exposed) || typeof exposed.state !== 'function') throw new Error('Phone route requires grid state');
  const grid = /** @type {import('./phone-route.mjs').PhoneGrid} */ (exposed.state());
  const live = grid.live?.live;
  const history = /** @type {unknown} */ (Reflect.get(window, '__phoneRouteFaults'));
  const errors = Array.isArray(history) ? history.filter((/** @type {unknown} */ row) => typeof row === 'string') : ['Missing cold error observer'];
  return { at: performance.now(), frame: world.game.frameCount, frameAt: world.game.frameRafTime,
    ready: live?.gameplayReady === true && world.game.frameGate() && !world.hud.paused,
    current: live?.current ?? null, inside: grid.inside, home: grid.home, pitch: grid.pitch,
    feet: live?.worldFeet ?? null, cells: grid.cells, grain: grid.frame?.chain.fx?.grain ?? 0,
    frameAvailable: grid.frame !== null, hover: world.player.hover,
    fps: Number(document.querySelector('.ws-perf > b')?.textContent), pill: document.querySelector('.ws-perf')?.textContent ?? null,
    fatal: [...errors, ...document.querySelectorAll('#wserr,.ws-load-error,.ws-game-dev-alert,[data-boot-fatal]')].map(node => typeof node === 'string' ? node : node.textContent),
    contextLost: world.game.renderer.getContext().isContextLost() };
}

/** First geometric Night Market entry: take full tile evidence once, not a debug census every frame.
 * @param {string} instance */
export function watchPhoneEntry(instance) {
  const api = window.__wildshard, world = api.requireWorld();
  const exposed = api.shard.grid;
  if (typeof exposed !== 'object' || exposed === null || !('travelState' in exposed) || typeof exposed.travelState !== 'function' || !('state' in exposed) || typeof exposed.state !== 'function') throw new Error('Missing live grid travel port');
  const readTravel = exposed.travelState, read = exposed.state;
  /** @type {{done:boolean, entry:unknown}} */ const evidence = { done: false, entry: null };
  Reflect.set(window, '__phoneRouteEntry', evidence);
  let lastFrame = -1;
  const frame = () => {
    if (evidence.done || window.__wildshard !== api) return;
    requestAnimationFrame(frame);
    if (world.game.frameCount === lastFrame) return;
    lastFrame = world.game.frameCount;
    const travel = /** @type {{inside:string|null}} */ (readTravel());
    if (travel.inside !== instance) return;
    const state = /** @type {import('./phone-route.mjs').PhoneGrid} */ (read());
    const cell = state.cells.find(row => row.instance === instance);
    evidence.entry = { at: performance.now(), frame: world.game.frameCount, inside: state.inside,
      current: state.live?.live.current, ready: state.live?.live.gameplayReady,
      cell: cell === undefined ? null : { ...cell, cell: [...cell.cell], drawn: { ...cell.drawn } }, grain: state.frame?.chain.fx?.grain ?? 0 };
    evidence.done = true;
  };
  requestAnimationFrame(frame);
}

/** Wall probe uses the actual board and held forward input at the route's endpoint; no pose/enterNow.
 * @param {number} milliseconds */
export async function phoneBoardWall(milliseconds) {
  const world = window.__wildshard.requireWorld(), player = world.player, input = world.game.app.input;
  const start = performance.now(), startedFrame = world.game.frameCount, yaw = player.yaw, hover = player.hover;
  const from = { x: player.position.x, y: player.position.y, z: player.position.z }, physics = world.physics;
  const hit = physics.world.castRay(new physics.R.Ray({ x: from.x, y: from.y + .8, z: from.z }, { x: 1, y: 0, z: 0 }), 25, true, physics.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.motor.collider);
  if (hit === null) throw new Error('No real wall collider ahead of the board route');
  const wallX = from.x + hit.timeOfImpact;
  /** @type {{ms:number,x:number,z:number,hover:boolean,frame:number}[]} */ const samples = [];
  if (!player.hover) throw new Error('Board must be mounted through the actual touch control');
  player.yaw = -Math.PI / 2; input.setHeld('move.forward', true);
  const stop = world.game.watchFrames(() => { samples.push({ ms: performance.now() - start, x: player.position.x, z: player.position.z, hover: player.hover, frame: world.game.frameCount }); });
  try {
    await new Promise(resolve => { setTimeout(resolve, milliseconds); });
  } finally { input.clear(); stop(); }
  // Sample on real game frames, including the preceding held-input window.
  return { from, wallX, elapsedMs: performance.now() - start, startedFrame, finalFrame: world.game.frameCount,
    final: { x: player.position.x, y: player.position.y, z: player.position.z }, hover: player.hover, samples, previous: { yaw, hover } };
}

/** Lightweight early shell witness: actual hero image loaded plus a presented animation frame. */
export function installPhoneTitlePaint() {
  /** @type {{heroMs:number|null, fcpMs:number|null, heroURL:string|null}} */
  const evidence = { heroMs: null, fcpMs: null, heroURL: null };
  Reflect.set(window, '__phoneRoutePaint', evidence);
  /** @type {string[]} */ const faults = [];
  Reflect.set(window, '__phoneRouteFaults', faults);
  window.addEventListener('error', event => { faults.push(event.message); });
  window.addEventListener('unhandledrejection', event => { faults.push(String(event.reason)); });
  new MutationObserver(() => { for (const node of document.querySelectorAll('#wserr,.ws-load-error,.ws-game-dev-alert,[data-boot-fatal]')) { const text = node.textContent ?? 'Fatal UI'; if (!faults.includes(text)) faults.push(text); } }).observe(document, { childList: true, subtree: true, characterData: true });
  const sample = () => {
    if (evidence.heroMs !== null) return;
    const hero = [...document.querySelectorAll('.ws-launch-hero,.ws-main-hero')].find(node => node.getClientRects().length > 0);
    if (hero === undefined) { requestAnimationFrame(sample); return; }
    const match = /url\(["']?([^"')]+)["']?\)/u.exec(getComputedStyle(hero).backgroundImage);
    if (match?.[1] === undefined) { requestAnimationFrame(sample); return; }
    const image = new Image(); evidence.heroURL = new URL(match[1], location.href).href;
    image.onload = () => { requestAnimationFrame(() => { requestAnimationFrame(() => {
      evidence.heroMs = performance.now();
      evidence.fcpMs = performance.getEntriesByType('paint').find(row => row.name === 'first-contentful-paint')?.startTime ?? null;
    }); }); };
    image.onerror = () => { evidence.heroMs = -1; };
    image.src = evidence.heroURL;
  };
  requestAnimationFrame(sample);
}
