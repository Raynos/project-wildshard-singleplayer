/** Build a continuous home → deck → neighbour → deck → home route from the actual grid readout. */
export function gridSeamRoute(state, speed) {
  if (speed !== 15 && speed !== 30) throw new RangeError('Grid drive speed must be 15 or 30');
  const home = state.cells.find((cell) => cell.instance === state.home);
  if (home === undefined) throw new Error('Grid readout has no home cell');
  const peer = state.cells.filter((cell) => cell.slug === '_template' && cell.instance !== home.instance && Math.abs(cell.cell[0] - home.cell[0]) <= 1 && Math.abs(cell.cell[1] - home.cell[1]) <= 1)
    .sort((a, b) => (a.cell[0] === home.cell[0] - 1 && a.cell[1] === home.cell[1] - 1 ? -1 : 0) - (b.cell[0] === home.cell[0] - 1 && b.cell[1] === home.cell[1] - 1 ? -1 : 0) || a.instance.localeCompare(b.instance))[0];
  if (peer === undefined) throw new Error('Grid drive requires a neighbouring template cell');
  const dx = peer.cell[0] - home.cell[0], dz = peer.cell[1] - home.cell[1];
  const hx = home.cell[0] * 555, hz = home.cell[1] * 555;
  return { home: home.instance, peer: peer.instance, speed,
    start: { x: hx + dx * 230, z: hz + dz * 230 },
    waypoints: [{ x: hx + dx * 325, z: hz + dz * 325 }, { x: hx + dx * 230, z: hz + dz * 230 }], timeout: 60 };
}

/** This function is serialized into the browser. Only the initial home pose is positioned; a stuck leg never teleports. */
export async function driveGridSeam(route) {
  const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
  const read = () => { const state = api.shard.grid.state().live?.live; if (!state) throw new Error('Live grid simulation telemetry is unavailable'); return state; };
  const routeIssues = (state) => Object.fromEntries(Object.entries(state.issues).filter(([instance]) => instance === route.home || instance === route.peer));
  const initial = read(); if (initial.current !== route.home) throw new Error('Grid route must begin in the home frame');
  const origin = { x: initial.worldFeet.x - player.position.x, z: initial.worldFeet.z - player.position.z };
  const oldLimit = player.hoverSpeedLimit, oldHover = player.hover;
  if (typeof oldLimit !== 'function') throw new Error('Grid hover-speed rules are not installed');
  input.clear(); player.velocity.set(0, 0, 0);
  player.spawn(route.start.x - origin.x, route.start.z - origin.z, Math.atan2(-route.waypoints[0].x + route.start.x, -route.waypoints[0].z + route.start.z));
  player.setHover(true); player.hoverSpeedLimit = () => Math.min(route.speed, oldLimit());
  const trace = [], stuck = []; let wi = 0, elapsed = 0, lastProgress = { time: 0, distance: Infinity }, timedOut = false;
  try {
    // Wait for real collider/sim/module admission while stationary inside home. Entered hooks remain the gameplay fence.
    const deadline = performance.now() + 120_000;
    while (!read().residents.includes(route.peer)) {
      if (performance.now() > deadline) throw new Error('Grid neighbour admission timed out');
      const issues = routeIssues(read());
      if (Object.keys(issues).length > 0) throw new Error(`Grid admission failed: ${JSON.stringify(issues)}`);
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
    await new Promise((resolve) => { setTimeout(resolve, 600); });
    const before = read();
    await new Promise((resolve, reject) => {
      let stop = () => undefined;
      const finish = () => { input.clear(); stop(); resolve(undefined); };
      stop = world.game.watchFrames((dt) => {
        try {
          elapsed += dt;
          const state = read(), feet = state.worldFeet;
          trace.push({ time: elapsed, x: feet.x, y: feet.y, z: feet.z, current: state.current, enabled: player.motor.collider.isEnabled(), gameplayReady: state.gameplayReady });
          if (wi >= route.waypoints.length) { finish(); return; }
          if (elapsed > route.timeout) { timedOut = true; finish(); return; }
          const wp = route.waypoints[wi], dx = wp.x - feet.x, dz = wp.z - feet.z, distance = Math.hypot(dx, dz);
          if (distance < 1) { wi++; input.clear(); lastProgress = { time: elapsed, distance: Infinity }; return; }
          if (distance < lastProgress.distance - 0.3) lastProgress = { time: elapsed, distance };
          else if (elapsed - lastProgress.time > 2) { stuck.push({ waypoint: wi, ...feet, current: state.current }); finish(); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        } catch (error) { input.clear(); stop(); reject(error instanceof Error ? error : new Error(String(error))); }
      });
    });
    const after = read();
    const crossingDelta = after.crossings - before.crossings;
    return { ...route, trace, stuck, complete: wi === route.waypoints.length, timedOut,
      crossingDelta, transitions: crossingDelta > 0 ? after.transitions.slice(-crossingDelta) : [], issues: routeIssues(after), backgroundIssues: Object.fromEntries(Object.entries(after.issues).filter(([instance]) => instance !== route.home && instance !== route.peer)) };
  } finally { input.clear(); player.hoverSpeedLimit = oldLimit; player.setHover(oldHover); }
}

/** A route cannot pass merely because input ran: all four frame commits must occur, with no teleport, fall or snag. */
export function gridDriveFailures(result) {
  const failures = [];
  if (!result.complete || result.timedOut) failures.push('Grid route did not finish');
  if (result.stuck.length > 0) failures.push(`Grid route stuck at ${result.stuck.length} waypoint(s)`);
  const expected = [{ from: result.home, to: null }, { from: null, to: result.peer }, { from: result.peer, to: null }, { from: null, to: result.home }];
  if (result.crossingDelta !== 4 || JSON.stringify(result.transitions) !== JSON.stringify(expected)) failures.push('Expected home/deck/neighbour/deck/home crossings were not observed');
  if (Object.keys(result.issues).length > 0) failures.push(`Grid admission/disposal issues: ${JSON.stringify(result.issues)}`);
  if (result.trace.length === 0) failures.push('Grid route has no motion samples');
  let peakSpeed = 0;
  for (let i = 0; i < result.trace.length; i++) {
    const row = result.trace[i], previous = result.trace[i - 1];
    if (![row.time, row.x, row.y, row.z].every(Number.isFinite) || row.y < -0.25 || row.enabled !== true) { failures.push('Grid route fell or lost its traveller controller'); break; }
    if (previous) {
      const distance = Math.hypot(row.x - previous.x, row.z - previous.z), dt = row.time - previous.time;
      if (dt <= 0 || distance > result.speed * dt + 0.5) { failures.push('Grid route jumped across a seam'); break; }
      peakSpeed = Math.max(peakSpeed, distance / dt);
    }
  }
  if (peakSpeed < result.speed - 0.5) failures.push(`Grid route never reached ${result.speed} m/s`);
  return failures;
}
