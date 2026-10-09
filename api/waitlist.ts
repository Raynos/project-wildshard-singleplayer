/**
 * `/api/waitlist` — the marketing site's author waitlist and cell claims (MARKETING-SITE MS7 / MS16, E465).
 *
 *   POST { email, build?, cell?, website? }  → { ok: true }    writes waitlist/<id>.json to Vercel Blob (private)
 *   GET  (x-review-password header)          → { entries: [...] }   every signup, for the admin site
 *
 * The POST is public: the site (`site/index.html`) calls it cross-origin, so CORS allows the site's origins only
 * (`wildshard-site.vercel.app` plus any in `WAITLIST_ORIGINS`, comma-separated, for the domains Jake buys). A claimed
 * cell is a wish, not a promise: any grid cell but the fixed centre. `website` is a honeypot a person never fills.
 * Rate limit 10 / min per IP per warm instance. The GET reuses the review inbox's password (`REVIEW_PASSWORD`).
 */
import { blobStore, type BlobPage } from './_blobStore.js';
import { clientIp, newId, passwordOk, rateLimited } from './inbox.js';

export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_BUILD_CHARS = 500;
export const RATE_LIMIT_PER_MIN = 10;
const PREFIX = 'waitlist/';
const SITE_ORIGINS = ['https://wildshard-site.vercel.app'];
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/u;
const CELL_RE = /^[A-E][1-5]$/u;
const CENTRE = 'C3';

export interface WaitlistEntry { id: string; email: string; build: string; cell: string | null; receivedAt: string }

function allowedOrigins(): Set<string> {
  const extra = (process.env['WAITLIST_ORIGINS'] ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
  return new Set([...SITE_ORIGINS, ...extra]);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  if (!allowedOrigins().has(origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
}

function json(req: Request, status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...corsHeaders(req) } });
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

/** The email, trimmed and lower-cased, or null when it isn't one. */
export function parseEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return s.length <= 320 && EMAIL_RE.test(s) ? s : null;
}

/** A claimable cell (`A1`…`E5`, not the fixed centre), or null. */
export function parseCell(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return CELL_RE.test(s) && s !== CENTRE ? s : null;
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
  if (rateLimited(clientIp(req), Date.now(), RATE_LIMIT_PER_MIN)) return json(req, 429, { error: 'slow down' });
  // the honeypot: answer as if it worked, store nothing
  if (typeof body['website'] === 'string' && body['website'] !== '') return json(req, 200, { ok: true });
  const email = parseEmail(body['email']);
  if (email === null) return json(req, 400, { error: 'bad email' });
  const id = newId();
  const entry: WaitlistEntry = {
    id,
    email,
    build: typeof body['build'] === 'string' ? body['build'].trim().slice(0, MAX_BUILD_CHARS) : '',
    cell: parseCell(body['cell']),
    receivedAt: new Date().toISOString(),
  };
  await blobStore().put(`${PREFIX}${id}.json`, JSON.stringify(entry, null, 2), { access: 'private', addRandomSuffix: false, contentType: 'application/json' });
  return json(req, 200, { ok: true });
}

async function readEntry(pathname: string): Promise<WaitlistEntry | null> {
  const hit = await blobStore().get(pathname, { access: 'private', useCache: false });
  if (!hit?.stream) return null;
  const v = parseJson(await new Response(hit.stream).text());
  if (!isRecord(v)) return null;
  const { id, email, build, cell, receivedAt } = v;
  if (typeof id !== 'string' || typeof email !== 'string' || typeof receivedAt !== 'string') return null;
  return { id, email, build: typeof build === 'string' ? build : '', cell: typeof cell === 'string' ? cell : null, receivedAt };
}

export async function GET(req: Request): Promise<Response> {
  if (process.env['REVIEW_PASSWORD'] === undefined) return json(req, 503, { error: 'not configured' });
  if (rateLimited(clientIp(req), Date.now(), RATE_LIMIT_PER_MIN * 4)) return json(req, 429, { error: 'slow down' });
  if (!passwordOk(req.headers.get('x-review-password'))) return json(req, 401, { error: 'bad password' });
  const paths: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const page: BlobPage = await blobStore().list({ prefix: PREFIX, limit: 1000, ...(cursor === undefined ? {} : { cursor }) });
    for (const b of page.blobs) if (b.pathname.endsWith('.json')) paths.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor !== undefined);
  const entries = (await Promise.all(paths.map(readEntry))).filter((e): e is WaitlistEntry => e !== null);
  return json(req, 200, { entries: entries.toSorted((a, b) => a.id.localeCompare(b.id)) });
}
