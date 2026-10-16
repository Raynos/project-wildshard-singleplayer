import product from './generators/product';
import { CARD } from './data/card';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';

// Edit this documented project entry; the cold producer reads the same author-only declaration.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads this project entry.
export default parseShardfile({ ...product, manifest: CARD });

/** Source inputs become named hash blobs; no author module enters the client. */
export const output = { blobs: [{ name: 'ui/map', kind: 'image', source: 'assets/map.webp' }] } satisfies ProjectOutput;
