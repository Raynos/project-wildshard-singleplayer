import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/** One bounded native PNG per declared bench variant; no image enters result JSON.
 * @param {ReadonlyMap<string,string|null>} targets null discards the warm-up frame.
 * @param {number} [maximum] */
export function pngReceiver(targets, maximum = 32 * 1024 * 1024) {
  if (!Number.isSafeInteger(maximum) || maximum < 8
    || [...targets.keys()].some(key => !/^[a-z0-9][a-z0-9-]{0,79}$/u.test(key))) throw new Error('Invalid PNG upload limits');
  /** @type {Set<string>} */
  const claimed = new Set();
  /** @type {Set<()=>void>} */
  const pending = new Set();
  let closed = false;
  return {
    /** @param {import('node:http').IncomingMessage} request @param {import('node:http').ServerResponse} response */
    handle(request, response) {
      if (!request.url?.startsWith('/shot/')) return false;
      const variant = request.url.slice('/shot/'.length);
      if (closed || request.method !== 'POST' || !targets.has(variant) || claimed.has(variant)
        || request.headers['content-type'] !== 'image/png') {
        request.resume(); response.writeHead(400); response.end('Invalid PNG upload'); return true;
      }
      claimed.add(variant);
      /** @type {Buffer[]} */
      const chunks = [];
      let bytes = 0, finished = false;
      /** @param {number} status @param {string} [message] */
      const finish = (status, message) => {
        if (finished) return;
        finished = true; chunks.length = 0; pending.delete(cancel);
        response.writeHead(status); response.end(message);
      };
      function cancel() { finish(503, 'PNG receiver closed'); request.destroy(); }
      pending.add(cancel);
      request.on('data', chunk => {
        if (finished) return;
        if (!Buffer.isBuffer(chunk) || (bytes += chunk.length) > maximum) { finish(413, 'PNG exceeds upload limit'); return; }
        chunks.push(chunk);
      });
      request.on('aborted', () => { finish(400, 'Incomplete PNG upload'); });
      request.on('error', () => { finish(400, 'PNG upload failed'); });
      request.on('end', () => {
        if (finished) return;
        const body = Buffer.concat(chunks, bytes);
        if (body.length < 8 || body.readUInt32BE(0) !== 0x89504e47 || body.readUInt32BE(4) !== 0x0d0a1a0a) { finish(400, 'Invalid PNG bytes'); return; }
        try {
          const target = targets.get(variant);
          if (target !== null && target !== undefined) {
            const temporary = `${target}.upload-${randomUUID()}`;
            try { writeFileSync(temporary, body); renameSync(temporary, target); }
            finally { rmSync(temporary, { force: true }); }
          }
          finish(204);
        } catch { finish(500, 'PNG publication failed'); }
      });
      return true;
    },
    dispose() { closed = true; for (const cancel of pending) cancel(); pending.clear(); claimed.clear(); },
  };
}
