// A read-only HTTP observer for Simulator parity: forwards the served committed build unchanged.
import http from 'node:http';

export async function observeTransport(upstream) {
  const receipts = [];
  const server = http.createServer((request, response) => {
    const target = new URL(request.url ?? '/', upstream);
    const forwarded = http.request(target, { method: request.method, headers: { ...request.headers, host: target.host } }, incoming => {
      // Fixed-length replies preserve the upstream wire length; unknown lengths use chunked framing.
      const headers = { ...incoming.headers, connection: 'close' };
      delete headers['keep-alive'];
      response.writeHead(incoming.statusCode ?? 502, headers);
      let body = 0;
      incoming.on('data', chunk => { body += chunk.length; response.write(chunk); });
      incoming.on('end', () => {
        response.end();
        receipts.push({ url: target.href, endedAt: Date.now(), bodyBytes: body,
          // Resource Timing's transferSize charges a fixed 300-byte header estimate.
          // Keep the independent observed payload and actual response headers separate.
          headerBytes: Buffer.byteLength(`HTTP/1.1 ${incoming.statusCode} ${incoming.statusMessage}\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${value}\r\n`).join('')}\r\n`) });
      });
      incoming.on('error', () => response.destroy());
    });
    forwarded.on('error', () => { response.writeHead(502); response.end(); });
    request.pipe(forwarded);
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No observer port');
  return { base: `http://127.0.0.1:${address.port}/`, receipts,
    close: () => new Promise(resolve => { server.close(resolve); }) };
}
