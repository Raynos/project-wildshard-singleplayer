import { contractCatalogue } from '../../src/shards/pine-hollow/generators/contractRows';
import { parseContractCatalogue } from '../../src/format/contracts';

/** Unit fixtures use the retained author through the real parser; play requires admitted product bytes. */
export const CONTRACTS = parseContractCatalogue(contractCatalogue());
