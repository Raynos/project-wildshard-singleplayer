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
      waypoints: [{ x: p.x, z: p.z - 230 }], requiredResidents: [pine.instance], retiredResidents: [home.instance] },
    { name: 'nalati-interior', from: pine.instance, to: nalati.instance,
      waypoints: [{ x: p.x, z: road.z }, road, { x: road.x, z: n.z }, { x: n.x - 230, z: n.z }],
      requiredResidents: [nalati.instance], retiredResidents: [pine.instance] });
  }
  return plans;
}

/** Capture a stable document identity; Safari time-origin drift is recorded, never mistaken for navigation. */
export function gridFloorDocumentIdentity() {
  window.__frameFloorGridDocumentToken ??= crypto.randomUUID();
  return { timeOrigin: performance.timeOrigin, token: window.__frameFloorGridDocumentToken };
}

/** Host adapter for ledger/smoke probes: seed only a declared first approach and fence every leg to one document. */
export async function runFloorGridRoute(page, plan, documentOrigin) {
  await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(plan)},${JSON.stringify(documentOrigin)})`);
  return page.evaluate(`(${driveFloorGrid.toString()})(${JSON.stringify(plan)},${JSON.stringify(documentOrigin)})`);
}

/** Keep one diagnostic ledger in the browser and mirror it to the harness before a document/process can disappear. */
export function installFloorGridProgress() {
  let last = null, sampled = -Infinity;
  window.__frameFloorGridProgress = () => {
    const stop = window.__frameFloorGridStop;
    if (!stop) return null;
    if (performance.now() - sampled < 1000 && last?.stop.leg === stop.leg && last.stop.phase === stop.phase) return last;
    try {
      const grid = window.__wildshard?.shard?.grid;
      if (!grid) return last;
      if (window.__wildshard?.world?.game?.renderer.getContext().isContextLost()) return last;
      const state = grid.state(), residency = grid.residency(), live = state.live?.live;
      // The GL census is installed only in travel configurations, so its global can be absent here.
      const contexts = '__sc_gl' in window ? window.__sc_gl() : null;
      last = { documentOrigin: performance.timeOrigin, sampledAt: Date.now(), seconds: performance.now() / 1000,
        stop: { ...stop }, current: live?.current, inside: state.inside, feet: live?.worldFeet, gameplayReady: live?.gameplayReady,
        memory: { modelledMB: state.playingMB ?? null, accountedBytes: state.accountedBytes ?? null,
          ...(contexts ? { glMB: contexts.reduce((sum, row) => sum + row.totalBytes, 0) / 1e6, glReconciled: contexts.every(row => row.reconciled) }
            : { glMB: null, glReconciled: null }), claims: residency.claims, cost: residency.cost } };
      sampled = performance.now(); return last;
    } catch { return last; } // Diagnostic reads must not replace the original route/renderer failure.
  };
}

/** A lost travel document is a measured runtime failure, even when its earlier cadence rows passed. */
export function gridFloorRuntimeFailure(last, diagnostic) {
  if (!last || !diagnostic || diagnostic.documentOrigin === last.documentOrigin || !Number.isFinite(diagnostic.documentOrigin)) return null;
  const reason = diagnostic.lastEnd?.at >= last.documentOrigin ? diagnostic.lastEnd.reason
    : diagnostic.lastUnload?.t >= last.documentOrigin ? diagnostic.lastUnload.reason : 'Document navigated during grid travel; recovery reason unavailable';
  return { kind: /GPU|graphics recovery|canvas.*wiped/iu.test(reason) ? 'gpu-recovery' : 'navigation',
    stop: last.stop, lastSample: last, recoveryReason: reason, nextDocumentOrigin: diagnostic.documentOrigin };
}

/** Restore only the first source pose after standing probes; let the owned shell enter its region through real fixed steps. */
export async function stageFloorGrid(plan, documentOrigin) {
  window.__frameFloorGridStop = { leg: plan.name, phase: 'source-admission', waypoint: null, target: plan.start ?? null };
  const deadline = performance.now() + 120000;
  const sameDocument = () => {
    if (typeof documentOrigin === 'number') return performance.timeOrigin === documentOrigin;
    const drift = performance.timeOrigin - documentOrigin.timeOrigin;
    window.__frameFloorGridOriginDrift = { deltaMs: drift, maximumAbsoluteMs: Math.max(Math.abs(drift), window.__frameFloorGridOriginDrift?.maximumAbsoluteMs ?? 0) };
    return window.__frameFloorGridDocumentToken === documentOrigin.token;
  };
  const readApi = () => {
    if (!sameDocument()) throw new Error('Grid floor document changed (navigation or graphics recovery)');
    return window.__wildshard;
  };
  let api = readApi();
  while (!api?.world?.game || !api.shard?.grid) {
    if (performance.now() >= deadline) throw new Error('Grid floor API did not become ready in its original document');
    await new Promise(resolve => { setTimeout(resolve, 100); }); api = readApi();
  }
  const world = api.world, player = world.player, input = world.game.app.input;
  const read = () => {
    if (readApi() !== api) throw new Error('Grid floor API was replaced during source admission');
    const state = api.shard.grid.state(); if (!state.live?.live) throw new Error('Grid live telemetry missing');
    return { ...state, claims: api.shard.grid.residency().claims };
  };
  const initial = read(), live = initial.live.live;
  if (live.current !== plan.from && !(plan.start && live.current === null)) throw new Error(`Grid floor starts in ${live.current}, expected ${plan.from}`);
  input.clear();
  if (plan.start) {
    const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
    await api.pose({ x: plan.start.x - origin.x, y: 0.55, z: plan.start.z - origin.z, yaw: 0, pitch: -0.08 });
  }
  while (performance.now() < deadline) {
    const state = read(), active = state.live.live;
    if (active.current === plan.from && state.inside === plan.from && active.gameplayReady && (plan.from === null || active.residents.includes(plan.from))) return state;
    if (!plan.start) throw new Error(`Grid floor source ${plan.from} is not an entered ready resident`);
    if (state.live.crossing.phase === 'blocked' || state.live.crossing.phase === 'save-failed') throw new Error(`Grid floor source blocked: ${state.live.crossing.issue}`);
    await new Promise(resolve => { setTimeout(resolve, 100); });
  }
  throw new Error(`Grid floor source ${plan.from} did not become an entered ready resident`);
}

/** This self-contained function is serialized into Chromium or Safari, without changing the game's fixed step. */
export async function driveFloorGrid(plan, documentOrigin) {
  window.__frameFloorGridStop = { leg: plan.name, phase: 'travel', waypoint: 0, target: plan.waypoints[0] ?? null };
  const api = window.__wildshard;
  const sameDocument = () => {
    if (typeof documentOrigin === 'number') return performance.timeOrigin === documentOrigin;
    const drift = performance.timeOrigin - documentOrigin.timeOrigin;
    window.__frameFloorGridOriginDrift = { deltaMs: drift, maximumAbsoluteMs: Math.max(Math.abs(drift), window.__frameFloorGridOriginDrift?.maximumAbsoluteMs ?? 0) };
    return window.__frameFloorGridDocumentToken === documentOrigin.token;
  };
  if (!sameDocument() || !api?.world?.game || !api.shard?.grid) throw new Error('Grid floor lost its ready document before travel (navigation or graphics recovery)');
  const world = api.world, player = world.player, input = world.game.app.input;
  const read = () => {
    if (!sameDocument() || window.__wildshard !== api) throw new Error('Grid floor document or API changed during travel (navigation or graphics recovery)');
    const state = api.shard.grid.state(); if (!state.live?.live) throw new Error('Grid live telemetry missing');
    return { ...state, claims: api.shard.grid.residency().claims };
  };
  const source = read(), live = source.live.live;
  if (live.current !== plan.from || source.inside !== plan.from || !live.gameplayReady || (plan.from !== null && !live.residents.includes(plan.from))) throw new Error(`Grid floor source ${plan.from} is not an entered ready resident`);
  const oldHover = player.hover, oldLimit = player.hoverSpeedLimit;
  const hoverMaxSpeed = plan.hoverMaxSpeed ?? 15;
  if (!Number.isFinite(hoverMaxSpeed) || hoverMaxSpeed <= 0 || hoverMaxSpeed > 30) throw new Error('Invalid grid harness hover speed');
  if (typeof oldLimit !== 'function') throw new Error('Grid hover-speed rule missing');
  input.clear();
  player.setHover(plan.movement !== 'road-hover' || live.current === null);
  let distance = 100;
  player.hoverSpeedLimit = () => Math.min(hoverMaxSpeed, oldLimit(), Math.max(3, distance * 1.5));
  const before = read(), trace = [], started = performance.now();
  try {
    await new Promise((resolve, reject) => {
      let stop = () => undefined, waypoint = 0, lastSample = -1;
      const timer = setTimeout(() => { stop(); input.clear(); reject(new Error(`Grid floor route ${plan.name} timed out`)); }, 150000);
      const finish = error => { stop(); clearTimeout(timer); input.clear(); if (error) reject(error instanceof Error ? error : new Error(String(error))); else resolve(undefined); };
      stop = world.game.watchFrames(() => {
        try {
          const state = read(), active = state.live.live, feet = active.worldFeet, seconds = (performance.now() - started) / 1000;
          window.__frameFloorGridStop = { leg: plan.name, phase: 'travel', waypoint, target: plan.waypoints[waypoint] ?? null };
          if (plan.movement === 'road-hover') player.setHover(active.current === null);
          if (seconds - lastSample >= 0.25) { trace.push({ seconds, ...feet, current: active.current, gameplayReady: active.gameplayReady, hover: player.hover }); lastSample = seconds; }
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
    window.__frameFloorGridStop = { leg: plan.name, phase: 'destination-standing', waypoint: plan.waypoints.length, target: null };
    return { plan, before, after: read(), trace, elapsedSeconds: (performance.now() - started) / 1000 };
  } finally { input.clear(); player.hoverSpeedLimit = oldLimit; player.setHover(oldHover); }
}

/** A visible destination without real frame commits or complete runtime residency never counts as this scenario. */
export function gridFloorWitnessFailures(result) {
  const { plan, before, after } = result, previous = before.live.live, active = after.live.live, failures = [];
  if (previous.current !== plan.from || before.inside !== plan.from || !previous.gameplayReady || (plan.from !== null && !previous.residents.includes(plan.from))) failures.push('Source interior gameplay or runtime residency was not ready');
  const count = active.crossings - previous.crossings;
  const transitions = count === 0 ? [] : active.transitions.slice(-count);
  const expected = plan.from === plan.to ? [] : [
    ...(plan.from === null ? [] : [{ from: plan.from, to: null }]),
    ...(plan.to === null ? [] : [{ from: null, to: plan.to }]),
  ];
  if (count !== expected.length || JSON.stringify(transitions) !== JSON.stringify(expected)) failures.push('Expected source/road/destination frame commits');
  if (active.current !== plan.to || after.inside !== plan.to || !active.gameplayReady) failures.push('Destination interior gameplay is not ready');
  if (plan.requiredResidents.some(id => !active.residents.includes(id))) failures.push('Required runtime residents are missing');
  if ((plan.retiredResidents ?? []).some(id => {
    if (active.residents.includes(id)) return true;
    if (after.claims === undefined) return true;
    return after.claims.some(claim => claim.owner === id && claim.category === 'sim');
  })) failures.push('Source runtime or its sim/basis claim was not retired');
  const cell = after.cells.find(row => row.instance === plan.to);
  if (plan.to !== null && (!cell || Math.abs(active.worldFeet.x - cell.cell[0] * 555) >= 250 || Math.abs(active.worldFeet.z - cell.cell[1] * 555) >= 250)) failures.push('Destination feet are outside its interior');
  if (plan.to === null && after.cells.some(row => Math.abs(active.worldFeet.x - row.cell[0] * 555) < 250 && Math.abs(active.worldFeet.z - row.cell[1] * 555) < 250)) failures.push('Road destination lies inside a shard');
  if (![active.worldFeet.x, active.worldFeet.y, active.worldFeet.z, result.elapsedSeconds].every(Number.isFinite)
    || result.elapsedSeconds <= 0 || result.trace.length === 0
    || result.trace.some(row => ![row.seconds, row.x, row.y, row.z].every(Number.isFinite) || row.y < -0.25)) failures.push('Route has no valid above-ground motion witness');
  return failures;
}
