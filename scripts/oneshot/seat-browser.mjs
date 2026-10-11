#!/usr/bin/env node
import { resolve } from 'node:path';
import { browserRequest } from './browser-channel.mjs';

/** A real remote AuthorProofPage. Only the installed SDK's exact read-only proof callbacks are admitted by the broker.
 * The SDK validates the returned evidence; this transport adds no observations or gameplay grants.
 * @param {string} channel @returns {import('@wildshard/sdk/headless').AuthorProofPage}
 */
export function seatProofPage(channel) {
  return {
    async evaluate(read) {
      const value = await browserRequest(channel, { op: 'evaluate', code: read.toString() });
      // This is the generic transport boundary; the receiving SDK proof parses its concrete evidence schema.
      return /** @type {ReturnType<typeof read>} */ (value);
    },
  };
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) {
  const [channel, op, key, duration] = process.argv.slice(2);
  if (channel === undefined || !['text', 'scene', 'equipment', 'key', 'close'].includes(op ?? ''))
    throw new Error('Usage: node seat-browser.mjs CHANNEL text|scene|equipment|key KEY [MILLISECONDS]|close');
  console.info(JSON.stringify(await browserRequest(channel, { op, ...(key === undefined ? {} : { key }), ...(duration === undefined ? {} : { duration: Number(duration) }) })));
}
