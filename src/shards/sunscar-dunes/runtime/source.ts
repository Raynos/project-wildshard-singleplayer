import rows from '../data/product.generated.json' with { type: 'json' };
import { parseShardfile } from '@wildshard/format/shardSchema';

// oxlint-disable-next-line import/no-default-export -- Existing runtime consumers share one admitted declaration.
export default parseShardfile(rows);
