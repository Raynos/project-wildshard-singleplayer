/** Metadata crosses the browser result; native encoded image bytes use the owned upload route. */
export interface PaintedBake { readonly ext: 'png' | 'webp'; readonly width: number; readonly height: number }

/** Keep the canvas encoder's original MIME/quality, including its PNG fallback. */
export async function sendPaintedCanvas(name: string, canvas: Pick<HTMLCanvasElement, 'width' | 'height' | 'toBlob'>,
  type: 'image/png' | 'image/webp', byteUrl: string, quality?: number, send: typeof fetch = fetch): Promise<PaintedBake> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => {
      if (value === null) reject(new Error(`Pine painted ${name}: encoding failed`)); else resolve(value);
    }, type, quality);
  });
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : undefined;
  if (ext === undefined) throw new Error(`Pine painted ${name}: unsupported encoded format`);
  const response = await send(`${byteUrl}${name}`, { method: 'POST', body: blob });
  if (!response.ok) throw new Error(`Pine painted ${name}: byte handoff refused`);
  return { ext, width: canvas.width, height: canvas.height };
}
