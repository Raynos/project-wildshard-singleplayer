// oxlint-disable-next-line import/no-nodejs-modules -- Keep frozen predecessor identities and isolate actual sealed consumers.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine expanded omission descriptors to repository scratch.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { MILL_REST_INPUTS, skyMillRestProgram } from '../src/shards/far-reach/generators/millRestProgram';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldRows } from '../src/shards/far-reach/generators/worldRows';

// Frozen predecessor outputs remain available to legacy; retiring the scheduler never repins them.
const held = {
  "public/assets/far-reach/baked/winch-house.glb": "0946ca25b8bb75aca6386cf177f31dd12c324c7acb30450a0ce2b223afc00d09",
  "public/assets/far-reach/baked/roost.glb": "9e13f71c1ab243908ad51c6ae0ceffb33a5d2b58a33d3329f046cf54bff7f685",
  "public/assets/far-reach/baked/docks.glb": "216d946b01189d068313ee631b3f6688964c5c2b22a239de62c3146f681b494a",
  "public/assets/far-reach/baked/crown.glb": "1cb9c09a391ec1cf3282f3d9ce08938c0fc054694c8cbef8dad7b8f1c8866fcb",
  "public/assets/far-reach/baked/mill.glb": "80d4702049e4ea208058d759593e1538373edadac9c5bf96b1520564a12af3f2",
  "public/assets/far-reach/baked/book-stand.glb": "ff18bc072d5b9ac9657fb0eedcea8e56f53352dd7287c8b2ea1ad657d4cc5151",
  "public/assets/far-reach/baked/knolls.glb": "97e919d64a10aedd7258bb7c76cf01a78cef95764b8c5233b22c92435a5fa2a6",
  "public/assets/far-reach/baked/geometries.glb": "cb33dc7b8f36985fabda61b01084b271b59ae3aa5dbd0f2fe5b00fef9d111576",
  "public/assets/far-reach/baked/islet-rig.glb": "49b8daf1fe50d93991c4d63ae9a2a7358b027d37d8825dae4a4f6f3c89496f47",
  "src/shards/far-reach/data/winchHouse.json": "0bb8ce6163a8e92770a0f2109164145ddb13046d986ea62ffaab8578882fd746",
  "src/shards/far-reach/data/roost.json": "0077275e67812564a1867106e9f32d93dde1e189d1afbea20ac02e1ef8d72352",
  "src/shards/far-reach/data/docks.json": "a0c1f2b6dd52a0c8d21aa5d13394b55f3e885d4e36bdb3c5a2a270a9ff8edfc2",
  "src/shards/far-reach/data/crown.json": "c93b2ed9076774af6f6b61f4eee807c98747e8c8b6c5d5339f3b1ffaef4a946a",
  "src/shards/far-reach/data/mill.json": "e4a0b02c0a3c234e22d6197ef077b25f6aadce62634c4313cf57f3fd1d6a1814",
  "src/shards/far-reach/data/bookStand.json": "d076824ae80574be1913b580cc4920a6c10f1644aec8817c501acd8adcf816ef",
  "src/shards/far-reach/data/knolls.json": "3348c6d49328096cc2f8d63a89ac0c7504b900da4c4a4ea03285803c10592718",
  "src/shards/far-reach/data/geometries.json": "3e770922599e1ff74629e90fa1cc29a9e9843c366a8660381b0c4c3095271a93",
  "src/shards/far-reach/data/dressing.json": "3eaea836f3e959b9e995bffbb5ff9d5a373a6dfe1563272219eb8399f6043d87",
  "src/shards/far-reach/data/bridges.json": "2f81cd66a88239e22b7266fc04df26475877ddb93085fb65cc265843f97f8eed",
  "src/shards/far-reach/data/isles.json": "948a0162669414f82ce933ca20e3c45c59ae6dfdfd5d0f3657e8dd8063e5f12a",
  "src/shards/far-reach/data/skyIsleFrames.json": "7967d892dbdf4ae2ba915f331468a4e4d29426b12d6782e4c5ce42b60f83fd06",
  "src/shards/far-reach/data/millModel.json": "67b8b74ba82a3c96e6d2d1591c9a0ab1160f1072ab7d8bc0ed24d2631107791c",
  "src/shards/far-reach/data/skyIslePines.json": "4b934e23ff517578d49682a348fbfc9ef8bf0def8e55f4fdf9ecbfb54f5ebbdd",
  "src/shards/far-reach/data/placements.json": "fc583e5a9fc62b0c08021fd7620ead55cdfa1a2be8870b0d9c37df6cc5d79dc5",
  "src/shards/far-reach/data/isletRig.json": "e4620c1f5afbb9d7e5ce38c17ed50f9b7cdc9e8742b3a7009ebc38aec2765f11",
  "public/assets/far-reach/baked/dressing.glb": "c20fab6b445be7ca507389ba87266cf36e4c2c89af22dd99650ec5a6357e22dc",
  "public/assets/far-reach/baked/bridges.bin": "112224507723e2ef02e36b99106a2dfd821956226c6289350fc39c014d2235d5",
  "public/assets/far-reach/baked/isles.bin": "5823d227f130672fc7cdf97ac8edfeb4fbdf22423362c79557215145901185cc",
  "public/assets/far-reach/baked/mill-model.bin": "7320e83a574338d3270e05dcea3b7fe5bd4748b5a0b11e8bb86e9d573e8b9069",
  "src/shards/far-reach/data/props.json": "153bc3661edfab0c3b147845b30a61eb7ffc220ee5765cc8890da17d2395bb64",
  "src/shards/far-reach/assets/098a779aefec56b6b679ade8655d792a66df747ec26b3bdd5ee92e0cb74d357b": "098a779aefec56b6b679ade8655d792a66df747ec26b3bdd5ee92e0cb74d357b",
  "src/shards/far-reach/assets/13cd0bd9365b93ea22239dfeb920c91430d3ca2e8b6f4231add3061eb2d62400": "13cd0bd9365b93ea22239dfeb920c91430d3ca2e8b6f4231add3061eb2d62400",
  "src/shards/far-reach/assets/2abc94de37078428ab6dc43823520161fe15e862a6db862d165f898a8c4ae14b": "2abc94de37078428ab6dc43823520161fe15e862a6db862d165f898a8c4ae14b",
  "src/shards/far-reach/assets/445c3a2035bf79cc24733d9ba12a903f470f6c5d5190cad1a15cbff6b60d6255": "445c3a2035bf79cc24733d9ba12a903f470f6c5d5190cad1a15cbff6b60d6255",
  "src/shards/far-reach/assets/54264b03cb16e115be94717aa8e432613cfd55efaef6b3fe61b274655bca7378": "54264b03cb16e115be94717aa8e432613cfd55efaef6b3fe61b274655bca7378",
  "src/shards/far-reach/assets/5aff6f63ca020e993c4a3562c9e44a993613f13732a283a8c600962f06085207": "5aff6f63ca020e993c4a3562c9e44a993613f13732a283a8c600962f06085207",
  "src/shards/far-reach/assets/5faf371c9ef188ed52fe1aac59f124cb4440817defb19cdde33fb878c8727ef8": "5faf371c9ef188ed52fe1aac59f124cb4440817defb19cdde33fb878c8727ef8",
  "src/shards/far-reach/assets/65fec7a26d936494fdc5e8d9b271dce1421e8e86244406b541d8e8c3b19675e5": "65fec7a26d936494fdc5e8d9b271dce1421e8e86244406b541d8e8c3b19675e5",
  "src/shards/far-reach/assets/82e10360de0f6379d817e88da1f0fe05b6caeaf67f162049fb171a1e533b2d23": "82e10360de0f6379d817e88da1f0fe05b6caeaf67f162049fb171a1e533b2d23",
  "src/shards/far-reach/assets/8c678f87712dccc98965af9890ba1b51a2b1aed54f427f8c0334b4fd02cc2144": "8c678f87712dccc98965af9890ba1b51a2b1aed54f427f8c0334b4fd02cc2144",
  "src/shards/far-reach/assets/8ff414c38a763aa6b7fee9196edbea9643bd0ef84eca0a64e663fd887607f7b6": "8ff414c38a763aa6b7fee9196edbea9643bd0ef84eca0a64e663fd887607f7b6",
  "src/shards/far-reach/assets/91edddd6e59509fe257ac5634f86fae77a8445b5874cc0a13322914644570796": "91edddd6e59509fe257ac5634f86fae77a8445b5874cc0a13322914644570796",
  "src/shards/far-reach/assets/9fe5ed561d1e41b5b6ed9857f8fcbca0e780b6ec5f23e56eb019269ee892af96": "9fe5ed561d1e41b5b6ed9857f8fcbca0e780b6ec5f23e56eb019269ee892af96",
  "src/shards/far-reach/assets/a864f988e8b2edd42e0d3b5b019d260a72bf3deb960f45c79120e9f2737b42fe": "a864f988e8b2edd42e0d3b5b019d260a72bf3deb960f45c79120e9f2737b42fe",
  "src/shards/far-reach/assets/ada00d58d9eb301117af061b9f1fe4fe2628e92cccd77147364cb18ef7e0995c": "ada00d58d9eb301117af061b9f1fe4fe2628e92cccd77147364cb18ef7e0995c",
  "src/shards/far-reach/assets/c028a2d76ad12b62c27ce33265fe7daaad96736886ffb92f72ed0424433b8e4c": "c028a2d76ad12b62c27ce33265fe7daaad96736886ffb92f72ed0424433b8e4c",
  "src/shards/far-reach/assets/cb44e120183a41adba505f55bb1f4562062c07b5287e466e9889b4a14aa11911": "cb44e120183a41adba505f55bb1f4562062c07b5287e466e9889b4a14aa11911",
  "src/shards/far-reach/assets/cb4f32722e8f13cd60aa75b5c23e48fdd107781c37b54823b0acee41ec5c030e": "cb4f32722e8f13cd60aa75b5c23e48fdd107781c37b54823b0acee41ec5c030e",
  "src/shards/far-reach/assets/e3ac95a772040b9a259237f6d81d91992736f7e9800f929ba6bff45ba370e86d": "e3ac95a772040b9a259237f6d81d91992736f7e9800f929ba6bff45ba370e86d",
  "src/shards/far-reach/assets/e5966870cf3090d5c906db02b10e4645cd12acb2fdcea4636dda1ce53a86db11": "e5966870cf3090d5c906db02b10e4645cd12acb2fdcea4636dda1ce53a86db11",
  "src/shards/far-reach/assets/f06cb6040e7cc851559c8d7d064db1e8e8d153572c357eeafc441989b34a6a53": "f06cb6040e7cc851559c8d7d064db1e8e8d153572c357eeafc441989b34a6a53",
  "src/shards/far-reach/assets/f4d1507fe310e1818ca6805afb5c345fbb10d5933cdba3fab5041e9b9c15e714": "f4d1507fe310e1818ca6805afb5c345fbb10d5933cdba3fab5041e9b9c15e714"
};
const readers = {
  "sky-boot-metadata": {
    "src/shards/far-reach/boot/assets.generated.json": "12fc9e18ca08e448cf65f6322fd7e1b4dcbb3140831041ac9e4cea8b40828b8c",
    "src/shards/far-reach/boot/files.generated.json": "8b32bb394156d3c4e33ea10ddd920a0a660876839f7eaaa3ee3b266d039756e5",
    "src/shards/far-reach/boot/sources.generated.json": "c1c8a01be58ee8120ed33bfad20cd855176efa99d45c963fae0a81664ee69f5e",
    "src/shards/far-reach/boot/lateReads.generated.json": "c55fe856a439ccc93acc1446f4e3bf3fb1889b7b741f8b17158d6e44a6994f43",
    "src/shards/far-reach/boot/rigs.generated.json": "663b8ebba9e6f970243825bde7ef24f6c82bd9abaf261008692cbed59ba968bc",
    "src/shards/far-reach/boot/worldTextures.generated.json": "1e7894081c884d9e5e175a55f6eb955fb82658f9f9b3b9f852b595ae76ef45a1"
  }
};

test('the retired world-row consumer retains its complete original source wire', () => {
  expect(discoverGeneration(resolve('.')).jobs.some(row => row.id === 'sky-world-rows')).toBe(false);
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`);
  expect(bytes.byteLength).toBe(65_347);
  expect(hashImmutableBytes(bytes)).toBe('3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d');
});

test('world geometry has no scheduled writer or declared handoff readers and every frozen file stays exact', () => {
  const { jobs } = discoverGeneration(resolve('.'));
  expect(jobs.some(job => job.id === 'sky-world')).toBe(false);
  expect(Object.keys(held)).toHaveLength(52);
  for (const [file, hash] of Object.entries(held)) {
    expect(hashImmutableBytes(readFileSync(file)), file).toBe(hash);
    for (const job of jobs) {
      expect(job.outputs, job.id).not.toContain(file);
      expect(job.inputRoots, job.id).not.toContain(file);
    }
  }
});

test.each(Object.entries(readers))('%s has no publisher or handoff readers and retains all original byte oracles', (id, expected) => {
  const { jobs } = discoverGeneration(resolve('.'));
  expect(jobs.some(row => row.id === id)).toBe(false);
  for (const [file, hash] of Object.entries(expected)) {
    expect(hashImmutableBytes(readFileSync(file)), file).toBe(hash);
    for (const job of jobs) {
      expect(job.outputs, job.id).not.toContain(file);
      expect(job.inputRoots, job.id).not.toContain(file);
    }
  }
});

test('the retired mill owners preserve both complete outputs in a cold native cache with all former world files absent', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-mill-world-retired-')), native = resolve(scratch, 'public/assets/far-reach');
  const prefix = '/assets/far-reach/';
  try {
    for (const url of MILL_REST_INPUTS) {
      const file = resolve(native, url.slice(prefix.length)); mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, readFileSync(`public${url}`));
    }
    for (const file of Object.keys(held)) expect(existsSync(resolve(scratch, file)), file).toBe(false);
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'd'.repeat(64), new Map(), resolve(scratch, 'cache'),
      [{ prefix, directory: native }]);
    const files = await skyMillRestProgram(ctx);
    expect([...files.keys()]).toEqual(['mill-rest.glb', 'mill-rest.json']);
    expect(Object.fromEntries([...files].map(([name, bytes]) => [name, hashImmutableBytes(bytes)]))).toEqual({
      'mill-rest.glb': '3b12beff5b5ae8fbb51433b27890591e85bdc9049dd999e19cc4700400603b37',
      'mill-rest.json': '7dabe8b463afae68e7070cbb94d9e2fd77a0744c8fc47889437d0c24a9f24913',
    });
    for (const file of Object.keys(held)) expect(existsSync(resolve(scratch, file)), file).toBe(false);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
