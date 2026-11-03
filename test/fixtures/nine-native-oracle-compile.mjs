import { nineNativeOracleInputs } from './nine-native-oracle-inputs.ts';
import { encodeCanonicalJson } from '../../src/sdk/immutable.ts';

console.log(encodeCanonicalJson(nineNativeOracleInputs()));
