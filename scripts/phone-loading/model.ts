/** The measuring protocol is data, never a CI verdict or a game setting. */
export interface Profile {cpu: number; down: number; up: number; latency: number}
export const profiles: Record<string, Profile> = {
  phone: {cpu: 10, down: 10_000_000 / 8, up: 2_000_000 / 8, latency: 100},
  lte: {cpu: 6, down: 20_000_000 / 8, up: 5_000_000 / 8, latency: 60},
  desktop: {cpu: 1, down: -1, up: -1, latency: 0},
};
export interface Row {key: string; label: string; start: number | null; end: number | null; duration: number; wallMs: number | null;
  state?: 'todo' | 'on' | 'ok'; startBasis?: 'native' | 'observed'; endBasis?: 'native' | 'observed'; detail?: string}
export interface ErrorRow {message: string; source: string; url: string; at: number}
export interface RequestRow {url: string; start: number; end: number | null; source: 'worker' | 'service-worker' | 'network'; bytes: number; headerBytes?: number; status: number; failure: string | null}
export interface Mark {name: string; start: number; duration: number; detail: unknown}
export interface PanelRow {at: number; clock: string; download: number | null; header: string; wait: string; step: string; activeLabel: string | null}
export interface Capture {tap: number | null; control: number | null; fatal?: string; stoppedAt?: number; rows: Row[]; measures: Mark[]; longTasks: Mark[]; frameGaps: {start: number; duration: number}[]; errors: string[]; errorDetails?: ErrorRow[]; panels?: PanelRow[]; rowCoverage: string}
export interface Run extends Capture {schema: 1; build: string; engine: string; flow: string; cache: string; preset: string; at: string; url: string; profile: Profile; applied: {pageCPU: boolean; pageNetwork: boolean; workerNetwork: boolean; notes: string[]}; requests: RequestRow[]; totalMs: number | null; video?: string; contactSheet?: string}
export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}
export function comparisons(current: Run, previous: unknown): string[] {
  const outer = record(previous);
  const candidates: unknown[] = Array.isArray(outer['runs']) ? outer['runs'] : [previous];
  const old = candidates.map(record).find(row => row['engine'] === current.engine && row['flow'] === current.flow
    && row['cache'] === current.cache && row['preset'] === current.preset);
  if (old === undefined) return ['No matching engine/flow/cache/preset baseline'];
  const warnings: string[] = [];
  if (typeof old['totalMs'] === 'number' && current.totalMs !== null && current.totalMs > old['totalMs'] * 1.1)
    warnings.push(`total +${((current.totalMs / old['totalMs'] - 1) * 100).toFixed(1)}%`);
  const oldRows = Array.isArray(old['rows']) ? old['rows'].map(record) : [];
  for (const row of current.rows) {
    const before = oldRows.find(value => value['key'] === row.key);
    if (typeof before?.['duration'] === 'number' && row.duration > before['duration'] + 1000)
      warnings.push(`${row.key} +${((row.duration - before['duration']) / 1000).toFixed(2)}s`);
  }
  return warnings;
}
export function printRun(run: Run): void {
  const summary = (source: RequestRow['source']) => {
    const rows = run.requests.filter(row => row.source === source);
    return `${rows.length} / ${(rows.reduce((sum, row) => sum + row.bytes, 0) / 1e6).toFixed(3)} MB`;
  };
  console.log(`\n${run.engine} ${run.flow} ${run.cache} ${run.build} [${run.preset}]`);
  console.table([{seconds: run.totalMs === null ? 'INCOMPLETE' : (run.totalMs / 1000).toFixed(3),
    'page network': summary('network'), 'worker network': summary('worker'), 'page via SW': summary('service-worker'),
    longTasks: run.longTasks.length, frameGaps: run.frameGaps.length, errors: run.errors.length}]);
  const secondsAt = (at: number | null): string => at === null ? 'pending' : ((at - (run.tap ?? 0)) / 1000).toFixed(3);
  console.table(run.rows.filter(row => row.state !== 'todo').map(row => ({step: row.label, 'start +s': secondsAt(row.start), 'end +s': secondsAt(row.end),
    'exclusive s': (row.duration / 1000).toFixed(3), 'wall s': row.wallMs === null ? 'unknown' : (row.wallMs / 1000).toFixed(3),
    boundaries: `${row.startBasis ?? 'unknown'} / ${row.endBasis ?? 'pending'}`})));
  if (run.errors.length > 0) console.table(run.errorDetails ?? run.errors.map(message => ({message, source: 'legacy capture', url: ''})));
}
