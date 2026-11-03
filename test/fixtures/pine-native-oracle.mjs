// Run the original typed constructor in a fresh source-fenced Node realm.
import { pineNativeOracleInputs } from './pine-headless.ts';
import { encodeCanonicalJson } from '../../src/sdk/immutable.ts';
process.stdout.write(encodeCanonicalJson(pineNativeOracleInputs()));
