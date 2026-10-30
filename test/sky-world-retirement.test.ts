// oxlint-disable-next-line import/no-nodejs-modules -- Isolate actual sealed consumers from every retired handoff.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine expanded omission descriptors to repository scratch.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { MILL_REST_INPUTS, skyMillRestProgram, skyMillRestSource } from '../src/shards/far-reach/generators/millRestProgram';
import { hashImmutableBytes } from '../src/sdk/immutable';

// Every former handoff must remain absent from an isolated native consumer.
const retiredPaths = [
  "public/assets/far-reach/baked/winch-house.glb",
  "public/assets/far-reach/baked/roost.glb",
  "public/assets/far-reach/baked/docks.glb",
  "public/assets/far-reach/baked/crown.glb",
  "public/assets/far-reach/baked/mill.glb",
  "public/assets/far-reach/baked/book-stand.glb",
  "public/assets/far-reach/baked/knolls.glb",
  "public/assets/far-reach/baked/geometries.glb",
  "public/assets/far-reach/baked/islet-rig.glb",
  "src/shards/far-reach/data/winchHouse.json",
  "src/shards/far-reach/data/roost.json",
  "src/shards/far-reach/data/docks.json",
  "src/shards/far-reach/data/crown.json",
  "src/shards/far-reach/data/mill.json",
  "src/shards/far-reach/data/bookStand.json",
  "src/shards/far-reach/data/knolls.json",
  "src/shards/far-reach/data/geometries.json",
  "src/shards/far-reach/data/dressing.json",
  "src/shards/far-reach/data/bridges.json",
  "src/shards/far-reach/data/isles.json",
  "src/shards/far-reach/data/skyIsleFrames.json",
  "src/shards/far-reach/data/millModel.json",
  "src/shards/far-reach/data/skyIslePines.json",
  "src/shards/far-reach/data/placements.json",
  "src/shards/far-reach/data/isletRig.json",
  "public/assets/far-reach/baked/dressing.glb",
  "public/assets/far-reach/baked/bridges.bin",
  "public/assets/far-reach/baked/isles.bin",
  "public/assets/far-reach/baked/mill-model.bin",
  "src/shards/far-reach/data/props.json",
  "src/shards/far-reach/assets/098a779aefec56b6b679ade8655d792a66df747ec26b3bdd5ee92e0cb74d357b",
  "src/shards/far-reach/assets/13cd0bd9365b93ea22239dfeb920c91430d3ca2e8b6f4231add3061eb2d62400",
  "src/shards/far-reach/assets/2abc94de37078428ab6dc43823520161fe15e862a6db862d165f898a8c4ae14b",
  "src/shards/far-reach/assets/445c3a2035bf79cc24733d9ba12a903f470f6c5d5190cad1a15cbff6b60d6255",
  "src/shards/far-reach/assets/54264b03cb16e115be94717aa8e432613cfd55efaef6b3fe61b274655bca7378",
  "src/shards/far-reach/assets/5aff6f63ca020e993c4a3562c9e44a993613f13732a283a8c600962f06085207",
  "src/shards/far-reach/assets/5faf371c9ef188ed52fe1aac59f124cb4440817defb19cdde33fb878c8727ef8",
  "src/shards/far-reach/assets/65fec7a26d936494fdc5e8d9b271dce1421e8e86244406b541d8e8c3b19675e5",
  "src/shards/far-reach/assets/82e10360de0f6379d817e88da1f0fe05b6caeaf67f162049fb171a1e533b2d23",
  "src/shards/far-reach/assets/8c678f87712dccc98965af9890ba1b51a2b1aed54f427f8c0334b4fd02cc2144",
  "src/shards/far-reach/assets/8ff414c38a763aa6b7fee9196edbea9643bd0ef84eca0a64e663fd887607f7b6",
  "src/shards/far-reach/assets/91edddd6e59509fe257ac5634f86fae77a8445b5874cc0a13322914644570796",
  "src/shards/far-reach/assets/9fe5ed561d1e41b5b6ed9857f8fcbca0e780b6ec5f23e56eb019269ee892af96",
  "src/shards/far-reach/assets/a864f988e8b2edd42e0d3b5b019d260a72bf3deb960f45c79120e9f2737b42fe",
  "src/shards/far-reach/assets/ada00d58d9eb301117af061b9f1fe4fe2628e92cccd77147364cb18ef7e0995c",
  "src/shards/far-reach/assets/c028a2d76ad12b62c27ce33265fe7daaad96736886ffb92f72ed0424433b8e4c",
  "src/shards/far-reach/assets/cb44e120183a41adba505f55bb1f4562062c07b5287e466e9889b4a14aa11911",
  "src/shards/far-reach/assets/cb4f32722e8f13cd60aa75b5c23e48fdd107781c37b54823b0acee41ec5c030e",
  "src/shards/far-reach/assets/e3ac95a772040b9a259237f6d81d91992736f7e9800f929ba6bff45ba370e86d",
  "src/shards/far-reach/assets/e5966870cf3090d5c906db02b10e4645cd12acb2fdcea4636dda1ce53a86db11",
  "src/shards/far-reach/assets/f06cb6040e7cc851559c8d7d064db1e8e8d153572c357eeafc441989b34a6a53",
  "src/shards/far-reach/assets/f4d1507fe310e1818ca6805afb5c345fbb10d5933cdba3fab5041e9b9c15e714",
];

test('the retired mill owners preserve both complete outputs in a cold native cache with all former world files absent', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-mill-world-retired-')), native = resolve(scratch, 'public/assets/far-reach');
  const prefix = '/assets/far-reach/';
  try {
    const inputs = new Map<string, Uint8Array>();
    for (const url of MILL_REST_INPUTS) {
      const file = resolve(native, url.slice(prefix.length)); mkdirSync(dirname(file), { recursive: true });
      const bytes = readFileSync(`public${url}`);
      inputs.set(url, bytes); writeFileSync(file, bytes);
    }
    for (const file of retiredPaths) expect(existsSync(resolve(scratch, file)), file).toBe(false);
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'd'.repeat(64), new Map(), resolve(scratch, 'cache'),
      [{ prefix, directory: native }]);
    const files = await skyMillRestProgram(ctx);
    expect([...files.keys()]).toEqual(['mill-rest.glb', 'mill-rest.json']);
    const expected = await skyMillRestSource(inputs);
    for (const [name, bytes] of files) {
      const nativeBytes = expected.get(name);
      if (nativeBytes === undefined) throw new Error('Missing current native mill output');
      expect(bytes.byteLength).toBe(nativeBytes.byteLength);
      expect(hashImmutableBytes(bytes)).toBe(hashImmutableBytes(nativeBytes));
    }
    for (const file of retiredPaths) expect(existsSync(resolve(scratch, file)), file).toBe(false);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
