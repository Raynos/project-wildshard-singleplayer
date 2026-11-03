// Real response bodies for the download bench (E525): every URL is fetched once
// from the target with the browser's Accept-Encoding, and its exact wire size
// (the compressed body as served), its decoded body and its headers are kept
// on disk under tmp/download-spike/bodies/<host>/. Later runs read the disk, so
// a benchmark never pays the Mac's own internet link (which measured ~15 Mb/s
// and shared, i.e. no faster than the 10 Mb/s phone preset it should model).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const ROOT = 'tmp/download-spike/bodies';

/**
 * @typedef {{ url: string, status: number, encoding: string, contentType: string, cacheControl: string, wireBytes: number, bytes: number }} BodyMeta
 */

/** @param {string} url */
function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), request = u.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(u, { headers: { 'accept-encoding': 'br, gzip', 'user-agent': 'wildshard-download-bench' } }, res => {
      /** @type {Buffer[]} */ const parts = [];
      res.on('data', chunk => { parts.push(chunk); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, raw: Buffer.concat(parts) }));
      res.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
}

/** @param {string} url */
function keyOf(url) { return createHash('sha256').update(url).digest('hex').slice(0, 32); }

/**
 * The body of `url` (absolute), from disk when already fetched.
 * @param {string} url
 * @returns {Promise<{ meta: BodyMeta, body: Buffer }>}
 */
export async function body(url) {
  const host = new URL(url).host.replaceAll(/[^a-z0-9.-]/giu, '_'), dir = join(ROOT, host), key = keyOf(url);
  const metaPath = join(dir, `${key}.json`), bodyPath = join(dir, `${key}.body`);
  if (existsSync(metaPath) && existsSync(bodyPath)) return { meta: JSON.parse(readFileSync(metaPath, 'utf8')), body: readFileSync(bodyPath) };
  mkdirSync(dir, { recursive: true });
  const { status, headers, raw } = /** @type {{ status: number, headers: Record<string, string | string[] | undefined>, raw: Buffer }} */ (await fetchRaw(url));
  const encoding = String(headers['content-encoding'] ?? 'identity');
  const decoded = encoding === 'br' ? brotliDecompressSync(raw) : encoding === 'gzip' ? gunzipSync(raw) : raw;
  /** @type {BodyMeta} */
  const meta = { url, status, encoding, contentType: String(headers['content-type'] ?? ''), cacheControl: String(headers['cache-control'] ?? ''), wireBytes: raw.length, bytes: decoded.length };
  writeFileSync(bodyPath, decoded); writeFileSync(metaPath, JSON.stringify(meta));
  return { meta, body: decoded };
}

/** Fetch many URLs into the disk cache, `lanes` at a time. */
export async function prime(/** @type {string[]} */ urls, lanes = 16) {
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: Math.min(lanes, urls.length) }, async () => {
    for (let i = next++; i < urls.length; i = next++) { const u = urls[i]; if (u !== undefined) { await body(u); done++; } }
  }));
  return done;
}
