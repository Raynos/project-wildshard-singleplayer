/**
 * `/api/errors` — client error reports (E133, FINISH-LINE S2), the review inbox's sibling (api/inbox.ts, same style).
 *
 *   POST { system, message, stack, count, fatal, disabled, sinceBootMs, context }  → { id }   writes errors/<id>.json
 *   GET  (x-review-password header)                          → { entries: [{ id, uploadedAt, size }] }
 *   GET  ?since=<id>&count=1 (x-review-password)             → { count, newest }   ids after `since` (the session brief)
 *   GET  ?id=<id> (x-review-password)                        → the report's JSON (the store is private; this proxies it)
 *
 * POST needs no password: every player's game reports its own errors (window.onerror, unhandled rejections, a system the
 * frame loop switched off — src/core/errorReport.ts, which dedupes and caps them at 10 a session on the client). So the
 * server keeps it small instead: bodies ≤ 16 KB, messages / stacks clamped, 20 reports a minute per IP (per warm
 * instance), no screenshot, no IP stored. Reading them back is password-gated like the inbox. The pull side is
 * `pnpm inbox:pull` (scripts/inbox-pull.mjs), which drops them into `.review/inbox/` as category `error`.
 */
import { get, list, put, type ListBlobResult } from '@vercel/blob';
import { clientIp, newId, passwordOk } from './inbox';

export const MAX_ERROR_BODY_BYTES = 16 * 1024;
export const MAX_MESSAGE_CHARS = 500;
export const MAX_STACK_CHARS = 4000;
export const ERROR_RATE_PER_MIN = 20;
const PREFIX = 'errors/';
const ID_RE = /^[0-9TZ.-]{20,32}-[0-9a-f]{8}$/u;
const MINUTE_MS = 60_000;
const RATE_TABLE_MAX = 500;
const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  if (!NATIVE_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-review-password',
    vary: 'origin',
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...corsHeaders(req) } });
}

// -- rate limit: its own table (a crash loop on one phone must not eat the inbox's budget) --
const hits = new Map<string, number[]>();
export function errorRateLimited(ip: string, now = Date.now(), limit = ERROR_RATE_PER_MIN): boolean {
  const cut = now - MINUTE_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cut);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > RATE_TABLE_MAX) for (const k of hits.keys()) if (k !== ip) hits.delete(k);
  return recent.length > limit;
}
export function resetErrorRateLimit(): void {
  hits.clear();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The report's context, whitelisted and clamped: nothing the client sends is stored verbatim. */
export function cleanContext(c: unknown): Record<string, string | number | boolean | number[] | null> {
  if (!isRecord(c)) return {};
  const pos = Array.isArray(c['pos']) ? c['pos'].slice(0, 3).map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0)) : null;
  return {
    build: str(c['build'], 64),
    shard: str(c['shard'], 40),
    tier: str(c['tier'], 16),
    touch: c['touch'] === true,
    url: str(c['url'], 500),
    pos,
    yaw: num(c['yaw']),
    pitch: num(c['pitch']),
    viewport: str(c['viewport'], 24),
    loop: str(c['loop'], 12),
  };
}

/** The stored record: the inbox's shape (id / receivedAt / category / note / context) plus the `error` block. */
export function errorRecord(body: Record<string, unknown>, id: string, ua: string, now = new Date()): Record<string, unknown> | null {
  const message = str(body['message'], MAX_MESSAGE_CHARS).trim();
  if (!message) return null;
  const system = str(body['system'], 60) || 'window';
  return {
    id,
    receivedAt: now.toISOString(),
    category: 'error',
    note: `[${system}] ${message}`,
    context: cleanContext(body['context']),
    error: {
      system,
      message,
      stack: str(body['stack'], MAX_STACK_CHARS),
      count: Math.max(1, Math.min(1_000_000, Math.round(num(body['count']) ?? 1))),
      fatal: body['fatal'] === true,
      disabled: body['disabled'] === true,
      sinceBootMs: Math.max(0, Math.round(num(body['sinceBootMs']) ?? 0)),
    },
    screenshot: null,
    ua: ua.slice(0, 300),
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request): Promise<Response> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_ERROR_BODY_BYTES) return json(req, 413, { error: 'body too large' });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_ERROR_BODY_BYTES) return json(req, 413, { error: 'body too large' });
  const body = parseJson(raw);
  if (!isRecord(body)) return json(req, 400, { error: 'bad json' });
  if (process.env['BLOB_READ_WRITE_TOKEN'] === undefined) return json(req, 503, { error: 'error store not configured' });
  if (errorRateLimited(clientIp(req))) return json(req, 429, { error: 'slow down' });
  const id = newId();
  const record = errorRecord(body, id, req.headers.get('user-agent') ?? '');
  if (!record) return json(req, 400, { error: 'empty message' });
  await put(`${PREFIX}${id}.json`, JSON.stringify(record, null, 2), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
  return json(req, 200, { id });
}

async function listIds(): Promise<{ id: string; uploadedAt: string; size: number }[]> {
  const out: { id: string; uploadedAt: string; size: number }[] = [];
  let cursor: string | undefined = undefined;
  do {
    const page: ListBlobResult = await list({ prefix: PREFIX, limit: 1000, ...(cursor === undefined ? {} : { cursor }) });
    for (const b of page.blobs) {
      const id = /^errors\/(?<id>.+)\.json$/u.exec(b.pathname)?.groups?.['id'];
      if (id !== undefined) out.push({ id, uploadedAt: new Date(b.uploadedAt).toISOString(), size: b.size });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor !== undefined);
  return out.toSorted((a, b) => a.id.localeCompare(b.id));
}

export async function GET(req: Request): Promise<Response> {
  if (process.env['REVIEW_PASSWORD'] === undefined) return json(req, 503, { error: 'inbox not configured' });
  if (errorRateLimited(clientIp(req), Date.now(), ERROR_RATE_PER_MIN * 6)) return json(req, 429, { error: 'slow down' });
  if (!passwordOk(req.headers.get('x-review-password'))) return json(req, 401, { error: 'bad password' });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id === null) {
    const since = url.searchParams.get('since') ?? '';
    const entries = (await listIds()).filter((e) => e.id > since);
    if (url.searchParams.get('count') === '1') return json(req, 200, { count: entries.length, newest: entries.at(-1)?.id ?? null });
    return json(req, 200, { entries });
  }
  if (!ID_RE.test(id)) return json(req, 400, { error: 'bad id' });
  const hit = await get(`${PREFIX}${id}.json`, { access: 'private', useCache: false });
  if (!hit?.stream) return json(req, 404, { error: 'not found' });
  return new Response(hit.stream, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(req) } });
}
