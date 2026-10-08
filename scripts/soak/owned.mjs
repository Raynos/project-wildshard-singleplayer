/** Owned-shell SF57 plans share the floor driver's controls and document/frame fences.
 * @param {Pick<import('../frame-floor-grid.mjs').FloorGridState, 'home' | 'cells'>} state
 * @param {'cells' | 'road'} leg
 * @param {'catalogue' | 'prepared'} routeScope
 */
export function ownedSoakPlans(state, leg = 'cells', routeScope = 'catalogue') {
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
  const omitted = routeScope === 'prepared' ? state.cells.filter(cell => !['driftwood-isle', 'pine-hollow', 'nalati-grasslands', '_template'].includes(cell.slug)).map(cell => cell.instance) : [];
  const remaining = state.cells.filter(cell => ![home.instance, pine.instance, nalati.instance, ...omitted].includes(cell.instance))
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
  return { reference, plans, coveragePlans, omitted };
}

/** A prepared-cell functional rehearsal cannot claim the full-catalogue memory gate. */
export function soakRouteScope(/** @type {string} */ value = 'catalogue', /** @type {boolean} */ qualifying = false) {
  if (value !== 'catalogue' && value !== 'prepared') throw new Error('Unknown soak route scope');
  if (value === 'prepared' && qualifying) throw new Error('Prepared-cell subset is rehearsal only');
  return value;
}

/** A dry run never widens or substitutes for the thirty-minute gate. */
export function soakRunPolicy(/** @type {boolean} */ dryRun, /** @type {import('./route.ts').SoakContentCut | null} */ contentCut = null) {
  const seconds = dryRun ? 300 : contentCut === null ? 1800 : 3600;
  return { seconds, samplerSeconds: seconds + 700, leaseMinutes: Math.ceil((seconds + 850) / 60), dryRun };
}

/** A borrowed preview stays with its owner, including when the soak fails. */
export async function releaseSoakPreviews(/** @type {readonly {base:string}[]} */ bases,
  /** @type {(base:string)=>Promise<void>} */ stop, /** @type {boolean} */ borrowed) {
  if (borrowed) return;
  for (const { base } of bases) await stop(base).catch(() => undefined);
}

/** Match native and GL samples by wall timestamp, retaining missing reads as failures. GPU stays separate. */
export function joinSoakSamples(native, gl, gamePid = /** @type {number | null} */ (null), loadingEvents = []) {
  let cursor = 0;
  const samples = [];
  const loading = loadingGlSamples(loadingEvents, native.filter(row => row.type === 'sample' && row.phase === 'loading').map(row => Date.parse(row.t) / 1000), gl);
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
    if (row.phase === 'loading' && loading.has(elapsed)) sample.gl = loading.get(elapsed);
    else if (closest && Math.abs(closest.at - elapsed) <= 1.5) sample.gl = closest;
    samples.push(sample);
  }
  return samples;
}

/** Replay every loading allocation/label mutation; never infer state outside explicit begin/stop coverage. */
export function loadingGlSamples(events, timestamps, observed = []) {
  const sorted = [...events].sort((a, b) => a.at - b.at), result = new Map();
  const first = sorted.find(row => row.op === 'begin'), last = sorted.findLast(row => row.op === 'stop');
  if (!first || !last) return result;
  const sequences = new Map(), endings = new Map();
  for (const event of sorted) {
    const previous = sequences.get(event.document);
    if (previous === undefined ? event.op !== 'begin' || event.sequence !== 0 : event.sequence !== previous + 1) return result;
    sequences.set(event.document, event.sequence);
    endings.set(event.document, event.op);
  }
  if ([...endings.values()].some(op => op !== 'end' && op !== 'stop') || sorted.filter(row => row.op === 'stop').length !== 1) return result;
  const resources = new Map(), labels = new Map(); let cursor = 0;
  for (const at of [...new Set([...timestamps, ...observed.map(row => row.at)])].sort((a, b) => a - b)) {
    if (at < first.at || at > last.at) continue;
    while (cursor < sorted.length && sorted[cursor].at <= at) {
      const event = sorted[cursor++], key = `${event.document}:${event.id}`;
      if (event.op === 'end') {
        for (const [id, resource] of resources) if (resource.document === event.document) resources.delete(id);
        for (const id of labels.keys()) if (id.startsWith(`${event.document}:`)) labels.delete(id);
      } else if (event.op === 'label') {
        const tag = { owner: event.owner, asset: event.asset, labelled: true }; labels.set(key, tag);
        if (resources.has(key)) resources.set(key, { ...resources.get(key), ...tag });
      } else if (event.op === 'allocation') {
        if (event.bytes === null) resources.delete(key);
        else resources.set(key, { ...event, ...labels.get(key) });
      }
    }
    let totalBytes = 0, textures = 0, renderbuffers = 0, buffers = 0, unlabelled = 0;
    for (const resource of resources.values()) {
      totalBytes += resource.bytes; if (!resource.labelled) unlabelled++;
      if (resource.kind === 'texture') textures += resource.bytes;
      else if (resource.kind === 'renderbuffer') renderbuffers += resource.bytes;
      else if (resource.kind === 'buffer') buffers += resource.bytes;
    }
    result.set(at, { at, totalBytes, textures, renderbuffers, buffers, unlabelled,
      reconciled: totalBytes === textures + renderbuffers + buffers, accountedBytes: null, cycle: null,
      source: 'complete loading allocation journal', journalFrom: first.at, journalThrough: last.at });
  }
  for (const snapshot of observed) {
    const replay = result.get(snapshot.at);
    if (replay && (replay.totalBytes !== snapshot.totalBytes || replay.unlabelled !== snapshot.unlabelled || replay.reconciled !== snapshot.reconciled)) return new Map();
  }
  return result;
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

/** Retry only WebKit's premeasurement process-target transition; runtime/game failures remain fatal.
 * @template T
 * @param {() => Promise<T>} poll
 * @param {boolean} beforeMeasurement
 * @returns {Promise<T | false>}
 */
export async function soakBootPoll(poll, beforeMeasurement) {
  try { return await poll(); }
  catch (error) {
    if (beforeMeasurement && error instanceof Error && error.message === "'Runtime' domain was not found") return false;
    throw error;
  }
}
