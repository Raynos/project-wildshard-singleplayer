// Complete author-only product; admission and immutable bounded reads belong to the SDK.
import source from './product.ts';
import map from '../data/productMap.json' with { type: 'json' };
import { writeAuthoredProduct } from '@wildshard/sdk/productOutput';

writeAuthoredProduct(source, 'src/shards/sunscar-dunes', 'src/shards/sunscar-dunes/.wildshard/product', { file: 'assets/map.webp', tilesHash: map.tilesHash });
