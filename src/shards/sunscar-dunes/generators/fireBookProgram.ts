import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeFireBook, fireBookFile, type FireBookFile } from './fireBookPixels';

const input = 'generators/fireBook.webp';
function only(files: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array {
  const bytes = files.get(name);
  if (files.size !== 1 || bytes === undefined) throw new Error('Fire-book cache inventory differs');
  return bytes;
}

/** Decode freshly, even on hits: packed bytes depend on actual decoder pixels as well as the source program. */
export async function signalFireBook(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset' | 'readImagePixels'>): Promise<{ bytes: Uint8Array; file: FireBookFile }> {
  const source = only(await ctx.cached({ id: 'fire-book-input', inputs: [input] }, files => new Map([['source.webp', only(files, input)]])), 'source.webp');
  const image = await ctx.readImagePixels(source, { flipY: false });
  const pixels = new Uint8Array(image.pixels.buffer, image.pixels.byteOffset, image.pixels.byteLength);
  const key = hashImmutableBytes(new TextEncoder().encode(`${String(image.width)}x${String(image.height)}:${hashImmutableBytes(pixels)}`));
  const bytes = only(await ctx.cached({ id: `fire-book-${key}`, native: true }, () => new Map([['fire-book.ktx2', bakeFireBook(image).bytes]])), 'fire-book.ktx2');
  const file = fireBookFile(bytes);
  if (ctx.asset(bytes) !== file.hash) throw new Error('Fire-book publication differs');
  return { bytes, file };
}
