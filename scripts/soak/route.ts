interface Cell { readonly instance: string; readonly slug: string; readonly cell: readonly number[] }
interface Point { readonly x: number; readonly z: number }
interface Step extends Point { readonly kind: string; readonly instance?: string; readonly slug?: string; readonly id?: string; readonly seconds?: number }
interface Gl { readonly totalBytes: number; readonly reconciled: boolean; readonly unlabelled: number; readonly unlabelledBytes?: number; readonly assets?: readonly { readonly owner: string; readonly bytes: number }[]; readonly accountedBytes: number | null; readonly cycle: number | null; readonly settled?: boolean; readonly at?: number }
/** Unlabelled GL bytes in a reading. A zero-byte handle created a moment before its label is a create-then-label race that
 * holds nothing; any unlabelled byte still fails sampling. Older readings without the byte field use their per-label groups
 * (the census files an unlabelled resource under owner `unlabelled`); a count with no bytes to show is a failure. */
export function soakUnlabelledBytes(gl: Gl): number {
  if (gl.unlabelledBytes !== undefined) return gl.unlabelledBytes;
  if (gl.unlabelled === 0) return 0;
  return gl.assets === undefined ? Number.POSITIVE_INFINITY : gl.assets.filter((group) => group.owner === 'unlabelled').reduce((sum, group) => sum + group.bytes, 0);
}
interface Sample { readonly type: string; readonly phase: string; readonly elapsed: number; readonly footprint: number; readonly interval?: number; readonly gl?: Gl }
interface Window { readonly start: number; readonly end: number }
interface Entry { readonly instance: string; readonly admitted: boolean }
interface Leak { readonly disposalErrors: readonly string[]; readonly scope: { readonly bodies: number; readonly colliders: number; readonly [key: string]: unknown }; readonly before?: { readonly events?: { readonly listeners: number; readonly answerers: number } }; readonly after: { readonly events?: { readonly listeners: number; readonly answerers: number }; readonly bodies: number; readonly colliders: number; readonly [key: string]: unknown } }
/** A picked visible content cut, distinct from invisible savings; the pinned run must contain this source revision. */
export interface SoakContentCut { readonly receipt: string; readonly sourceRevision: string; readonly approvedBy: 'Jake' }
/** Strict provenance prevents an unlabelled run from dropping the ordinary loop-bound gate. */
export function parseSoakContentCut(input: unknown): SoakContentCut {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid content-cut receipt');
  const receipt: unknown = Reflect.get(input, 'receipt'), sourceRevision: unknown = Reflect.get(input, 'sourceRevision'), approvedBy: unknown = Reflect.get(input, 'approvedBy');
  if (Object.keys(input).sort().join(',') !== 'approvedBy,receipt,sourceRevision' || approvedBy !== 'Jake'
    || typeof receipt !== 'string' || !/^(art|docs)\/[a-zA-Z0-9_./-]+$/u.test(receipt) || receipt.includes('..')
    || typeof sourceRevision !== 'string' || !/^[a-f0-9]{40}$/u.test(sourceRevision)) throw new Error('Invalid content-cut receipt');
  return { receipt, sourceRevision, approvedBy };
}
/** Ordinary routes are thirty minutes; a picked content-cut route qualifies at minute sixty (G186). */
export function soakDuration(contentCut?: SoakContentCut | null): number { return contentCut === undefined || contentCut === null ? 1800 : 3600; }
/** The drive's recorded boundaries, in the samples' wall-clock seconds: the worker's `driveStarted` and that plus its
 * final `seconds`. */
export interface SoakDrive { readonly start: number; readonly end: number }
/** The recorded boundaries of a run's drive, or null when the run never started one. A started drive with no end refuses. */
export function soakDriveBounds(result: { readonly driveStarted?: string; readonly seconds?: number }): SoakDrive | null {
  if (result.driveStarted === undefined) return null;
  const start = Date.parse(result.driveStarted) / 1000, seconds = result.seconds;
  if (!Number.isFinite(start) || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) throw new Error('Soak drive has no recorded end');
  return { start, end: start + seconds };
}
const drivePhase = /^(drive|settle)/u;
/** The phase is decided by the sample's timestamp against the recorded drive boundaries, not by the tag the sampler read
 * before it measured (it reads the phase file first, so a tag can only lag). A joined sample is timed by the LATEST
 * moment any part of it was read: `max(native timestamp, gl.at)`, so a GL half read after the drive's end (the teardown
 * had already freed GL) cannot set a drive trough (SF57, 83c719436's road leg). A drive or settle tag read after the
 * drive's end is `unloaded`; inside the window the worker's own sub-phase tags stand. Without boundaries, or with a drive
 * tag before the drive started, this refuses rather than guesses. */
export function soakPhaseByTime<T extends { readonly phase: string; readonly elapsed: number; readonly gl?: { readonly at?: number } }>(samples: readonly T[], drive: SoakDrive | null): T[] {
  if (drive !== null && (!Number.isFinite(drive.start) || !Number.isFinite(drive.end) || drive.end < drive.start)) throw new Error('Soak drive boundaries are invalid');
  return samples.map((row) => {
    if (!drivePhase.test(row.phase)) return row;
    if (drive === null) throw new Error('Soak drive samples need the recorded drive boundaries');
    if (row.elapsed < drive.start) throw new Error(`Soak sample tagged ${row.phase} before the recorded drive start`);
    const glAt = row.gl?.at, readAt = glAt !== undefined && Number.isFinite(glAt) ? Math.max(row.elapsed, glAt) : row.elapsed;
    return readAt > drive.end ? { ...row, phase: 'unloaded' } : row;
  });
}
interface Witness { readonly drive: SoakDrive | null; readonly samples: readonly Sample[]; readonly windows: readonly Window[]; readonly seconds: number; readonly circuits: number; readonly evictions: number; readonly errors: readonly string[]; readonly leak: Leak | null; readonly expected: readonly string[]; readonly entries: readonly Entry[]; readonly crossroads: readonly string[]; readonly engineBase?: number; readonly rehearsal?: boolean; readonly leg?: 'cells' | 'road'; readonly contentCut?: SoakContentCut | null }
interface Loop { cycle: number; complete: boolean; peakBytes: number; troughBytes: number }
interface Grade { contentCut: SoakContentCut | null; requiredSeconds: number; memoryPass: boolean; gatePass: boolean; peakBytes: number; loadingPeakBytes: number; phoneEstimateBytes: number; baselines: { start: number; end: number; samples: number; bytes: number | null }[]; baselineDeltaBytes: (number | null)[]; loops: Loop[]; recovery: boolean; calibration: boolean; ratios: { cycle: number; raw: number; adjusted: number }[]; missingGlSamples: number; sampling: boolean; leakZero: boolean; admitted: string[]; refused: string[]; attemptedEveryCell: boolean; crossroads: number; limitation: string | null; rehearsal: boolean }
/** The drive uses the admitted catalogue, never a second hand-maintained shard list. */
export function soakRoute(cells: readonly Cell[], pitch = 555, leg: 'cells' | 'road' = 'cells'): { reference: Point; steps: readonly Step[] } {
  const roads = [-1.5, -0.5, 0.5, 1.5].map((n) => n * pitch);
  const reference = { x: pitch / 2, z: 0 };
  const steps: Step[] = [];
  let here = reference;
  const move = (point: Point, kind = 'road', extra: Partial<Step> = {}): void => {
    steps.push({ ...point, kind, ...extra }); here = point;
  };
  const firstRoad = roads.at(0);
  if (firstRoad === undefined) throw new Error('Missing first road');
  move({ x: reference.x, z: firstRoad }); move({ x: firstRoad, z: firstRoad });
  for (let row = 0; row < roads.length; row++) {
    const columns = row % 2 === 0 ? roads : [...roads].reverse();
    const z = roads.at(row);
    if (z === undefined) throw new Error('Missing road row');
    for (let column = 0; column < columns.length; column++) {
      const x = columns.at(column), previous = column === 0 ? undefined : columns.at(column - 1);
      if (x === undefined) throw new Error('Missing road column');
      if (previous !== undefined && row < 3 && leg === 'cells') {
        const cx = (x + previous) / 2, cz = (row - 1) * pitch;
        const cell = cells.find((candidate) => candidate.cell[0] === cx / pitch && candidate.cell[1] === cz / pitch);
        // G198: an open plot is platform ground, never a cell to enter (`soakCatalogue` proves the nine are complete)
        if (cell === undefined) { move({ x, z }, 'crossroads', { id: `${x},${z}` }); continue; }
        move({ x: cx, z });
        // Walk 25 m past the south midpoint edge. A visible proxy never satisfies actual admission.
        move({ x: cx, z: cz - 225 }, 'enter', { instance: cell.instance, slug: cell.slug });
        move({ x: cx, z }, 'leave', { instance: cell.instance });
      }
      move({ x, z }, 'crossroads', { id: `${x},${z}` });
    }
  }
  move({ x: reference.x, z: here.z }); move(reference, 'baseline', { seconds: 20 });
  return { reference, steps };
}

/** Production catalogues exclude DEVSERVER additions in both gate layouts. */
export function soakCatalogue(grid: { readonly cells: readonly Cell[]; readonly developer: readonly Cell[]; readonly plots?: readonly Omit<Cell, 'slug'>[] }, layout: 'shipped' | 'dev'): readonly Cell[] {
  const selected = new Map(grid.cells.map((cell) => [cell.cell.join(','), cell]));
  if (layout === 'dev') for (const cell of grid.developer) selected.set(cell.cell.join(','), cell);
  const cells = [...selected.values()], plots = (grid.plots ?? []).filter((plot) => !selected.has(plot.cell.join(',')));
  // G198: the cells and the open plots left after the overrides fill all nine places once
  const nine = [...cells, ...plots];
  if (nine.length !== 9 || new Set(nine.map((cell) => cell.instance)).size !== 9 || new Set(nine.map((cell) => cell.cell.join(','))).size !== 9) throw new Error('Soak requires nine unique catalogue instances');
  return cells;
}
/** Exact identity is required: a DEVSERVER proxy never substitutes for a gate cell. */
export function validateSoakCatalogue(actual: readonly Cell[], expected: readonly Cell[]): boolean {
  const rows = (cells: readonly Cell[]): string[] => cells.map((cell) => `${cell.instance}:${cell.slug}:${cell.cell.join(',')}`).sort();
  return JSON.stringify(rows(actual)) === JSON.stringify(rows(expected));
}

const median = (values: readonly number[]): number => { const sorted = [...values].sort((a, b) => a - b); const result = sorted.at(Math.floor(sorted.length / 2)); if (result === undefined) throw new Error('No native readings'); return result; };
/** Grade native readings at the same road pose, after natural production eviction circuits. No reload is allowed. */
export function gradeSoak({ drive: driveBounds, samples: tagged, windows, seconds, circuits, evictions, errors, leak, expected, entries, crossroads, engineBase = 300_000_000, rehearsal = false, leg = 'cells', contentCut }: Witness): Grade {
  const cut = contentCut === undefined || contentCut === null ? null : parseSoakContentCut(contentCut);
  const requiredSeconds = soakDuration(cut);
  const samples = soakPhaseByTime(tagged, driveBounds);
  const combined = (row: Sample, peak = false): number => (peak ? Math.max(row.footprint, row.interval ?? row.footprint) : row.footprint) + (row.gl?.totalBytes ?? Number.POSITIVE_INFINITY);
  const active = samples.filter((row) => row.type === 'sample' && /^(baseline|drive|settle|unloaded)/u.test(row.phase));
  const drive = active.filter((row) => row.phase !== 'unloaded');
  const peakBytes = Math.max(0, ...drive.filter((row) => row.gl !== undefined).map((row) => combined(row, true)));
  const loading = samples.filter((row) => row.type === 'sample' && row.phase === 'loading');
  const loadingPeakBytes = Math.max(0, ...loading.filter((row) => row.gl !== undefined).map((row) => combined(row, true)));
  const baselines = windows.map((window) => {
    const points = samples.filter((row) => row.type === 'sample' && row.elapsed >= window.start && row.elapsed <= window.end);
    return { ...window, samples: points.length, bytes: points.length === 0 ? null : median(points.map((row) => combined(row))) };
  });
  const first = baselines.at(2)?.bytes;
  const baselineRecovery = first !== null && first !== undefined && baselines.length >= Math.max(2, circuits + 1)
    && baselines.every((row) => row.bytes !== null && row.samples >= 5)
    && baselines.slice(2).every((row) => row.bytes !== null && Math.abs(row.bytes - first) <= 30_000_000);
  const baselineDeltaBytes = baselines.map((row) => row.bytes === null || first === null || first === undefined ? null : row.bytes - first);
  const loops: Loop[] = [];
  for (let cycle = 0; cycle <= circuits; cycle++) {
    const rows = drive.filter((row) => row.gl?.cycle === cycle);
    if (rows.length > 0) loops.push({ cycle, complete: cycle < circuits, peakBytes: Math.max(...rows.map((row) => combined(row, true))), troughBytes: Math.min(...rows.map((row) => combined(row))) });
  }
  const loopTwo = loops.find((loop) => loop.cycle === 1);
  // Completed loops must repeat loop two. A partial lap has not visited every high/low-memory pose yet.
  const recovery = baselineRecovery && loopTwo?.complete === true && loops.filter((loop) => loop.cycle >= 1).every((loop) => loop.complete
    ? Math.abs(loop.peakBytes - loopTwo.peakBytes) <= 30_000_000 && Math.abs(loop.troughBytes - loopTwo.troughBytes) <= 30_000_000
    : loop.peakBytes <= loopTwo.peakBytes + 30_000_000 && loop.troughBytes >= loopTwo.troughBytes - 30_000_000);
  const ratios = windows.slice(1).flatMap((window, index) => {
    const points = samples.filter((row) => row.type === 'sample' && row.elapsed >= window.start && row.elapsed <= window.end && (row.gl?.accountedBytes ?? 0) > 0 && row.gl?.settled === true);
    if (points.length < 5) return [];
    const measured = median(points.map((row) => combined(row))), accounted = median(points.map((row) => row.gl?.accountedBytes ?? 0));
    return [{ cycle: index + 1, raw: measured / accounted, adjusted: (measured - engineBase) / accounted }];
  });
  const calibration = ratios.length === windows.length - 1 && ratios.every((ratio) => ratio.adjusted >= 1.01 && ratio.adjusted <= 1.21);
  // Initial boot samples remain loading evidence and must be sampled as well as active play.
  const covered = [...active, ...loading].sort((a, b) => a.elapsed - b.elapsed);
  const gaps = covered.slice(1).map((row, index) => row.elapsed - (covered.at(index)?.elapsed ?? row.elapsed));
  const missingGlSamples = [...drive, ...loading].filter((row) => row.gl === undefined).length;
  const sampling = loading.length > 0 && drive.length >= seconds * 0.95 && gaps.every((gap) => gap <= 2.5)
    && [...drive, ...loading].every((row) => row.footprint > 0 && row.gl?.reconciled === true && soakUnlabelledBytes(row.gl) === 0);
  const admitted = expected.filter((id) => entries.some((row) => row.instance === id && row.admitted));
  const refused = expected.filter((id) => !admitted.includes(id));
  const visited = expected.every((id) => entries.some((row) => row.instance === id));
  const zeroCensus = (value: unknown): boolean => typeof value === 'number' ? value === 0 : value !== null && typeof value === 'object' && Object.values(value).every(zeroCensus);
  const leakZero = leak?.disposalErrors.length === 0
    && zeroCensus(leak.scope) && leak.after.bodies === 0 && leak.after.colliders === 0
    && zeroCensus({ ...leak.after, events: {
      listeners: (leak.after.events?.listeners ?? 0) - (leak.before?.events?.listeners ?? 0),
      answerers: (leak.after.events?.answerers ?? 0) - (leak.before?.events?.answerers ?? 0),
    } });
  // G186 amends the ordinary drift rule only after a picked content cut. Invisible savings keep it gated.
  const memoryPass = (cut !== null || recovery) && seconds >= requiredSeconds && circuits >= 2 && (leg === 'road' ? entries.length === 0 : evictions > 0) && sampling && peakBytes <= 1_000_000_000 && loadingPeakBytes <= 1_800_000_000 && calibration && leakZero && errors.length === 0;
  return { contentCut: cut, requiredSeconds, memoryPass, gatePass: !rehearsal && memoryPass && refused.length === 0 && visited && new Set(crossroads).size === 16,
    peakBytes, loadingPeakBytes, phoneEstimateBytes: peakBytes * 1.4, baselines, baselineDeltaBytes, loops, recovery, calibration, ratios, missingGlSamples, sampling, leakZero, admitted, refused, attemptedEveryCell: visited, crossroads: new Set(crossroads).size, rehearsal,
    limitation: refused.length === 0 ? null : 'Some cells were not admitted; see refusal records. A far proxy is not an entry. This rehearsal cannot close SF57; rerun after SF46–48.' };
}
