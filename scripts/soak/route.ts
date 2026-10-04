interface Cell { readonly instance: string; readonly slug: string; readonly cell: readonly number[] }
interface Point { readonly x: number; readonly z: number }
interface Step extends Point { readonly kind: string; readonly instance?: string; readonly slug?: string; readonly id?: string; readonly seconds?: number }
interface Sample { readonly type: string; readonly phase: string; readonly elapsed: number; readonly footprint: number; readonly interval?: number }
interface Window { readonly start: number; readonly end: number }
interface Entry { readonly instance: string; readonly admitted: boolean }
interface Leak { readonly disposalErrors: readonly string[]; readonly scope: { readonly bodies: number; readonly colliders: number }; readonly after: { readonly bodies: number; readonly colliders: number; readonly [key: string]: unknown } }
interface Witness { readonly samples: readonly Sample[]; readonly windows: readonly Window[]; readonly seconds: number; readonly circuits: number; readonly evictions: number; readonly errors: readonly string[]; readonly leak: Leak | null; readonly expected: readonly string[]; readonly entries: readonly Entry[]; readonly crossroads: readonly string[] }
interface Grade { memoryPass: boolean; gatePass: boolean; peakBytes: number; baselines: { start: number; end: number; samples: number; bytes: number | null }[]; baselineDeltaBytes: (number | null)[]; recovery: boolean; sampling: boolean; leakZero: boolean; admitted: string[]; refused: string[]; attemptedEveryCell: boolean; crossroads: number; limitation: string | null }
/** The drive uses the admitted catalogue, never a second hand-maintained shard list. */
export function soakRoute(cells: readonly Cell[], pitch = 555): { reference: Point; steps: readonly Step[] } {
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
      if (previous !== undefined && row < 3) {
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

const median = (values: readonly number[]): number => { const sorted = [...values].sort((a, b) => a - b); const result = sorted.at(Math.floor(sorted.length / 2)); if (result === undefined) throw new Error('No native readings'); return result; };
/** Grade native readings at the same road pose, after natural production eviction circuits. No reload is allowed. */
export function gradeSoak({ samples, windows, seconds, circuits, evictions, errors, leak, expected, entries, crossroads }: Witness): Grade {
  const active = samples.filter((row) => row.type === 'sample' && /^(baseline|drive|settle|unloaded)/u.test(row.phase));
  const drive = active.filter((row) => row.phase !== 'unloaded');
  const peakBytes = Math.max(0, ...drive.map((row) => Math.max(row.footprint, row.interval ?? row.footprint)));
  const baselines = windows.map((window) => {
    const points = samples.filter((row) => row.type === 'sample' && row.elapsed >= window.start && row.elapsed <= window.end);
    return { ...window, samples: points.length, bytes: points.length === 0 ? null : median(points.map((row) => row.footprint)) };
  });
  const first = baselines.at(0)?.bytes;
  const recovery = first !== null && first !== undefined && baselines.length >= Math.max(2, circuits + 1)
    && baselines.every((row) => row.bytes !== null && row.samples >= 5 && Math.abs(row.bytes - first) <= 30_000_000);
  const baselineDeltaBytes = baselines.map((row) => row.bytes === null || first === null || first === undefined ? null : row.bytes - first);
  const gaps = active.slice(1).map((row, index) => row.elapsed - (active.at(index)?.elapsed ?? row.elapsed));
  const sampling = drive.length >= seconds * 0.95 && gaps.every((gap) => gap <= 2.5)
    && drive.every((row) => row.footprint > 0);
  const admitted = expected.filter((id) => entries.some((row) => row.instance === id && row.admitted));
  const refused = expected.filter((id) => !admitted.includes(id));
  const visited = expected.every((id) => entries.some((row) => row.instance === id));
  const zeroCensus = (value: unknown): boolean => typeof value === 'number' ? value <= 0 : value !== null && typeof value === 'object' && Object.values(value).every(zeroCensus);
  const leakZero = leak?.disposalErrors.length === 0
    && leak.scope.bodies === 0 && leak.scope.colliders === 0 && leak.after.bodies === 0 && leak.after.colliders === 0
    && zeroCensus(leak.after);
  const memoryPass = seconds >= 1800 && circuits >= 2 && evictions > 0 && sampling && peakBytes < 1_000_000_000 && recovery && leakZero && errors.length === 0;
  return { memoryPass, gatePass: memoryPass && refused.length === 0 && visited && new Set(crossroads).size === 16,
    peakBytes, baselines, baselineDeltaBytes, recovery, sampling, leakZero, admitted, refused, attemptedEveryCell: visited, crossroads: new Set(crossroads).size,
    limitation: refused.length === 0 ? null : 'M3 runtime cells remain behind production admission walls. A far proxy is not an entry; rerun after SF46–48.' };
}
