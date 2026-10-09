import { publicGridIntentCode } from '../public-grid.mjs';
import { gridFloorWitnessFailures } from '../frame-floor-grid.mjs';

/** Reuse the floor's pre-release tap intent; the public menu gate and Developer mode never change.
 * @param {string} layout */
export function soakGridEntry(layout) {
  if (layout !== 'dev' && layout !== 'shipped') throw new Error('Unknown soak layout');
  const publicGrid = layout === 'shipped';
  // The public page borrows Driftwood as its level for the page lifetime; Developer homes are owned regions.
  return { titleTap: !publicGrid, level: publicGrid ? 'driftwood-isle' : 'platform.grid', home: publicGrid ? 'borrowed' : 'owned',
    query: publicGrid ? '?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0' : '?mute=1&nolock=1&sw=0',
    fixture: publicGrid ? publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' }) : '' };
}

/** Owned-shell SF57 plans share the floor driver's controls and document/frame fences.
 * A borrowed home (the public page level) is a source and destination, never a regional resident: it is retained
 * for the page lifetime, so legs neither require it as a resident nor demand its retirement. soakWitnessFailures
 * proves the same positive page claim instead.
 * @param {Pick<import('../frame-floor-grid.mjs').FloorGridState, 'home' | 'cells'>} state
 * @param {'cells' | 'road'} leg
 * @param {'catalogue' | 'prepared'} routeScope
 * @param {string} homeMode 'owned' (Developer grid) or 'borrowed' (public page level)
 */
export function ownedSoakPlans(state, leg = 'cells', routeScope = 'catalogue', homeMode = 'owned') {
  if (homeMode !== 'owned' && homeMode !== 'borrowed') throw new Error('Unknown soak home mode');
  const route = ownedHomeSoakPlans(state, leg, routeScope);
  if (homeMode === 'owned') return route;
  const home = state.home;
  /** @param {SoakPlan} plan @returns {SoakPlan} */
  const borrow = plan => ({ ...plan, borrowedHome: home, requiredResidents: plan.requiredResidents.filter(id => id !== home),
    retiredResidents: (plan.retiredResidents ?? []).filter(id => id !== home) });
  // The public page boots inside its borrowed home, so the road-only leg first leaves it, once, by the same road the
  // cells leg's crossroads tour takes; every lap after that is the unchanged boulevard circuit (no shard entered).
  const leadIn = leg === 'road' ? ownedHomeSoakPlans(state, 'cells', routeScope).coveragePlans?.slice(0, 1) ?? [] : [];
  if (leg === 'road' && leadIn.length !== 1) throw new Error('Missing borrowed-home road lead-in');
  const reference = leg === 'road' ? ownedHomeSoakPlans(state, 'cells', routeScope).reference : route.reference;
  return { ...route, reference, plans: route.plans.map(borrow), ...(route.coveragePlans ? { coveragePlans: route.coveragePlans.map(borrow) } : {}),
    ...(leadIn.length > 0 ? { leadIn: leadIn.map(plan => borrow({ ...plan, name: 'home-to-road' })) } : {}) };
}

/** @typedef {{ name: string, from: string | null, to: string | null, movement: string, hoverMaxSpeed: number,
 *   waypoints: {x:number,z:number}[], requiredResidents: string[], retiredResidents?: string[], crossroads?: string | null,
 *   borrowedHome?: string }} SoakPlan */
/** @typedef {{ reference: {x:number,z:number}, plans: SoakPlan[], coveragePlans?: SoakPlan[], leadIn?: SoakPlan[], omitted?: string[] }} SoakRoute */

/** Strict borrowed-home witness on top of the floor's: the page level and its `sim:<home>` claim survive every leg.
 * @param {Parameters<typeof gridFloorWitnessFailures>[0]} witness */
export function soakWitnessFailures(witness) {
  const failures = gridFloorWitnessFailures(witness), { plan, before, after } = witness, home = plan.borrowedHome;
  if (home === undefined) return failures;
  for (const [label, state] of /** @type {const} */ ([['source', before], ['destination', after]])) {
    const page = state.borrowedHome, cell = state.cells.find(row => row.instance === home);
    if (state.home !== home || page?.instance !== home || page.level !== cell?.slug || !Number.isSafeInteger(page.bytes) || page.bytes <= 0) {
      failures.push(`Borrowed home is not the ${label} page level with a positive claim`);
    } else if (!(state.claims ?? []).some(claim => claim.id === `sim:${home}` && claim.category === 'sim' && claim.owner === home && claim.bytes === page.bytes)) {
      failures.push(`Borrowed home ${label} residency claim was not retained`);
    }
    if (state.live.live.residents.includes(home)) failures.push(`Borrowed home also became a regional ${label} resident`);
  }
  return failures;
}

/** @param {Pick<import('../frame-floor-grid.mjs').FloorGridState, 'home' | 'cells'>} state
 * @param {'cells' | 'road'} leg @param {'catalogue' | 'prepared'} routeScope */
function ownedHomeSoakPlans(state, leg, routeScope) {
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
  if (routeScope === 'prepared' && (!pine || !nalati)) throw new Error('Prepared soak requires Pine and Nalati');
  const runtimes = [pine, nalati].filter(cell => cell !== undefined);
  const omitted = routeScope === 'prepared' ? state.cells.filter(cell => !['driftwood-isle', 'pine-hollow', 'nalati-grasslands', '_template'].includes(cell.slug)).map(cell => cell.instance) : [];
  const remaining = state.cells.filter(cell => ![home.instance, ...runtimes.map(runtime => runtime.instance), ...omitted].includes(cell.instance))
    .sort((a, b) => Number(b.slug === '_template') - Number(a.slug === '_template') || a.instance.localeCompare(b.instance));
  const sequence = [...runtimes, ...remaining, home], plans = [];
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
  const road = ownedHomeSoakPlans(state, 'road', routeScope);
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
export function joinSoakSamples(native, gl, gamePid = /** @type {number | null} */ (null), journalEvents = []) {
  let cursor = 0;
  const samples = [];
  const journal = loadingGlSamples(journalEvents, native.filter(row => row.type === 'sample').map(row => Date.parse(row.t) / 1000), gl);
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
    if (row.phase === 'loading' && journal.has(elapsed)) sample.gl = journal.get(elapsed);
    else if (closest && Math.abs(closest.at - elapsed) <= 1.5) sample.gl = closest;
    else if (journal.get(elapsed)?.cycle !== null && journal.get(elapsed)?.cycle !== undefined) sample.gl = journal.get(elapsed);
    samples.push(sample);
  }
  return samples;
}

/** Replay complete boot/drive mutations. Cycle markers identify playing laps; allocator and settled state stay unknown. */
export function loadingGlSamples(events, timestamps, observed = []) {
  const sorted = [...events].sort((a, b) => a.at - b.at), result = new Map();
  const first = sorted.find(row => row.op === 'begin'), last = sorted.findLast(row => row.op === 'stop');
  if (!first || !last) return result;
  const sequences = new Map(), endings = new Map(), cycles = new Map();
  for (const event of sorted) {
    if (!Number.isFinite(event.at) || !['begin', 'end', 'stop', 'allocation', 'label', 'cycle', 'context'].includes(event.op)) return result;
    if (event.op === 'context' && (typeof event.context !== 'string' || !['observed', 'lost', 'restored'].includes(event.state))) return result;
    const previous = sequences.get(event.document);
    if (previous === undefined ? event.op !== 'begin' || event.sequence !== 0 : event.sequence !== previous + 1) return result;
    if (previous !== undefined && event.op === 'begin') return result;
    if (endings.get(event.document) === 'end' || endings.get(event.document) === 'stop') return result;
    if (event.op === 'cycle') {
      const previousCycle = cycles.get(event.document);
      if (!Number.isSafeInteger(event.cycle) || event.cycle < 0 || (previousCycle === undefined ? event.cycle !== 0
        : event.cycle < previousCycle || event.cycle > previousCycle + 1)) return result;
      cycles.set(event.document, event.cycle);
    }
    if (event.op === 'allocation' && (typeof event.id !== 'string' || !['texture', 'renderbuffer', 'buffer'].includes(event.kind)
      || (event.bytes !== null && (!Number.isSafeInteger(event.bytes) || event.bytes < 0)))) return result;
    sequences.set(event.document, event.sequence);
    endings.set(event.document, event.op);
  }
  if ([...endings.values()].some(op => op !== 'end' && op !== 'stop') || sorted.filter(row => row.op === 'stop').length !== 1) return result;
  const positions = new Map(sorted.map((event, index) => [`${event.document}:${event.sequence}`, index]));
  const cutoff = at => {
    let low = 0, high = sorted.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (sorted[middle].at <= at) low = middle + 1; else high = middle; }
    return low;
  };
  const targets = timestamps.map(at => ({ at, through: cutoff(at) }));
  for (const snapshot of observed) {
    if (snapshot.at < first.at || snapshot.at > last.at) continue;
    let through = cutoff(snapshot.at);
    if (snapshot.journal !== undefined && snapshot.journal !== null) {
      const { document, sequence } = snapshot.journal, index = positions.get(`${document}:${sequence}`);
      if (typeof document !== 'string' || !Number.isSafeInteger(sequence) || index === undefined
        || sorted[index].at > snapshot.at || (sorted[index + 1] && sorted[index + 1].at < snapshot.at)) return new Map();
      through = index + 1;
    }
    targets.push({ at: snapshot.at, through, snapshot });
  }
  const resources = new Map(), labels = new Map(); let cursor = 0, cycle = null;
  // A census and later uploads may share Date.now's millisecond. The captured sequence is its exact cut.
  for (const { at, through, snapshot } of targets.sort((a, b) => a.through - b.through || a.at - b.at)) {
    if (at < first.at || at > last.at) continue;
    while (cursor < through) {
      const event = sorted[cursor++], key = `${event.document}:${event.id}`;
      if (event.op === 'begin') cycle = null;
      else if (event.op === 'cycle') cycle = event.cycle;
      else if (event.op === 'end') {
        cycle = null;
        for (const [id, resource] of resources) if (resource.document === event.document) resources.delete(id);
        for (const id of labels.keys()) if (id.startsWith(`${event.document}:`)) labels.delete(id);
      } else if (event.op === 'label') {
        const tag = { owner: event.owner, asset: event.asset, labelled: true }; labels.set(key, tag);
        if (resources.has(key)) resources.set(key, { ...resources.get(key), ...tag });
      } else if (event.op === 'allocation') {
        if (event.bytes === null) { resources.delete(key); labels.delete(key); }
        else resources.set(key, { ...event, ...labels.get(key) });
      }
    }
    let totalBytes = 0, textures = 0, renderbuffers = 0, buffers = 0, unlabelled = 0, unlabelledBytes = 0;
    for (const resource of resources.values()) {
      totalBytes += resource.bytes; if (!resource.labelled) { unlabelled++; unlabelledBytes += resource.bytes; }
      if (resource.kind === 'texture') textures += resource.bytes;
      else if (resource.kind === 'renderbuffer') renderbuffers += resource.bytes;
      else if (resource.kind === 'buffer') buffers += resource.bytes;
    }
    const replay = { at, totalBytes, textures, renderbuffers, buffers, unlabelled, unlabelledBytes,
      reconciled: totalBytes === textures + renderbuffers + buffers, accountedBytes: null, cycle,
      source: 'complete GL allocation journal', journalFrom: first.at, journalThrough: last.at };
    if (snapshot && (replay.totalBytes !== snapshot.totalBytes || replay.unlabelled !== snapshot.unlabelled || replay.reconciled !== snapshot.reconciled
      || (snapshot.unlabelledBytes !== undefined && replay.unlabelledBytes !== snapshot.unlabelledBytes)
      || ['textures', 'renderbuffers', 'buffers', 'cycle'].some(key => snapshot[key] !== undefined && replay[key] !== snapshot[key]))) return new Map();
    result.set(at, replay);
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
