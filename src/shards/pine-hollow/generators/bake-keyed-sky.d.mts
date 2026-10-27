/** The keyed sky rows (sky.json with each key's packed file, size and horizon) and the packed key bytes by product name
 *  (src/shards/pine-hollow/generators/bake-keyed-sky.mjs), built once per process. */
export function pineKeyedSky(): Promise<{ rows: Readonly<Record<string, unknown>>; blobs: [string, Uint8Array][] }>;
