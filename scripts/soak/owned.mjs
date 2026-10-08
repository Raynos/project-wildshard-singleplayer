/** Owned-shell SF57 plans share the floor driver's controls and document/frame fences.
 * @param {Pick<import('../frame-floor-grid.mjs').FloorGridState, 'home' | 'cells'>} state
 * @param {'cells' | 'road'} leg
 */
export function ownedSoakPlans(state, leg = 'cells') {
  const pitch = 555, half = pitch / 2, inset = 230;
  const home = state.cells.find(cell => cell.instance === state.home);
  if (home?.slug !== 'driftwood-isle') throw new Error('Soak requires the Driftwood owned home');
  const origin = cell => ({ x: cell.cell[0] * pitch, z: cell.cell[1] * pitch });
  const h = origin(home), reference = { x: h.x, z: h.z + inset };
  if (leg === 'road') {
    const roads = [-1.5, -0.5, 0.5, 1.5].map(n => n * pitch), points = [];
    for (const [row, z] of roads.entries()) for (const x of row % 2 ? [...roads].reverse() : roads) points.push({ x, z });
    const first = points.at(0);
    if (!first) throw new Error('Missing road circuit');
    const start = { x: half, z: first.z };
    points.push({ x: half, z: points.at(-1).z }, start);
    return { reference: start, plans: points.map((point, index) => ({ name: `road-${index}`, from: null, to: null,
      movement: 'road-hover', hoverMaxSpeed: 30, waypoints: [point], requiredResidents: [], crossroads: index < 16 ? `${point.x},${point.z}` : null })) };
  }
  const pine = state.cells.find(cell => cell.slug === 'pine-hollow'), nalati = state.cells.find(cell => cell.slug === 'nalati-grasslands');
  if (!pine || !nalati) throw new Error('Soak requires Pine and Nalati');
  const remaining = state.cells.filter(cell => ![home.instance, pine.instance, nalati.instance].includes(cell.instance))
    .sort((a, b) => Number(b.slug === '_template') - Number(a.slug === '_template') || a.instance.localeCompare(b.instance));
  const sequence = [pine, nalati, ...remaining, home], plans = [];
  let source = home, portal = { x: h.x, z: h.z + half };
  for (const cell of sequence) {
    const s = origin(source), d = origin(cell), dx = s.x - d.x, dz = s.z - d.z;
    // Midpoint sockets only. Return to precisely the first home pose for each lap's settled baseline.
    const horizontal = cell !== home && Math.abs(dx) >= Math.abs(dz);
    const sign = cell === home ? 1 : Math.sign(horizontal ? dx : dz) || 1;
    const nextPortal = horizontal ? { x: d.x + sign * half, z: d.z } : { x: d.x, z: d.z + sign * half };
    const destination = horizontal ? { x: d.x + sign * inset, z: d.z } : { x: d.x, z: d.z + sign * inset };
    const waypoints = [portal];
    if (portal.x !== nextPortal.x || portal.z !== nextPortal.z) {
      // Reach a road intersection before turning; a straight diagonal cuts across an unentered cell.
      const intersection = (p, toward) => Number.isInteger(p.x / pitch)
        ? { x: p.x + (Math.sign(toward.x - p.x) || 1) * half, z: p.z }
        : { x: p.x, z: p.z + (Math.sign(toward.z - p.z) || 1) * half };
      const a = intersection(portal, nextPortal), b = intersection(nextPortal, portal);
      waypoints.push(a, { x: b.x, z: a.z }, b, nextPortal);
    }
    waypoints.push(destination);
    const unique = waypoints.filter((point, index) => index === 0 || point.x !== waypoints[index - 1].x || point.z !== waypoints[index - 1].z);
    plans.push({ name: `${source.instance}-to-${cell.instance}`, from: source.instance, to: cell.instance,
      movement: 'road-hover', hoverMaxSpeed: 30, waypoints: unique, requiredResidents: [cell.instance], retiredResidents: ['driftwood-isle', 'pine-hollow', 'nalati-grasslands'].includes(source.slug) ? [source.instance] : [] });
    source = cell; portal = nextPortal;
  }
  const road = ownedSoakPlans(state, 'road');
  const first = road.plans[0].waypoints[0];
  const coveragePlans = [{ name: 'home-to-road-tour', from: home.instance, to: null, movement: 'road-hover', hoverMaxSpeed: 30,
    waypoints: [{ x: h.x, z: h.z + half }, { x: first.x, z: h.z + half }, first], requiredResidents: [], retiredResidents: [home.instance] },
    ...road.plans, { name: 'road-tour-to-home', from: null, to: home.instance, movement: 'road-hover', hoverMaxSpeed: 30,
      waypoints: [{ x: half, z: h.z + half }, { x: h.x, z: h.z + half }, reference], requiredResidents: [home.instance] }];
  return { reference, plans, coveragePlans };
}

/** A dry run never widens or substitutes for the thirty-minute gate. */
export function soakRunPolicy(/** @type {boolean} */ dryRun, /** @type {import('./route.ts').SoakContentCut | null} */ contentCut = null) {
  const seconds = dryRun ? 300 : contentCut === null ? 1800 : 3600;
  return { seconds, samplerSeconds: seconds + 700, leaseMinutes: Math.ceil((seconds + 850) / 60), dryRun };
}

/** Match native and GL samples by wall timestamp, retaining missing reads as failures. GPU stays separate. */
export function joinSoakSamples(native, gl, gamePid = /** @type {number | null} */ (null)) {
  let cursor = 0;
  const samples = [];
  for (const row of native) {
    if (row.type !== 'sample') continue;
    const elapsed = Date.parse(row.t) / 1000;
    while (cursor + 1 < gl.length && gl[cursor + 1].at <= elapsed) cursor++;
    const left = gl[cursor], right = gl[cursor + 1];
    const closest = right && (!left || Math.abs(right.at - elapsed) < Math.abs(left.at - elapsed)) ? right : left;
    const sample = { ...row }; sample.elapsed = elapsed;
    if (gamePid !== null) {
      sample.gamePid = gamePid; sample.allWebContentBytes = row.footprint; sample.allWebContentIntervalBytes = row.interval;
      // Cold navigation/install overlap remains conservatively aggregated. Playing follows one verified game PID.
      if (row.phase !== 'loading') {
        const process = row.pids?.[gamePid];
        sample.footprint = process?.[0] ?? 0; sample.interval = process?.[1] ?? 0;
      }
    }
    if (closest && Math.abs(closest.at - elapsed) <= 1.5) sample.gl = closest;
    samples.push(sample);
  }
  return samples;
}

/** Safari returns Promise handles, so poll a fenced result envelope while sampling continues. */
export function soakAsyncEvaluator(raw, observe = () => Promise.resolve(), timeout = 190000) {
  let sequence = 0, nextObservation = 0;
  return async expression => {
    const key = `__sf57Evaluation${++sequence}`;
    const identity = await raw(`(() => {const token=window.__sf57DocumentId;if(!token)throw Error('Missing soak document token');window[${JSON.stringify(key)}]={done:false};Promise.resolve().then(()=>(${expression})).then(value=>{window[${JSON.stringify(key)}]={done:true,value};},error=>{window[${JSON.stringify(key)}]={done:true,error:String(error)};});return token;})()`);
    const started = Date.now();
    try {
      while (Date.now() - started < timeout) {
        const envelope = await raw(`JSON.stringify({token:window.__sf57DocumentId,state:window[${JSON.stringify(key)}]??null})`);
        const row = JSON.parse(envelope);
        if (row.token !== identity) throw new Error('Soak document changed (navigation or graphics recovery)');
        if (Date.now() >= nextObservation) { nextObservation = Date.now() + 1000; await observe(); }
        if (row.state?.done) { if (row.state.error) throw new Error(row.state.error); return row.state.value; }
        await new Promise(resolve => { setTimeout(resolve, 100); });
      }
      throw new Error('Soak route evaluation timed out');
    } finally { await raw(`delete window[${JSON.stringify(key)}]`).catch(() => undefined); }
  };
}

/** Per-lap ruler and separate diagnostics; a partial last lap remains visibly partial. */
export function soakLapMemory(samples, circuits) {
  const cycles = new Map();
  for (const row of samples) {
    if (!/^(drive|settle)/u.test(row.phase) || row.gl?.cycle === null || row.gl?.cycle === undefined) continue;
    const cycle = row.gl.cycle;
    const lap = cycles.get(cycle) ?? { cycle, complete: cycle < circuits, samples: 0, peakBytes: 0,
      troughBytes: Infinity, webContentPeakBytes: 0, allWebContentPeakBytes: 0, glPeakBytes: 0, accountedPeakBytes: 0, gpuProcessPeakBytes: 0, wasmPeakBytes: 0 };
    const wc = Math.max(row.footprint, row.interval ?? row.footprint);
    lap.samples++; lap.peakBytes = Math.max(lap.peakBytes, wc + row.gl.totalBytes);
    lap.troughBytes = Math.min(lap.troughBytes, row.footprint + row.gl.totalBytes);
    lap.allWebContentPeakBytes = Math.max(lap.allWebContentPeakBytes, row.allWebContentBytes ?? row.footprint);
    lap.webContentPeakBytes = Math.max(lap.webContentPeakBytes, wc); lap.glPeakBytes = Math.max(lap.glPeakBytes, row.gl.totalBytes);
    lap.accountedPeakBytes = Math.max(lap.accountedPeakBytes, row.gl.accountedBytes ?? 0);
    lap.gpuProcessPeakBytes = Math.max(lap.gpuProcessPeakBytes, row.gpu ?? 0);
    lap.wasmPeakBytes = Math.max(lap.wasmPeakBytes, (row.gl.wasm ?? []).reduce((sum, memory) => sum + memory.bytes, 0));
    cycles.set(cycle, lap);
  }
  const laps = [];
  for (const lap of cycles.values()) { lap.overCapBytes = Math.max(0, lap.peakBytes - 1e9); laps.push(lap); }
  return laps;
}


/** Fix the game PID after admission, never switch to a smaller process if the game later dies. */
export function soakGamePid(native) {
  const row = native.findLast(value => value.type === 'sample');
  const selected = Object.entries(row?.pids ?? {}).sort((a, b) => b[1][0] - a[1][0]).at(0);
  if (!selected || selected[1][0] <= 0) throw new Error('Missing native game WebContent PID after admission');
  return Number(selected[0]);
}
