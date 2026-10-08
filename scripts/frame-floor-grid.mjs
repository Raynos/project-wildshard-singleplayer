/** Actual-frame floor routes; only the first home pose is seeded, every seam afterwards is driven by held input. */
export function gridFloorPlans(state, scenario) {
  const home = state.cells.find(cell => cell.instance === state.home);
  if (!home) throw new Error('Grid floor has no assembled home');
  const origin = cell => ({ x: cell.cell[0] * 555, z: cell.cell[1] * 555 });
  const h = origin(home), plans = [];
  if (scenario === 'template' || scenario === 'all') {
    const peer = state.cells.filter(cell => cell.slug === '_template' && cell.instance !== home.instance)
      .sort((a, b) => a.instance.localeCompare(b.instance))[0];
    if (!peer) throw new Error('Grid floor has no template');
    const p = origin(peer), dx = Math.sign(p.x - h.x), dz = Math.sign(p.z - h.z);
    const start = dz === 0 ? { x: h.x + dx * 230, z: h.z } : { x: h.x, z: h.z + dz * 230 };
    const end = dx === 0 ? { x: p.x, z: p.z - dz * 230 } : { x: p.x - dx * 230, z: p.z };
    // Corners have no diagonal entrance: use the two midpoint turn-ins and their crossroads.
    const road = dx !== 0 && dz !== 0 ? [{ x: h.x, z: (h.z + p.z) / 2 },
      { x: (h.x + p.x) / 2, z: (h.z + p.z) / 2 }, { x: (h.x + p.x) / 2, z: p.z }] : [];
    plans.push({ name: 'template-interior', from: home.instance, to: peer.instance, start, waypoints: [...road, end], requiredResidents: [peer.instance] },
      { name: 'template-return', from: peer.instance, to: home.instance, waypoints: [...road].reverse().concat(start), requiredResidents: [] });
  }
  if (scenario === 'runtime-travel' || scenario === 'all') {
    const pine = state.cells.find(cell => cell.slug === 'pine-hollow'), nalati = state.cells.find(cell => cell.slug === 'nalati-grasslands');
    if (!pine || !nalati) throw new Error('Developer grid floor requires Pine and Nalati cells');
    const p = origin(pine), n = origin(nalati);
    if (p.x !== h.x || p.z <= h.z || n.z !== h.z || n.x <= h.x) throw new Error('Unexpected Developer travel layout');
    const road = { x: (h.x + n.x) / 2, z: (h.z + p.z) / 2 };
    plans.push({ name: 'pine-interior', from: home.instance, to: pine.instance, start: { x: h.x, z: h.z + 230 },
      waypoints: [{ x: p.x, z: p.z - 230 }], requiredResidents: [pine.instance] },
    { name: 'nalati-with-pine-resident', from: pine.instance, to: nalati.instance,
      waypoints: [{ x: p.x, z: road.z }, road, { x: road.x, z: n.z }, { x: n.x - 230, z: n.z }], requiredResidents: [pine.instance, nalati.instance] });
  }
  return plans;
}

/** This self-contained function is serialized into Chromium or Safari, without changing the game's fixed step. */
export async function driveFloorGrid(plan) {
  const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
  const read = () => { const state = api.shard.grid.state(); if (!state.live?.live) throw new Error('Grid live telemetry missing'); return state; };
  const initial = read(), live = initial.live.live;
  if (live.current !== plan.from) throw new Error(`Grid floor starts in ${live.current}, expected ${plan.from}`);
  const oldHover = player.hover, oldLimit = player.hoverSpeedLimit;
  if (typeof oldLimit !== 'function') throw new Error('Grid hover-speed rule missing');
  input.clear();
  if (plan.start) {
    const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
    await api.pose({ x: plan.start.x - origin.x, y: 0.55, z: plan.start.z - origin.z, yaw: 0, pitch: -0.08 });
  }
  player.setHover(true);
  let distance = 100;
  player.hoverSpeedLimit = () => Math.min(15, oldLimit(), Math.max(3, distance * 1.5));
  const before = read(), trace = [], started = performance.now();
  try {
    await new Promise((resolve, reject) => {
      let stop = () => undefined, waypoint = 0, lastSample = -1;
      const timer = setTimeout(() => { stop(); input.clear(); reject(new Error(`Grid floor route ${plan.name} timed out`)); }, 150000);
      const finish = error => { stop(); clearTimeout(timer); input.clear(); if (error) reject(error instanceof Error ? error : new Error(String(error))); else resolve(undefined); };
      stop = world.game.watchFrames(() => {
        try {
          const state = read(), active = state.live.live, feet = active.worldFeet, seconds = (performance.now() - started) / 1000;
          if (seconds - lastSample >= 0.25) { trace.push({ seconds, ...feet, current: active.current, gameplayReady: active.gameplayReady }); lastSample = seconds; }
          if (state.live.crossing.phase === 'blocked' || state.live.crossing.phase === 'save-failed') throw new Error(`Grid floor crossing blocked: ${state.live.crossing.issue}`);
          const target = plan.waypoints[waypoint];
          if (!target) {
            input.clear();
            if (active.current === plan.to && state.inside === plan.to && active.gameplayReady) finish();
            return;
          }
          const dx = target.x - feet.x, dz = target.z - feet.z;
          distance = Math.hypot(dx, dz);
          if (distance < 1.5) { waypoint++; input.clear(); return; }
          if (!active.gameplayReady) { input.clear(); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        } catch (error) { finish(error); }
      });
    });
    return { plan, before, after: read(), trace, elapsedSeconds: (performance.now() - started) / 1000 };
  } finally { input.clear(); player.hoverSpeedLimit = oldLimit; player.setHover(oldHover); }
}

/** A visible destination without real frame commits or complete runtime residency never counts as this scenario. */
export function gridFloorWitnessFailures(result) {
  const { plan, before, after } = result, previous = before.live.live, active = after.live.live, failures = [];
  const count = active.crossings - previous.crossings;
  const transitions = active.transitions.slice(-count);
  if (count !== 2 || JSON.stringify(transitions) !== JSON.stringify([{ from: plan.from, to: null }, { from: null, to: plan.to }])) failures.push('Expected source/road/destination frame commits');
  if (active.current !== plan.to || after.inside !== plan.to || !active.gameplayReady) failures.push('Destination interior gameplay is not ready');
  if (plan.requiredResidents.some(id => !active.residents.includes(id))) failures.push('Required runtime residents are missing');
  const cell = after.cells.find(row => row.instance === plan.to);
  if (!cell || Math.abs(active.worldFeet.x - cell.cell[0] * 555) >= 250 || Math.abs(active.worldFeet.z - cell.cell[1] * 555) >= 250) failures.push('Destination feet are outside its interior');
  if (![active.worldFeet.x, active.worldFeet.y, active.worldFeet.z, result.elapsedSeconds].every(Number.isFinite)
    || result.elapsedSeconds <= 0 || result.trace.length === 0
    || result.trace.some(row => ![row.seconds, row.x, row.y, row.z].every(Number.isFinite) || row.y < -0.25)) failures.push('Route has no valid above-ground motion witness');
  return failures;
}
