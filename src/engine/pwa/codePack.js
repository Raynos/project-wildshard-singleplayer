/** Verify the complete transport and every member before publishing any code.
 * The worker's build-owned registry authenticates the compressed hash/lengths.
 * Views are short-lived; no payload is retained after the cache writes finish.
 * @param {ArrayBuffer} wire
 * @param {readonly [number, number, string]} expected
 * @param {ReadonlySet<string>} allowed
 * @returns {Promise<readonly (readonly [string, Uint8Array<ArrayBuffer>])[]>} */
export async function codePackEntries(wire, expected, allowed) {
  const [encoded, decoded, hash] = expected;
  if (!Number.isSafeInteger(encoded) || encoded < 1 || encoded > 32 * 1024 * 1024 || wire.byteLength !== encoded
    || !Number.isSafeInteger(decoded) || decoded < 12 || decoded > 32 * 1024 * 1024
    || !/^[a-f0-9]{64}$/.test(hash) || await codePackHash(wire) !== hash) throw new Error('Code pack transport differs');
  const reader = new Blob([wire]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  /** @type {Uint8Array[]} */ const chunks = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > decoded) throw new Error('Oversized decoded code pack');
      chunks.push(result.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  if (size !== decoded) throw new Error('Truncated decoded code pack');
  const body = new Uint8Array(decoded); let at = 0;
  for (const bytes of chunks) { body.set(bytes, at); at += bytes.length; }
  if (new TextDecoder().decode(body.subarray(0, 8)) !== 'WSCODE01') throw new Error('Invalid code pack magic');
  const headerBytes = new DataView(body.buffer).getUint32(8, true), start = 12 + headerBytes;
  if (headerBytes < 2 || headerBytes > 1024 * 1024 || start > decoded) throw new Error('Invalid code pack header');
  /** @type {unknown} */
  const rows = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.subarray(12, start)));
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 4096) throw new Error('Invalid code pack inventory');
  /** @type {Set<string>} */ const found = new Set();
  /** @type {[string, Uint8Array<ArrayBuffer>][]} */
  const entries = []; let offset = 0;
  for (const input of rows) {
    /** @type {unknown} */ const row = input;
    if (!Array.isArray(row) || row.length !== 4) throw new Error('Invalid code pack member');
    /** @type {unknown} */ const url = row[0];
    /** @type {unknown} */ const position = row[1];
    /** @type {unknown} */ const bytes = row[2];
    /** @type {unknown} */ const digest = row[3];
    if (typeof url !== 'string' || !/^\/assets\/[a-zA-Z0-9_.-]+\.js$/.test(url) || !allowed.has(url) || found.has(url)
      || typeof position !== 'number' || !Number.isSafeInteger(position) || position !== offset
      || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0
      || start + position + bytes > decoded || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid code pack member');
    const value = body.subarray(start + position, start + position + bytes);
    if (await codePackHash(value.slice().buffer) !== digest) throw new Error('Code pack member differs');
    found.add(url); entries.push([url, value]); offset += bytes;
  }
  if (start + offset !== decoded) throw new Error('Trailing code pack bytes');
  return entries;
}

/** @param {ArrayBuffer} bytes @returns {Promise<string>} */
async function codePackHash(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** @param {Response} response @param {number} expected @returns {Promise<ArrayBuffer>} */
export async function readCodePackTransport(response, expected) {
  if (!response.ok || response.body === null || !Number.isSafeInteger(expected) || expected < 1 || expected > 32 * 1024 * 1024) throw new Error('Failed code pack transport');
  const reader = response.body.getReader(), body = new Uint8Array(expected); let at = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (at + result.value.byteLength > expected) throw new Error('Oversized code pack transport');
      body.set(result.value, at); at += result.value.byteLength;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  if (at !== expected) throw new Error('Truncated code pack transport');
  return body.buffer;
}
