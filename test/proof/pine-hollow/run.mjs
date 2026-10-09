// Fail-closed compatibility probe: partial ledger coverage is not whole-shard compatibility.
// oxlint-disable-next-line import/no-nodejs-modules -- Native proof mode and failure status are CLI results, not game configuration.
import process from 'node:process';
import { compatibilityProbe } from '../compatibility/fixture.ts';

const result = await compatibilityProbe('pine-hollow', 'runtime/index.ts', process.argv.at(2) ?? 'all');
console.info(JSON.stringify(result));
process.exitCode = 1;
