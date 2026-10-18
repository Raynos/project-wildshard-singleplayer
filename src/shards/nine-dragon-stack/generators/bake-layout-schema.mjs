// Build the native boot blob's defining schema alongside its standalone types.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeSectionSchemaBridge } from '../../../../scripts/bake-section-schemas.mjs';
import { formatJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { GeometryBootSchema } from './sections.ts';

await writeSectionSchemaBridge(process.cwd(), 'nine-dragon-stack');
writeFileSync(resolve('src/shards/nine-dragon-stack/generators/layoutSchema.generated.json'),
  `${JSON.stringify(formatJsonSchema(GeometryBootSchema, 'draft-07'))}\n`);
