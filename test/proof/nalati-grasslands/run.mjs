// Partial gameplay coverage remains a failed whole-shard compatibility result.
// oxlint-disable-next-line import/no-nodejs-modules -- Native proof mode and exit status are CLI results.
import process from 'node:process';
import { compatibilityProbe } from '../compatibility/fixture.ts';
import { nalatiNativeWitness } from './witness.ts';

const mode = process.argv.at(2) ?? 'all';
if (!['all', 'headless', 'replay', 'ledger'].includes(mode)) throw new Error('Unknown compatibility proof mode');
const ledger = mode === 'all' || mode === 'ledger' ? await compatibilityProbe('nalati-grasslands', 'runtime/headless.ts', 'ledger') : {};
const native = mode === 'ledger' ? {} : await nalatiNativeWitness(mode !== 'headless');
console.info(JSON.stringify({ slug: 'nalati-grasslands', ...ledger, ...native }));
process.exitCode = 1;
