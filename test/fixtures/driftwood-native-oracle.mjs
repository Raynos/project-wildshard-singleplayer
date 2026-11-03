// Run the original typed constructor in a fresh source-fenced Node realm.
import { driftwoodNativeOracleInputs } from './driftwood-headless.ts';
import { encodeCanonicalJson } from '../../src/sdk/immutable.ts';
process.stdout.write(encodeCanonicalJson(driftwoodNativeOracleInputs()));
