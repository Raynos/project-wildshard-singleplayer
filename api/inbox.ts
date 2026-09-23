/**
 * `/api/inbox` — the in-game review inbox (Vercel Node function, web-standard handlers; plan: project/archive/2026-09-22-feedback-inbox.md).
 *
 *   POST { password, note, category, context, screenshot? }  → { id }   writes inbox/<id>.json (+ .jpg) to Vercel Blob
 *   GET  (x-review-password header)                         → { entries: [{ id, json, jpg, uploadedAt, size }] }
 *   GET  ?id=<id>&file=json|jpg                              → the blob's bytes (the store is private; this proxies it)
 *   POST { password, check: true }                           → { ok: true }  the Settings UNLOCK button's password check
 *
 * The password rides in the JSON body (POST) or the `x-review-password` header (GET) and is checked against
 * `REVIEW_PASSWORD` with a constant-time compare. Bodies are capped at 1 MB, notes at 4000 chars. A light per-IP rate
 * limit (30 / min, per warm instance) keeps a leaked password from filling the store. The client is
 * `src/ui/Feedback.ts`; the pull side is `scripts/inbox-pull.mjs` (`pnpm inbox:pull`). Ported from trials-gauntlet.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { get, list, put, type ListBlobResult } from '@vercel/blob';

export const MAX_BODY_BYTES = 1024 * 1024;
export const MAX_NOTE_CHARS = 4000;
export const RATE_LIMIT_PER_MIN = 30;
export const CATEGORIES = ['bug', 'art', 'feel', 'perf', 'idea'] as const;
export type Category = (typeof CATEGORIES)[number];
const PREFIX = 'inbox/';
const ID_RE = /^[0-9TZ.-]{20,32}-[0-9a-f]{8}$/u;
const MINUTE_MS = 60_000;
const RATE_TABLE_MAX = 500;
/** The native shells (Capacitor) serve the game from these origins; the web build is same-origin and needs no CORS. */
const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);

export interface InboxEntry {
  id: string;
  json: string;
  jpg: string | null;
  uploadedAt: string;
  size: number;
}

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

/** Constant-time password check; a missing / empty `REVIEW_PASSWORD` rejects everything. */
export function passwordOk(given: unknown, expected: string | undefined = process.env['REVIEW_PASSWORD']): boolean {
  if (typeof given !== 'string' || expected === undefined || expected === '') return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// -- rate limit (per warm instance; the goal is "not a firehose", not a guarantee) --
const hits = new Map<string, number[]>();
export function rateLimited(ip: string, now = Date.now(), limit = RATE_LIMIT_PER_MIN): boolean {
  const cut = now - MINUTE_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cut);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > RATE_TABLE_MAX) for (const k of hits.keys()) if (k !== ip) hits.delete(k);
  return recent.length > limit;
}
export function resetRateLimit(): void {
  hits.clear();
}

export function clientIp(req: Request): string {
  const first = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '').split(',')[0] ?? '';
  return first.trim() || 'unknown';
}

/** `2026-09-22T18-05-12.345Z-1a2b3c4d`: sortable by time, unguessable tail. */
export function newId(now = new Date(), rand: () => string = () => randomBytes(4).toString('hex')): string {
  return `${now.toISOString().replaceAll(':', '-')}-${rand()}`;
}

/** The JPEG bytes of a `data:image/jpeg;base64,…` (or bare base64) string; anything that is not a JPEG is dropped. */
export function decodeScreenshot(s: unknown): Buffer | null {
  if (typeof s !== 'string' || s.length === 0) return null;
  const b64 = s.startsWith('data:') ? s.slice(s.indexOf(',') + 1) : s;
  const buf = Buffer.from(b64, 'base64');
  // JPEG SOI marker; anything else is dropped rather than stored under a .jpg name.
  return buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 ? buf : null;
}

export function parseCategory(v: unknown): Category {
  return CATEGORIES.find((c) => c === v) ?? 'bug';
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request): Promise<Response> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(req, 413, { error: 'body too large' });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(req, 413, { error: 'body too large' });
  const body = parseJson(raw);
  if (!isRecord(body)) return json(req, 400, { error: 'bad json' });
  if (process.env['REVIEW_PASSWORD'] === undefined) return json(req, 503, { error: 'inbox not configured' });
  if (rateLimited(clientIp(req))) return json(req, 429, { error: 'slow down' });
  if (!passwordOk(body['password'])) return json(req, 401, { error: 'bad password' });
  if (body['check'] === true) return json(req, 200, { ok: true });
  const note = typeof body['note'] === 'string' ? body['note'].trim().slice(0, MAX_NOTE_CHARS) : '';
  if (!note) return json(req, 400, { error: 'empty note' });
  const context = isRecord(body['context']) ? body['context'] : {};
  const id = newId();
  const jpg = decodeScreenshot(body['screenshot']);
  const record = {
    id,
    receivedAt: new Date().toISOString(),
    category: parseCategory(body['category']),
    note,
    context,
    screenshot: jpg ? `${id}.jpg` : null,
    ip: clientIp(req),
    ua: req.headers.get('user-agent') ?? '',
  };
  await put(`${PREFIX}${id}.json`, JSON.stringify(record, null, 2), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
  if (jpg) await put(`${PREFIX}${id}.jpg`, jpg, { access: 'private', addRandomSuffix: false, contentType: 'image/jpeg' });
  return json(req, 200, { id });
}

async function listEntries(): Promise<InboxEntry[]> {
  const byId = new Map<string, InboxEntry>();
  let cursor: string | undefined = undefined;
  do {
    const page: ListBlobResult = await list({ prefix: PREFIX, limit: 1000, ...(cursor === undefined ? {} : { cursor }) });
    for (const b of page.blobs) {
      const m = /^inbox\/(?<id>.+)\.(?<ext>json|jpg)$/u.exec(b.pathname);
      const id = m?.groups?.['id'];
      if (id === undefined) continue;
      const e = byId.get(id) ?? { id, json: '', jpg: null, uploadedAt: new Date(b.uploadedAt).toISOString(), size: 0 };
      if (m?.groups?.['ext'] === 'json') e.json = b.pathname;
      else e.jpg = b.pathname;
      e.size += b.size;
      byId.set(id, e);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor !== undefined);
  return [...byId.values()].filter((e) => e.json !== '').toSorted((a, b) => a.id.localeCompare(b.id));
}

export async function GET(req: Request): Promise<Response> {
  if (process.env['REVIEW_PASSWORD'] === undefined) return json(req, 503, { error: 'inbox not configured' });
  if (rateLimited(clientIp(req), Date.now(), RATE_LIMIT_PER_MIN * 4)) return json(req, 429, { error: 'slow down' });
  if (!passwordOk(req.headers.get('x-review-password'))) return json(req, 401, { error: 'bad password' });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id === null) return json(req, 200, { entries: await listEntries() });
  if (!ID_RE.test(id)) return json(req, 400, { error: 'bad id' });
  const file = url.searchParams.get('file') === 'jpg' ? 'jpg' : 'json';
  const hit = await get(`${PREFIX}${id}.${file}`, { access: 'private', useCache: false });
  if (!hit?.stream) return json(req, 404, { error: 'not found' });
  return new Response(hit.stream, {
    status: 200,
    headers: { 'content-type': file === 'jpg' ? 'image/jpeg' : 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(req) },
  });
}
