// Complete author-only product; bounded file reads and admission belong to the SDK.
import source from './product.ts';
import map from '../data/productMap.json' with { type: 'json' };
import { writeAuthoredProduct } from '@wildshard/sdk/productOutput';

writeAuthoredProduct(source, 'src/shards/pastel-plain', 'src/shards/pastel-plain/.wildshard/product', { file: 'assets/map.webp', tilesHash: map.tilesHash });
