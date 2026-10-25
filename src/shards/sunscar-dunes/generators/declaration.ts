import { readImagePixels } from '@wildshard/sdk/bake/image';
import { bakeFireBook } from './fireBookPixels';
import { signalProductRows } from './product';

/** The retained declaration writer derives its texture metadata from the same authored pixels. */
export async function signalDeclarationFiles(read: (path: string) => Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const image = await readImagePixels(read('src/shards/sunscar-dunes/generators/fireBook.webp'), { flipY: false });
  const product = signalProductRows(bakeFireBook(image).file);
  return new Map([['data/product.generated.json', new TextEncoder().encode(`${JSON.stringify(product)}\n`)]]);
}
