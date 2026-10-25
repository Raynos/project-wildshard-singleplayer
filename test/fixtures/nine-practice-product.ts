// oxlint-disable-next-line import/no-nodejs-modules -- Browser-facing fixtures read the pinned executable checked against the independent cold compiler.
import { readFileSync } from 'node:fs';
import { courseProgramInputs } from '../../src/commons/courseProgram';
import { admitScriptContract } from '../../src/format/scriptContract';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';

const hash = '6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102';
const courseSource = readFileSync('src/commons/scripts/course.as', 'utf8');
const script = courseProgramInputs('checkpoints', {}, { module: `blobs/wasm/${hash}.wasm`,
  sourceHash: hashImmutableBytes(new TextEncoder().encode(courseSource)) }).row;
if (hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ script }))) !== '9127647ac9e42b887da2e4affd59f7e74e3a2d9c9e22263fa35991c20675e8a9') throw new Error('Actual practice contract differs');
if (script.module !== `blobs/wasm/${hash}.wasm`) throw new Error('Actual practice module identity differs');
export const ninePracticeRows = { script, bytes: '' };
export const ninePracticeBytes = new Uint8Array(readFileSync('test/fixtures/nine-practice-course.wasm'));
if (ninePracticeBytes.byteLength !== 9786 || hashImmutableBytes(ninePracticeBytes) !== hash) throw new Error('Actual practice module differs');
admitScriptContract(ninePracticeBytes, { abi: 1, pages: script.pages });
