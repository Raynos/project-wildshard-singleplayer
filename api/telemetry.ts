/** Anonymous session/analytics records, private Blob reads and rolling thirty-day retention (E357 X8). */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { blobStore, type BlobPage } from './_blobStore.js';
import { cleanCrossroads, type CrossroadsReading } from './_crossroads.js';

const PREFIX = 'telemetry/';
const DAY = 86_400_000;
const MAX_BODY = 16_384;
const outcomes = new Set(['clean', 'crash', 'context-loss', 'likely-oom']);
const names = new Set(['death.cause', 'quest.step', 'weapon.used', 'shard.time', 'level.time', 'boss.attempt']);
const native = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
interface Event { name: string; data: Record<string, string | number> }
export interface TelemetryRecord {
  kind: 'session' | 'analytics' | 'crossroads'; build: string; install: string; receivedAt: string;
  session?: string; end?: string; shard?: string; stage?: string; fps?: number; events?: Event[];
  rig?: CrossroadsReading;
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 64): string => typeof value === 'string' ? value.slice(0, max) : '';
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
export function passwordOk(given: string | null, expected = process.env['REVIEW_PASSWORD']): boolean {
  return given !== null && expected !== undefined && expected !== '' && timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());
}
function headers(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return { 'cache-control': 'no-store', ...(native.has(origin) ? { 'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-review-password', vary: 'origin' } : {}) };
}
function json(req: Request, status: number, value: unknown): Response { return Response.json(value, { status, headers: headers(req) }); }
export function OPTIONS(req: Request): Response { return new Response(null, { status: 204, headers: headers(req) }); }
const hits = new Map<string, { start: number; count: number }>();
export function resetRateLimit(): void { hits.clear(); }
function limited(req: Request): boolean {
  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown').split(',')[0] ?? 'unknown';
  const now = Date.now(), previous = hits.get(ip);
  const value = previous && now - previous.start < 60_000 ? previous : { start: now, count: 0 };
  value.count++; hits.set(ip, value);
  if (hits.size > 500) for (const key of hits.keys()) if (key !== ip) hits.delete(key);
  return value.count > 120;
}
export function cleanRecord(body: unknown, now = new Date()): TelemetryRecord | null {
  if (!object(body) || !['session', 'analytics', 'crossroads'].includes(text(body['kind']))) return null;
  const base = { build: text(body['build']), install: text(body['install']), receivedAt: now.toISOString() };
  if (!base.build || !base.install) return null;
  if (body['kind'] === 'crossroads') {
    const rig = cleanCrossroads(body['rig'] ?? body);
    return rig ? { ...base, kind: 'crossroads', rig } : null;
  }
  if (body['kind'] === 'session') {
    const heartbeat = body['heartbeat'];
    if (!object(heartbeat) || !outcomes.has(text(body['end'])) || !text(heartbeat['session'])) return null;
    return { ...base, kind: 'session', session: text(heartbeat['session']), end: text(body['end']),
      shard: text(heartbeat['level'] ?? heartbeat['shard']), stage: text(heartbeat['stage']), fps: Math.min(1000, number(heartbeat['fps'])) };
  }
  if (!Array.isArray(body['events']) || body['events'].length > 50) return null;
  const events: Event[] = [];
  for (const event of body['events']) {
    if (!object(event) || !names.has(text(event['name'])) || !object(event['data'])) return null;
    const name = event['name'] === 'level.time' ? 'shard.time' : text(event['name']), source = event['data'], data: Record<string, string | number> = { shard: text(source['level'] ?? source['shard']) };
    if (name === 'death.cause') data['cause'] = text(source['cause']);
    if (name === 'quest.step') { data['quest'] = text(source['quest']); data['step'] = text(source['step']); }
    if (name === 'weapon.used') data['weapon'] = text(source['weapon']);
    if (name === 'shard.time') data['seconds'] = Math.min(DAY / 1000, number(source['seconds']));
    if (name === 'boss.attempt') {
      if (!['started', 'won', 'died', 'left'].includes(text(source['outcome']))) return null;
      data['boss'] = text(source['boss']); data['outcome'] = text(source['outcome']);
    }
    events.push({ name, data });
  }
  return { ...base, kind: 'analytics', events };
}
async function blobs(): Promise<BlobPage['blobs']> {
  const result: BlobPage['blobs'] = [];
  let cursor: string | undefined = undefined;
  do {
    const page: BlobPage = await blobStore().list({ prefix: PREFIX, limit: 1000, ...(cursor === undefined ? {} : { cursor }) });
    result.push(...page.blobs); cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor !== undefined);
  return result;
}
export async function POST(req: Request): Promise<Response> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json(req, 413, { error: 'body too large' });
  const raw = await req.text(); if (Buffer.byteLength(raw) > MAX_BODY) return json(req, 413, { error: 'body too large' });
  let body: unknown; try { body = JSON.parse(raw); } catch { return json(req, 400, { error: 'bad json' }); }
  const now = new Date(), record = cleanRecord(body, now);
  if (!record) return json(req, 400, { error: 'bad telemetry' });
  if (!process.env['BLOB_READ_WRITE_TOKEN']) return json(req, 503, { error: 'telemetry not configured' });
  if (limited(req)) return json(req, 429, { error: 'slow down' });
  const id = `${now.toISOString().replaceAll(':', '-')}-${randomBytes(4).toString('hex')}`;
  await blobStore().put(`${PREFIX}${now.toISOString().slice(0, 10)}/${id}.json`, JSON.stringify(record), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
  const expired = (await blobs()).filter((blob) => new Date(blob.uploadedAt).getTime() < now.getTime() - 30 * DAY).map((blob) => blob.pathname);
  if (expired.length > 0) await blobStore().del(expired);
  return json(req, 200, { id });
}
export function buildRates(records: readonly TelemetryRecord[], n: number): { build: string; sessions: number; crashFree: number }[] {
  const builds = new Map<string, Map<string, string>>();
  for (const record of records.toSorted((a, b) => a.receivedAt.localeCompare(b.receivedAt))) if (record.kind === 'session' && record.session && record.end) {
    const sessions = builds.get(record.build) ?? new Map<string, string>(); sessions.set(`${record.install}/${record.session}`, record.end);
    builds.delete(record.build); builds.set(record.build, sessions);
  }
  return [...builds].reverse().slice(0, n).map(([build, sessions]) => ({ build, sessions: sessions.size, crashFree: [...sessions.values()].filter((end) => end === 'clean').length / sessions.size }));
}
export function dailyDigest(records: readonly TelemetryRecord[]): Record<string, unknown> {
  const counts: Record<string, Record<string, number>> = {}, times = new Map<string, number[]>();
  for (const record of records) for (const event of record.events ?? []) {
    if (event.name === 'shard.time') { const shard = String(event.data['shard']); const values = times.get(shard) ?? []; values.push(Number(event.data['seconds'])); times.set(shard, values); continue; }
    const key = Object.values(event.data).join(' / '), values = counts[event.name] ?? {}; values[key] = (values[key] ?? 0) + 1; counts[event.name] = values;
  }
  return { counts, shardTime: Object.fromEntries([...times].map(([shard, values]) => { const sorted = values.toSorted((a, b) => a - b), middle = Math.floor(sorted.length / 2); return [shard, { samples: sorted.length, median: sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0 }]; })) };
}
export async function GET(req: Request): Promise<Response> {
  if (!process.env['REVIEW_PASSWORD']) return json(req, 503, { error: 'telemetry not configured' });
  if (!passwordOk(req.headers.get('x-review-password'))) return json(req, 401, { error: 'bad password' });
  const url = new URL(req.url), day = url.searchParams.get('digest');
  if (day !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(day)) return json(req, 400, { error: 'bad date' });
  const rigs = url.searchParams.get('rig') === 'crossroads';
  if (day === null && url.searchParams.get('rate') !== 'builds' && !rigs) return json(req, 400, { error: 'choose rate, digest or rig' });
  const records: TelemetryRecord[] = [];
  for (const blob of await blobs()) {
    if (day !== null && !blob.pathname.startsWith(`${PREFIX}${day}/`)) continue;
    const hit = await blobStore().get(blob.pathname, { access: 'private', useCache: false });
    if (!hit?.stream) continue;
    const value: unknown = await new Response(hit.stream).json();
    if (object(value) && typeof value['receivedAt'] === 'string') {
      const stamp = new Date(value['receivedAt']);
      if (!Number.isFinite(stamp.getTime())) continue;
      const record = cleanRecord({ ...value, heartbeat: { session: value['session'], shard: value['shard'], stage: value['stage'], fps: value['fps'] } }, stamp);
      if (record) records.push(record);
    }
  }
  if (rigs) return json(req, 200, { records: records.filter((record) => record.kind === 'crossroads').toSorted((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 50) });
  return json(req, 200, day === null ? { builds: buildRates(records, Math.max(1, Math.min(20, Number(url.searchParams.get('n')) || 3))) } : { day, ...dailyDigest(records) });
}
