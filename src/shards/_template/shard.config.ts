import product from './generators/product';
import { CARD } from './data/card';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import boss from './behaviour/boss.json' with { type: 'json' };

// Edit this documented project entry; the cold producer reads the same author-only declaration.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads this project entry.
export default parseShardfile({ ...product, manifest: CARD,
  files: [...product.files, { hash: boss.hash, kind: 'wasm', compressed: boss.compressed,
    decoded: boss.compressed, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true }],
  critical: [...product.critical, boss.hash],
});

