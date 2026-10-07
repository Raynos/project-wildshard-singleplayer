interface Cell { readonly instance: string; readonly slug: string; readonly cell: readonly number[] }
interface Point { readonly x: number; readonly z: number }
interface Step extends Point { readonly kind: string; readonly instance?: string; readonly slug?: string; readonly id?: string; readonly seconds?: number }
interface Gl { readonly totalBytes: number; readonly reconciled: boolean; readonly unlabelled: number; readonly accountedBytes: number | null; readonly cycle: number | null; readonly settled?: boolean }
interface Sample { readonly type: string; readonly phase: string; readonly elapsed: number; readonly footprint: number; readonly interval?: number; readonly gl?: Gl }
interface Window { readonly start: number; readonly end: number }
interface Entry { readonly instance: string; readonly admitted: boolean }
interface Leak { readonly disposalErrors: readonly string[]; readonly scope: { readonly bodies: number; readonly colliders: number; readonly [key: string]: unknown }; readonly before?: { readonly events?: { readonly listeners: number; readonly answerers: number } }; readonly after: { readonly events?: { readonly listeners: number; readonly answerers: number }; readonly bodies: number; readonly colliders: number; readonly [key: string]: unknown } }
interface Witness { readonly samples: readonly Sample[]; readonly windows: readonly Window[]; readonly seconds: number; readonly circuits: number; readonly evictions: number; readonly errors: readonly string[]; readonly leak: Leak | null; readonly expected: readonly string[]; readonly entries: readonly Entry[]; readonly crossroads: readonly string[]; readonly engineBase?: number; readonly rehearsal?: boolean; readonly leg?: 'cells' | 'road' }
interface Loop { cycle: number; peakBytes: number; troughBytes: number }
interface Grade { memoryPass: boolean; gatePass: boolean; peakBytes: number; loadingPeakBytes: number; phoneEstimateBytes: number; baselines: { start: number; end: number; samples: number; bytes: number | null }[]; baselineDeltaBytes: (number | null)[]; loops: Loop[]; recovery: boolean; calibration: boolean; ratios: { cycle: number; raw: number; adjusted: number }[]; missingGlSamples: number; sampling: boolean; leakZero: boolean; admitted: string[]; refused: string[]; attemptedEveryCell: boolean; crossroads: number; limitation: string | null; rehearsal: boolean }
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
        if (cell === undefined) throw new Error('Incomplete nine-cell soak catalogue');
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
export function soakCatalogue(grid: { readonly cells: readonly Cell[]; readonly developer: readonly Cell[] }, layout: 'shipped' | 'dev'): readonly Cell[] {
  const selected = new Map(grid.cells.map((cell) => [cell.cell.join(','), cell]));
  if (layout === 'dev') for (const cell of grid.developer) selected.set(cell.cell.join(','), cell);
  const cells = [...selected.values()];
  if (cells.length !== 9 || new Set(cells.map((cell) => cell.instance)).size !== 9) throw new Error('Soak requires nine unique catalogue instances');
  return cells;
}
/** Exact identity is required: a DEVSERVER proxy never substitutes for a gate cell. */
export function validateSoakCatalogue(actual: readonly Cell[], expected: readonly Cell[]): boolean {
  const rows = (cells: readonly Cell[]): string[] => cells.map((cell) => `${cell.instance}:${cell.slug}:${cell.cell.join(',')}`).sort();
  return JSON.stringify(rows(actual)) === JSON.stringify(rows(expected));
}

const median = (values: readonly number[]): number => { const sorted = [...values].sort((a, b) => a - b); const result = sorted.at(Math.floor(sorted.length / 2)); if (result === undefined) throw new Error('No native readings'); return result; };
/** Grade native readings at the same road pose, after natural production eviction circuits. No reload is allowed. */
export function gradeSoak({ samples, windows, seconds, circuits, evictions, errors, leak, expected, entries, crossroads, engineBase = 300_000_000, rehearsal = false, leg = 'cells' }: Witness): Grade {
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
    if (rows.length > 0) loops.push({ cycle, peakBytes: Math.max(...rows.map((row) => combined(row, true))), troughBytes: Math.min(...rows.map((row) => combined(row))) });
  }
  const loopTwo = loops.find((loop) => loop.cycle === 1);
  // Loop one warms the process. Loop two is the peak/trough reference, including the last partial loop.
  const recovery = baselineRecovery && loopTwo !== undefined && loops.filter((loop) => loop.cycle >= 1).every((loop) => Math.abs(loop.peakBytes - loopTwo.peakBytes) <= 30_000_000 && Math.abs(loop.troughBytes - loopTwo.troughBytes) <= 30_000_000);
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
    && [...drive, ...loading].every((row) => row.footprint > 0 && row.gl?.reconciled === true && row.gl.unlabelled === 0);
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
  // G186: drift is diagnostic; the qualifying continuous route runs for a full hour.
  const memoryPass = seconds >= 3600 && circuits >= 2 && (leg === 'road' ? entries.length === 0 : evictions > 0) && sampling && peakBytes <= 1_000_000_000 && loadingPeakBytes <= 1_800_000_000 && calibration && leakZero && errors.length === 0;
  return { memoryPass, gatePass: !rehearsal && memoryPass && refused.length === 0 && visited && new Set(crossroads).size === 16,
    peakBytes, loadingPeakBytes, phoneEstimateBytes: peakBytes * 1.4, baselines, baselineDeltaBytes, loops, recovery, calibration, ratios, missingGlSamples, sampling, leakZero, admitted, refused, attemptedEveryCell: visited, crossroads: new Set(crossroads).size, rehearsal,
    limitation: refused.length === 0 ? null : 'Some cells were not admitted; see refusal records. A far proxy is not an entry. This rehearsal cannot close SF57; rerun after SF46–48.' };
}
