import { parseShardfileField, type Shardfile } from '@wildshard/sdk/shardfile';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { driftwoodFixedFiles } from './fixedProgram';

/** Original fixed world fields used by the declaration, validated at the owned-byte boundary. */
export interface DriftwoodFixedProduct extends Pick<Shardfile, 'terrain' | 'props' | 'tiles' | 'files' | 'library' | 'critical'> {
  libraryCost: { resident: number; compressed: number };
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validCost = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Validate untrusted cached metadata through the same declaration schema as the original product. */
export function driftwoodFixedProductRows(input: unknown): DriftwoodFixedProduct {
  if (!isRecord(input) || !isRecord(input['libraryCost'])) throw new Error('Missing Driftwood fixed product metadata');
  const cost = input['libraryCost'];
  if (!validCost(cost['resident']) || !validCost(cost['compressed'])) throw new Error('Invalid Driftwood fixed library cost');
  return { terrain: parseShardfileField('terrain', input['terrain']), props: parseShardfileField('props', input['props']),
    tiles: parseShardfileField('tiles', input['tiles']), files: parseShardfileField('files', input['files']),
    library: parseShardfileField('library', input['library']), critical: parseShardfileField('critical', input['critical']),
    libraryCost: { resident: cost['resident'], compressed: cost['compressed'] } };
}

/** Build the declared world from owned bytes and publish only its hash-bound asset closure. */
export async function driftwoodFixedProduct(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<DriftwoodFixedProduct> {
  const files = await driftwoodFixedFiles(ctx), metadata = files.get('data/fixedTiles.generated.json');
  if (metadata === undefined) throw new Error('Missing owned Driftwood fixed metadata');
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  const product = driftwoodFixedProductRows(input);
  for (const file of product.files) {
    const bytes = files.get(`assets/${file.hash}`) ?? files.get(`owned/coarse/${file.hash}.glb`);
    if (bytes === undefined || bytes.byteLength !== file.compressed || ctx.asset(bytes) !== file.hash) throw new Error('Driftwood fixed asset inventory differs');
  }
  return product;
}
