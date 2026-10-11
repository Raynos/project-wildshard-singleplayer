// POSIX file-pipe IPC keeps the seat's OS network denial intact; no TCP socket or CDP endpoint enters the seat.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants, existsSync, fstatSync, lstatSync, openSync, closeSync, realpathSync, unlinkSync, writeSync } from 'node:fs';
import { Socket } from 'node:net';
import { resolve as resolvePath } from 'node:path';

/** Open an owned FIFO as a libuv pipe stream (Socket wraps this file descriptor; it never connects to a network).
 * @param {string} path @param {boolean} [create] @returns {Socket}
 */
export function browserPipe(path, create = false) {
  if (create) execFileSync('mkfifo', ['-m', '600', path]);
  if (realpathSync(path) !== path || !lstatSync(path).isFIFO()) throw new Error('Expected an owned browser FIFO');
  const fd = openSync(path, constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  if (!fstatSync(fd).isFIFO()) { closeSync(fd); throw new Error('Browser pipe replaced'); }
  return new Socket({ fd, readable: true, writable: true });
}
/** Send one atomic bounded request and await its reply without filesystem polling.
 * @param {string} channel @param {object} message @param {number} [timeoutMs] @returns {Promise<unknown>}
 */
export async function browserRequest(channel, message, timeoutMs = 60_000) {
  const root = resolvePath(channel), id = randomUUID(), reply = resolvePath(root, 'replies', `${id}.fifo`);
  const json = `${JSON.stringify({ id, message })}\n`;
  if (Buffer.byteLength(json) > 4096) throw new Error('Browser request exceeds the 4 KiB atomic pipe bound');
  const receiver = browserPipe(reply, true);
  try {
    const raw = await new Promise((resolve, reject) => {
      let bytes = 0; const chunks = [];
      const timer = setTimeout(() => { reject(new Error('Browser relay deadline exceeded')); }, timeoutMs);
      receiver.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 2_097_152) { clearTimeout(timer); reject(new Error('Browser reply exceeds 2 MiB')); return; }
        chunks.push(chunk);
        if (chunk.includes(10)) { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')); }
      });
      receiver.on('error', error => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); });
      const request = resolvePath(root, 'requests.fifo');
      try {
        if (realpathSync(request) !== request || !lstatSync(request).isFIFO()) throw new Error('Expected browser request FIFO');
        const fd = openSync(request, constants.O_WRONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
        try { if (!fstatSync(fd).isFIFO() || writeSync(fd, json) !== Buffer.byteLength(json)) throw new Error('Browser request not delivered'); }
        finally { closeSync(fd); }
      } catch (error) { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); }
    });
    const response = /** @type {unknown} */ (JSON.parse(raw));
    if (typeof response !== 'object' || response === null || !('ok' in response)) throw new Error('Invalid browser relay reply');
    if (response.ok !== true) throw new Error('error' in response ? String(response.error) : 'Browser request refused');
    return 'value' in response ? response.value : undefined;
  } finally { receiver.destroy(); if (existsSync(reply)) unlinkSync(reply); }
}
/** Reply only into the requesting seat's already-open FIFO; never write a regular source or product file.
 * @param {string} reply @param {object} response @returns {Promise<void>}
 */
export async function browserReply(reply, response) {
  if (realpathSync(reply) !== reply || !lstatSync(reply).isFIFO()) throw new Error('Expected browser reply FIFO');
  const fd = openSync(reply, constants.O_WRONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  if (!fstatSync(fd).isFIFO()) { closeSync(fd); throw new Error('Browser reply pipe replaced'); }
  const writer = new Socket({ fd, readable: false, writable: true });
  try { await new Promise((resolve, reject) => { writer.once('error', reject); writer.end(`${JSON.stringify(response)}\n`, resolve); }); }
  finally { writer.destroy(); }
}
