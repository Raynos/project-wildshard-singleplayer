import { parseContractCatalogue,type ContractCatalogue } from '@wildshard/format/contracts';
import data from '../data/contracts.json' with {type:'json'};
import program from '../data/contractsProgram.generated.json' with {type:'json'};

const rows=parseContractCatalogue({...data,program});
/** Original author exports remain available to the transaction oracle. */
export const CONTRACT_ROWS:Readonly<ContractCatalogue['rows']>=rows.rows;
/** Detached authored data; live serials, progress and continuation are never baked. */
export function contractCatalogue():ContractCatalogue{return structuredClone(rows);}
