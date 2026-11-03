import { nalatiNativeBootInputs } from './nalati-native-boot-inputs.ts';
import { encodeCanonicalJson } from '../../src/sdk/immutable.ts';

console.log(encodeCanonicalJson(nalatiNativeBootInputs()));
