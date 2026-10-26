// oxlint-disable-next-line import/no-nodejs-modules -- Always construct the actual current producer in Node, outside DOM worker compiler globals.
import { execFileSync } from 'node:child_process';

/** Fresh producer evidence, never an immutable cache hit: compare every complete output with its frozen pin. */
export function checkNalatiSpeciesSource(): void {
  const source = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {nalatiSpeciesSource} from './src/shards/nalati-grasslands/generators/bake-species.mjs';
    import {hashImmutableBytes} from './src/sdk/immutable.ts';
    import {originalSpeciesOutput} from './test/fixtures/nalati-original-species.ts';
    const pins=JSON.parse(readFileSync('test/fixtures/nalati-species-files.json','utf8'));
    const names=['species.json','bodies.bin','boot.json','held-weapons.wasm','held-witness.bin'];
    const {files}=await nalatiSpeciesSource();
    assert.equal(files.size,pins.length);
    for(const [index,pin]of pins.entries()){
      const bytes=files.get(names[index]);assert.ok(bytes,pin.path);
      assert.equal(bytes.length,pin.bytes,pin.path);
      assert.equal(hashImmutableBytes(bytes),pin.sha256,pin.path);
      assert.equal(Buffer.compare(bytes,originalSpeciesOutput(pin.path)),0,pin.path);
    }
  `;
  execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '--eval', source]);
}
