// Complete author-only product; bounded file reads and admission belong to the SDK.
import source from './product.ts';
import { writeAuthoredProduct } from '@wildshard/sdk/productOutput';

// The normal project build packs the current generated map. Keeping it out of
// this immutable source fixture avoids content-addressed output names changing
// whenever a world placement changes.
writeAuthoredProduct(source, 'src/shards/_template', 'src/shards/_template/.wildshard/product');
