import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { join } from 'node:path';

async function validator() {
  const root = new URL('../', import.meta.url), roots = ['api/'].map(path => new URL(path, root).href);
  // API source names its emitted .js dependencies. Resolve only this pure
  // validation graph to TS; never load the Blob store or install a global host.
  const hooks = registerHooks({resolve(specifier, context, next) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && roots.some(path => context.parentURL?.startsWith(path))) {
      const source = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (roots.some(path => source.href.startsWith(path)) && existsSync(source)) return next(source.href, context);
    }
    return next(specifier, context);
  }});
  try { return await import('../api/_telemetryRecord.ts'); }
  finally { hooks.deregister(); }
}

/** @param {import('node:http').IncomingMessage} req @param {number} limit @returns {Promise<Buffer | null>} */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */ const chunks = [];
    let bytes = 0, done = false;
    req.on('data', chunk => {
      if (done) return;
      const body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += body.length;
      if (bytes > limit) {done = true; chunks.length = 0; resolve(null);}
      else chunks.push(body);
    });
    req.once('end', () => {if (!done) {done = true; resolve(Buffer.concat(chunks));}});
    req.once('error', error => {if (!done) {done = true; reject(error);}});
    req.once('aborted', () => {if (!done) {done = true; reject(new Error('Telemetry request aborted'));}});
  });
}

/** Actual local POST receiver: retain the original bytes and production-cleaned
 * record before acknowledging. Nothing substitutes or filters browser traffic.
 * @param {string} directory */
export async function createPreviewTelemetrySink(directory) {
  const {cleanTelemetryRecord: clean, MAX_TELEMETRY_BYTES: limit} = await validator();
  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    /** @param {number} status @param {string} error */
    const refuse = (status, error) => {res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({error}));};
    if (req.method !== 'POST') {refuse(405, 'method not allowed'); return;}
    if (Number(req.headers['content-length'] ?? 0) > limit) {req.resume(); refuse(413, 'body too large'); return;}
    try {
      const bytes = await readBody(req, limit);
      if (bytes === null) {refuse(413, 'body too large'); return;}
      /** @type {unknown} */ let payload;
      try {payload = JSON.parse(new TextDecoder().decode(bytes));}
      catch {refuse(400, 'bad json'); return;}
      const now = new Date(), record = clean(payload, now);
      if (record === null) {refuse(400, 'bad telemetry'); return;}
      await mkdir(directory, {recursive: true});
      const id = randomUUID();
      await writeFile(join(directory, `${id}.bin`), bytes, {flag: 'wx', mode: 0o600});
      await writeFile(join(directory, `${id}.json`), `${JSON.stringify({id, receivedAt: now.toISOString(),
        method: req.method, url: req.url, contentType: req.headers['content-type'] ?? null,
        bodyFile: `${id}.bin`, bodyBytes: bytes.length, payload, record})}\n`, {flag: 'wx', mode: 0o600});
      res.statusCode = 204; res.setHeader('X-Preview-Telemetry-Id', id); res.end();
    } catch (error) {
      console.error(`preview telemetry: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.destroyed && !res.writableEnded) refuse(500, 'telemetry recording failed');
    }
  };
}
