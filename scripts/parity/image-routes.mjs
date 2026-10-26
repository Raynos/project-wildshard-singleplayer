import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

/** Borrow immutable screenshot bytes until the compositor releases its routes.
 * @param {Pick<import('playwright').Page,'route'|'unroute'>} page
 * @param {readonly Uint8Array[]} images */
export async function jpegImageRoutes(page, images) {
  const url = `https://board-images.invalid/${randomUUID()}/`, pattern = `${url}*`;
  const inputs = new Map(images.map((bytes, index) => [String(index), Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)]));
  /** @param {import('playwright').Route} route */
  const read = async route => {
    const request = route.request(), bytes = request.method() === 'GET' ? inputs.get(request.url().slice(url.length)) : undefined;
    await route.fulfill({ status: bytes === undefined ? 404 : 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'image/jpeg' },
      body: bytes ?? 'Missing board image' });
  };
  await page.route(pattern, read);
  return { urls: images.map((_bytes, index) => `${url}${index}`),
    async dispose() { inputs.clear(); await page.unroute(pattern, read); } };
}
