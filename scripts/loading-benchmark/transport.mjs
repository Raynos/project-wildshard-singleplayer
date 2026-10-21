// Observe served asset bytes unchanged; optional HTML recorder fixtures retain both content hashes.
import http from 'node:http';
import { createHash } from 'node:crypto';

export async function observeTransport(upstream, fixture = {}) {
  const receipts = [], htmlFixtures = [];
  const server = http.createServer((request, response) => {
    // Proof-only offline boundary: fail the wire, retaining the browser's real worker/content caches.
    if (fixture.offline?.() === true) { request.socket.destroy(); return; }
    if (request.url === '/sf67-start.html' && fixture.start !== undefined) {
      response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      response.end(fixture.start); return;
    }
    const target = new URL(request.url ?? '/', upstream);
    const inject = fixture.recorder !== undefined && (target.pathname === '/' || target.pathname === '/index.html');
    const requestHeaders = { ...request.headers, host: target.host };
    if (inject) {
      requestHeaders['accept-encoding'] = 'identity';
      delete requestHeaders['if-none-match']; delete requestHeaders['if-modified-since'];
    }
    const forwarded = http.request(target, { method: request.method, headers: requestHeaders }, incoming => {
      // Fixed-length replies preserve the upstream wire length; unknown lengths use chunked framing.
      const headers = { ...incoming.headers, connection: 'close' };
      delete headers['keep-alive'];
      const chunks = [];
      if (!inject) response.writeHead(incoming.statusCode ?? 502, headers);
      let body = 0;
      incoming.on('data', chunk => { body += chunk.length; if (inject) chunks.push(chunk); else response.write(chunk); });
      incoming.on('end', () => {
        if (inject) {
          const original = Buffer.concat(chunks).toString('utf8');
          const patched = original.replace('<head>', `<head><script>${fixture.prelude ?? ''}(${fixture.recorder.toString()})();</script>`);
          htmlFixtures.push({ originalSHA256: createHash('sha256').update(original).digest('hex'),
            injectedSHA256: createHash('sha256').update(patched).digest('hex') });
          body = Buffer.byteLength(patched);
          delete headers['transfer-encoding'];
          headers['content-length'] = String(body);
          headers['cache-control'] = 'no-store';
          response.writeHead(incoming.statusCode ?? 502, headers); response.write(patched);
        }
        response.end();
        receipts.push({ url: target.href, status: incoming.statusCode ?? 502, endedAt: Date.now(), bodyBytes: body,
          requestCache: { cacheControl: request.headers['cache-control'], ifNoneMatch: request.headers['if-none-match'],
            ifModifiedSince: request.headers['if-modified-since'], acceptEncoding: request.headers['accept-encoding'],
            serviceWorker: request.headers['service-worker'], origin: request.headers.origin,
            destination: request.headers['sec-fetch-dest'], mode: request.headers['sec-fetch-mode'], accept: request.headers.accept },
          responseCache: { etag: incoming.headers.etag, cacheControl: incoming.headers['cache-control'],
            vary: incoming.headers.vary, contentEncoding: incoming.headers['content-encoding'] },
          // Resource Timing's transferSize charges a fixed 300-byte header estimate.
          // Keep the independent observed payload and actual response headers separate.
          headerBytes: Buffer.byteLength(`HTTP/1.1 ${incoming.statusCode} ${incoming.statusMessage}\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${value}\r\n`).join('')}\r\n`) });
      });
      incoming.on('error', () => { response.destroy(); });
    });
    forwarded.on('error', () => { response.writeHead(502); response.end(); });
    request.pipe(forwarded);
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No observer port');
  return { base: `http://127.0.0.1:${address.port}/`, receipts, htmlFixtures,
    close: () => new Promise(resolve => { server.close(resolve); }) };
}
