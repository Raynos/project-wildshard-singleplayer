import { realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/** Resolve only regular product files; symlinks cannot turn the static server into a source reader.
 * @param {string} product @param {string} pathname @returns {string}
 */
export function productFile(product, pathname) {
  const root = realpathSync(product);
  const file = realpathSync(resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`));
  if (!file.startsWith(`${root}${sep}`) || !statSync(file).isFile()) throw new Error('Not an admitted product file');
  return file;
}
/** Admit bounded real keyboard input; URLs, arbitrary evaluation and host commands are not driver operations.
 * @param {unknown} value @returns {{op: string, code?: string, key?: string, duration?: number}}
 */
export function browserOperation(value) {
  if (typeof value !== 'object' || value === null || !('op' in value) || typeof value.op !== 'string') throw new Error('Invalid browser operation');
  const op = value.op;
  if (Object.keys(value).some(key => !['op', 'code', 'key', 'duration'].includes(key))) throw new Error('Unknown browser field');
  if (['text', 'scene', 'equipment', 'close'].includes(op)) {
    if (Object.keys(value).length !== 1) throw new Error('Unexpected browser arguments');
    return { op };
  }
  if (op === 'evaluate' && 'code' in value && typeof value.code === 'string' && value.code.length <= 16_384 && Object.keys(value).length === 2) return { op, code: value.code };
  if (op === 'key' && 'key' in value && typeof value.key === 'string'
    && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space', 'w', 'a', 's', 'd', 'e'].includes(value.key)) {
    const duration = 'duration' in value ? value.duration : 0;
    if (Object.keys(value).some(key => key === 'code') || typeof duration !== 'number' || !Number.isInteger(duration) || duration < 0 || duration > 10_000) throw new Error('Invalid browser key duration');
    return { op, key: value.key, duration };
  }
  throw new Error('Unsupported browser operation');
}
/** Validate a file-pipe envelope without accepting a caller-chosen reply path.
 * @param {unknown} value @returns {{id: string, message: unknown}}
 */
export function browserPacket(value) {
  if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string'
    || !/^[a-f0-9-]{36}$/u.test(value.id) || !('message' in value) || Object.keys(value).length !== 2) throw new Error('Invalid browser packet');
  return { id: value.id, message: value.message };
}
/** Harvest the exact installed SDK readers, without ever supplying evidence to their proof validators.
 * @param {Pick<typeof import('../../src/sdk/headless'), 'proveSceneClient' | 'proveEquippedItemClient'>} sdk
 * @returns {Promise<Map<string, () => unknown>>}
 */
export async function proofReaders(sdk) {
  const readers = new Map(), captured = new Error('Proof reader captured');
  const port = { /** @param {() => unknown} read */ evaluate(read) { readers.set(read.toString(), read); return Promise.reject(captured); } };
  for (const call of [() => sdk.proveSceneClient(port, { creatures: [], selectedInteraction: null }), () => sdk.proveEquippedItemClient(port, '', '')]) {
    try { await call(); throw new Error('Proof must read the actual client'); }
    catch (error) { if (error !== captured) throw error; }
  }
  if (readers.size !== 2) throw new Error('Missing installed SDK proof readers');
  return readers;
}
