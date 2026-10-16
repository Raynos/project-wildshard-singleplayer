import { contractCatalogue } from '../../src/shards/pine-hollow/generators/contractRows';
import { parseContractCatalogue } from '../../src/shards/pine-hollow/runtime/lodge';

/** Unit fixtures use the retained author through the real parser; play requires admitted product bytes. */
export const CONTRACTS = parseContractCatalogue(contractCatalogue());
