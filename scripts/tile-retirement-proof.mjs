import { ownedSoakPlans } from './soak/owned.mjs';

/** Use the original soak's road and declared-portal route, restricted to DW/Sky.
 * @param {Pick<import('./frame-floor-grid.mjs').FloorGridState, 'home' | 'cells' | 'pitch'>} state */
export function tileRetirementRoute(state) {
  const cells = state.cells.filter(cell => cell.slug === 'driftwood-isle' || cell.slug === 'far-reach');
  if (cells.length !== 2 || new Set(cells.map(cell => cell.slug)).size !== 2
    || cells.find(cell => cell.instance === state.home)?.slug !== 'driftwood-isle')
    throw new Error('Tile retirement requires the owned Driftwood home and Sky Reach');
  return ownedSoakPlans({ ...state, cells });
}

/** Count only observed render-claim lifetimes. Missing a short lifetime can
 * undercount; a missing sample can never invent an eviction. */
export function tileRetirementTracker() {
  /** @type {Set<string>} */
  let previous = new Set();
  /** @type {Map<string, number>} */
  const retired = new Map();
  return {
    /** @param {readonly string[]} keys */
    observe(keys) {
      if (new Set(keys).size !== keys.length || keys.some(key => !/^render:.+:(?:far|l[01]\/-?\d+\/-?\d+)$/u.test(key)))
        throw new Error('Invalid render claim keys');
      const current = new Set(keys);
      for (const key of previous) if (!current.has(key)) retired.set(key, (retired.get(key) ?? 0) + 1);
      previous = current;
    },
    result() { return { cycles: [...retired.values()].reduce((sum, count) => sum + count, 0), byKey: Object.fromEntries(retired) }; },
  };
}

/** @typedef {{renderer:number,gpu:number,browser:number}} ProcessBytes */
/** @typedef {{document:string,current:string|null,ready:boolean,controls:boolean,pending:number,retiring:number,tileGhosts:number,regionGhosts:number,
 * inFlight:number,queued:number,x:number,z:number,process:ProcessBytes}} RetirementBoundary */

/** T1's memory gate uses the dedicated browser's renderer plus GPU private
 * footprint, in bytes. Browser overhead is recorded separately, not added.
 * @param {{baseline:RetirementBoundary,returns:RetirementBoundary[],cycles:number,errors:string[]}} proof */
export function gradeTileRetirement(proof) {
  const failures = [...proof.errors], baseline = proof.baseline;
  if (proof.returns.length !== 5) failures.push('Expected exactly five measured DW/Sky round trips');
  if (!Number.isSafeInteger(proof.cycles) || proof.cycles < 20) failures.push('Fewer than twenty observed tile load/evict lifetimes');
  /** @param {RetirementBoundary} row */
  const bytes = row => row.process.renderer + row.process.gpu;
  const boundaries = [baseline, ...proof.returns];
  for (const [index, row] of boundaries.entries()) {
    if (!row.document || row.document !== baseline.document || !row.current || row.current !== baseline.current || !row.ready || !row.controls
      || row.pending !== 0 || row.retiring !== 0 || row.inFlight !== 0 || row.queued !== 0)
      failures.push(`Boundary ${index} is not the same settled home/document`);
    if (![row.x, row.z, baseline.x, baseline.z].every(Number.isFinite)
      || Math.hypot(row.x - baseline.x, row.z - baseline.z) > 5)
      failures.push(`Boundary ${index} changed the baseline pose`);
    if (row.tileGhosts !== 0 || row.regionGhosts !== 0) failures.push(`Boundary ${index} has retired ghosts`);
    if (![row.process.renderer, row.process.gpu, row.process.browser].every(value => Number.isSafeInteger(value) && value > 0))
      failures.push(`Boundary ${index} has no complete process memory reading`);
  }
  const deltas = proof.returns.map(row => bytes(row) - bytes(baseline));
  for (const [index, delta] of deltas.entries()) if (Math.abs(delta) > 20_000_000)
    failures.push(`Round trip ${index + 1} differs from baseline by more than 20 MB`);
  return { pass: failures.length === 0, failures, baselineBytes: bytes(baseline), deltaBytes: deltas };
}

/** Browser-serialized scalar-only observation; never retain scopes/resources. */
export function readRetirementBoundary(identity, documentIdentity) {
  if (documentIdentity().token !== identity.token || performance.timeOrigin !== identity.timeOrigin)
    throw new Error('Retirement proof navigated');
  const api = window.__wildshard, grid = api.shard.grid, state = grid.state(), live = state.live?.live;
  if (!live || !state.rings.ghosts || !live.ghosts) throw new Error('Retirement counters unavailable');
  if (state.live.crossing.phase === 'blocked' || state.live.crossing.phase === 'save-failed')
    throw new Error(`Retirement crossing failed: ${state.live.crossing.issue}`);
  if (api.world.game.renderer.getContext().isContextLost()) throw new Error('Retirement context lost');
  return { document: identity.token, current: live.current, ready: live.gameplayReady && state.inside === live.current,
    controls: !document.hidden && api.world.hud.entered && !api.world.hud.paused && api.world.game.frameGate(),
    pending: live.pending.length, retiring: live.retiring.length, tileGhosts: state.rings.ghosts.count, regionGhosts: live.ghosts.count,
    inFlight: state.rings.inFlight, queued: state.rings.queued, x: live.worldFeet.x, z: live.worldFeet.z,
    keys: grid.residency().claims.filter(row => ['far', 'l0', 'l1'].includes(row.category)
      && row.id.startsWith('render:')).map(row => row.id) };
}

/** Initial staging only, before warm-up or measured input. A new position can
 * publish streamed colliders after pose's first ground lookup; resolve again
 * only after that position's normal streaming and crossing have settled. */
export async function seedTileRetirementHome(reference, identity, documentIdentity) {
  const api = window.__wildshard, home = api.shard.grid.state().home;
  const read = () => {
    if (documentIdentity().token !== identity.token || performance.timeOrigin !== identity.timeOrigin || window.__wildshard !== api)
      throw new Error('Retirement proof navigated before its home seed');
    const state = api.shard.grid.state(), live = state.live?.live;
    if (!live || state.home !== home || live.current !== home || state.inside !== home || !live.gameplayReady)
      throw new Error('Retirement seed requires its original ready home');
    if (state.live.crossing.phase === 'blocked' || state.live.crossing.phase === 'save-failed')
      throw new Error(`Retirement seed crossing failed: ${state.live.crossing.issue}`);
    return state;
  };
  const pose = async () => {
    const state = read(), player = api.world.player, feet = state.live.live.worldFeet;
    await api.pose({ x: reference.x - (feet.x - player.position.x), z: reference.z - (feet.z - player.position.z), yaw: 0, pitch: -0.08 });
  };
  await pose();
  const deadline = performance.now() + 120_000;
  // Two separate normal turns let the moved player's stream request publish;
  // an empty queue from the old position is not a settled staging receipt.
  let settled = 0;
  while (settled < 2) {
    if (performance.now() >= deadline) throw new Error('Retirement home seed streaming did not settle');
    await new Promise(resolve => { setTimeout(resolve, 100); });
    const state = read();
    settled = state.rings.inFlight === 0 && state.rings.queued === 0 && state.live.crossing.phase === 'settled' ? settled + 1 : 0;
  }
  await pose();
}
