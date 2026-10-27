/** Read one build-addressed grid asset, refusing size, path and digest changes. */
export async function readGridAssetBytes(address: { readonly url: string; readonly bytes: number; readonly sha256: string }, read: (url: string) => Promise<Response>, kind: 'seams' | 'strips'): Promise<Uint8Array<ArrayBuffer>> {
  const path = kind === 'seams' ? /^\/assets\/grid-seams-[a-f0-9]{8}\.json$/u : /^\/assets\/grid-strip-(?:(?:book|page)-[a-f0-9]{8}\.json|mesh-[a-f0-9]{8}\.bin)$/u;
  const label = kind === 'seams' ? 'Grid seam data' : 'Grid strip data';
  if (!path.test(address.url) || !/^[a-f0-9]{64}$/u.test(address.sha256)
    || !address.url.includes(address.sha256.slice(0, 8))
    || !Number.isSafeInteger(address.bytes) || address.bytes <= 0 || address.bytes > 16 * 1024 * 1024) throw new Error(kind === 'seams' ? 'Invalid grid seam address' : 'Invalid grid strip address');
  const response = await read(address.url);
  if (!response.ok) throw new Error(`${label} ${response.status}`);
  if (response.body === null) throw new Error(`${label} body is missing`);
  const wire = new Uint8Array(address.bytes), reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      if (part.value.length > wire.length - size) throw new Error(`${label} size differs from the build`);
      wire.set(part.value, size); size += part.value.length;
    }
    if (size !== wire.length) throw new Error(`${label} size differs from the build`);
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', wire.buffer));
  if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') !== address.sha256) throw new Error(`${label} differs from the build`);
  return wire;
}
