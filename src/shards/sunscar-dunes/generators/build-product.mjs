// Complete author-only product; admission and immutable bounded reads belong to the SDK.
import source from './product.ts';
import { writeAuthoredProduct } from '@wildshard/sdk/productOutput';

writeAuthoredProduct(source, 'src/shards/sunscar-dunes', 'src/shards/sunscar-dunes/.wildshard/product');
