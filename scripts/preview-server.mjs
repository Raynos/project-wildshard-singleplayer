#!/usr/bin/env node
// D24 (G799: no Vite plugins): serve a finished build the way production does, as a plain Node server. It replaces
// `vite preview` and its two plugins (the vercel.json header replay and Rapier's brotli copy), and keeps what the
// preview server did that callers rely on: encoded files, weak ETags with 304s, byte ranges, `.html`
// rewrites, index.html for any missing path a page or fetch asks for, and localhost CORS.
//
//   node scripts/preview-server.mjs [--outDir dist] [--port 4173] [--host 127.0.0.1] [--root <repo>]
//
// It prints `Local: http://<host>:<port>/` once it listens (callers wait for `:<port>/`), and exits on SIGTERM.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { brotliCompressSync, constants as zlib, createBrotliCompress, createGzip } from 'node:zlib';
import { createEncodedFileCache } from './preview-encoded-cache.mjs';

const args = process.argv.slice(2);
/** a `--name value` or `--name=value` argument's value */
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at !== -1) return args[at + 1] ?? fallback;
  return args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
};
const root = resolve(option('root', process.cwd())), outDir = resolve(root, option('outDir', 'dist'));
const port = Number(option('port', '4173')), host = option('host', '127.0.0.1');
if (!existsSync(outDir)) throw new Error(`preview-server: no build in ${outDir}`);

/** `vercel.json` `source` → RegExp. Only the forms the file uses: literal paths and `(.*)` groups (Vercel's
 *  path-to-regexp escapes everything else, `.` included). The rules replay in order; the last match wins per header. */
const sourceRegex = source => new RegExp(`^${source.split('(.*)').map(s => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)).join('(.*)')}/?$`);
const vercel = join(root, 'vercel.json');
const rules = existsSync(vercel) ? (JSON.parse(readFileSync(vercel, 'utf8')).headers ?? []).map(rule => ({ re: sourceRegex(rule.source), headers: rule.headers })) : [];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.txt': 'text/plain', '.map': 'application/json', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream' };
const type = file => TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
// Production also encodes binary scene/pack/mesh payloads, not just text.
const COMPRESSIBLE = /text|javascript|\/json|xml|svg|manifest|octet-stream|wasm|gltf|ktx2/u;
const LOCAL_ORIGIN = /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u;
// Vercel's CDN brotli-compresses application/wasm (~836 KB for Rapier's 3.29 MB); answer the way production does
const RAPIER = join(outDir, 'assets/physics/rapier.wasm');
const rapierBr = existsSync(RAPIER) ? brotliCompressSync(readFileSync(RAPIER), { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } }) : null;
const encodedFiles = createEncodedFileCache();

/** An explicitly refused encoding must not be selected through the wildcard. */
function encodingQuality(header, encoding) {
  let wildcard = 0;
  for (const entry of header.split(',')) {
    const [name, ...parameters] = entry.trim().toLowerCase().split(';');
    const value = parameters.map(part => part.trim()).find(part => part.startsWith('q='));
    const quality = value === undefined ? 1 : Number(value.slice(2));
    const weight = Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
    if (name === encoding) return weight;
    if (name === '*') wildcard = weight;
  }
  return wildcard;
}

function varyEncoding(res) {
  const previous = res.getHeader('Vary');
  const fields = previous === undefined ? [] : String(previous).split(',').map(value => value.trim());
  if (!fields.some(field => field === '*' || field.toLowerCase() === 'accept-encoding')) fields.push('Accept-Encoding');
  res.setHeader('Vary', fields.join(', '));
}

async function streamEncoded(file, encoder, res) {
  try { await pipeline(createReadStream(file), encoder, res); }
  catch (error) { res.destroy(error instanceof Error ? error : new Error(String(error))); }
}

async function sendEncoded(encoded, res) {
  try {
    const bytes = await encoded;
    if (res.destroyed) return;
    // Preserve the existing chunked transfer and HEAD/header behavior.
    res.write(bytes); res.end();
  } catch (error) { res.destroy(error instanceof Error ? error : new Error(String(error))); }
}

/** a file in the build for a URL path, never outside it (`.html` rewrites as the preview server did) */
function lookup(pathname) {
  const candidates = pathname.endsWith('/') ? [`${pathname}index.html`] : [pathname, ...(extname(pathname) === '' ? [`${pathname}.html`] : [])];
  for (const candidate of candidates) {
    const file = resolve(outDir, `.${candidate}`);
    if (file !== outDir && !file.startsWith(outDir + sep)) continue;
    try { const stat = statSync(file); if (stat.isFile()) return { file, stat }; } catch { /* not there */ }
  }
  return null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.statusCode = 400; res.end(); return; }
  const worker = pathname === '/sw.js' || pathname.startsWith('/sw-core/');
  // localhost CORS, as the preview server reflected it; the public worker is identical for every Origin, like
  // production (a Vary: Origin would split WebKit's HTTP cache between a navigation update and reg.update())
  const origin = req.headers.origin;
  if (worker) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin !== undefined && LOCAL_ORIGIN.test(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  for (const rule of rules) if (rule.re.test(pathname)) for (const header of rule.headers) res.setHeader(header.key, header.value);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end(); return; }

  const acceptEncoding = req.headers['accept-encoding'] ?? '';
  let found = lookup(pathname);
  if (found === null) {
    const accept = req.headers.accept;
    // the preview server's SPA fallback: index.html for a missing path a page or a fetch (`*/*`) asks for
    if (accept === undefined || accept === '' || accept.includes('text/html') || accept.includes('*/*')) found = lookup('/index.html');
    if (found === null) { res.statusCode = 404; res.end(); return; }
  }
  const { file, stat } = found, etag = `W/"${stat.size}-${stat.mtime.getTime()}"`;
  res.setHeader('Content-Type', type(file)); res.setHeader('Last-Modified', stat.mtime.toUTCString()); res.setHeader('ETag', etag);
  res.setHeader('Accept-Ranges', 'bytes');
  const compressible = COMPRESSIBLE.test(type(file)) && stat.size >= 1024;
  if (compressible) varyEncoding(res);
  if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return; }
  const range = /^bytes=(\d*)-(\d*)$/u.exec(req.headers.range ?? '');
  if (range !== null && (range[1] !== '' || range[2] !== '')) {
    const start = range[1] === '' ? Math.max(0, stat.size - Number(range[2])) : Number(range[1]);
    const end = range[1] === '' || range[2] === '' ? stat.size - 1 : Math.min(Number(range[2]), stat.size - 1);
    if (start > end || start >= stat.size) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${stat.size}`); res.end(); return; }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`); res.setHeader('Content-Length', String(end - start + 1));
    if (req.method === 'HEAD') res.end(); else createReadStream(file, { start, end }).pipe(res);
    return;
  }
  const br = encodingQuality(acceptEncoding, 'br'), gzip = encodingQuality(acceptEncoding, 'gzip');
  if (compressible && (br > 0 || gzip > 0)) {
    const encoding = br >= gzip ? 'br' : 'gzip';
    res.setHeader('Content-Encoding', encoding);
    if (encoding === 'br' && file === RAPIER && rapierBr !== null) {
      res.setHeader('Content-Length', String(rapierBr.length));
      res.end(req.method === 'HEAD' ? undefined : rapierBr);
    } else if (req.method === 'HEAD') res.end();
    else {
      const identity = [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
      const encoded = encodedFiles.get(file, identity, stat.size, encoding);
      if (encoded !== undefined) {
        void sendEncoded(encoded, res);
        return;
      }
      const encoder = encoding === 'br' ? createBrotliCompress({ params: {
        [zlib.BROTLI_PARAM_QUALITY]: 3, [zlib.BROTLI_PARAM_SIZE_HINT]: stat.size,
      } }) : createGzip();
      void streamEncoded(file, encoder, res);
    }
    return;
  }
  res.setHeader('Content-Length', String(stat.size));
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
});
server.on('error', error => { console.error(`preview-server: ${error.message}`); process.exit(1); });
server.listen(port, host, () => {
  const address = server.address(), bound = typeof address === 'object' && address !== null ? address.port : port;
  console.log(`  ➜  Local:   http://${host}:${bound}/`);
});
process.on('SIGTERM', () => { server.close(); process.exit(0); });
