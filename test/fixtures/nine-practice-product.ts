// oxlint-disable-next-line import/no-nodejs-modules -- Browser-facing fixtures borrow the actual admitted product, never a generated source file or Node compiler.
import { readFileSync } from 'node:fs';
import { parseDecisionScripts } from '../../src/format/decisionScripts';
import { admitScriptContract } from '../../src/format/scriptContract';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';

const scripts = parseDecisionScripts(JSON.parse(readFileSync('out/nine-dragon-stack/sections/actors/return-scripts.json', 'utf8')));
const script = scripts[0];
if (scripts.length !== 1 || script === undefined) throw new Error('Missing actual practice contract');
if (hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ script }))) !== '9127647ac9e42b887da2e4affd59f7e74e3a2d9c9e22263fa35991c20675e8a9') throw new Error('Actual practice contract differs');
const hash = '6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102';
if (script.module !== `blobs/wasm/${hash}.wasm`) throw new Error('Actual practice module identity differs');
export const ninePracticeRows = { script, bytes: '' };
export const ninePracticeBytes = new Uint8Array(readFileSync(`out/nine-dragon-stack/${script.module}`));
if (ninePracticeBytes.byteLength !== 9786 || hashImmutableBytes(ninePracticeBytes) !== hash) throw new Error('Actual practice module differs');
admitScriptContract(ninePracticeBytes, { abi: 1, pages: script.pages });
