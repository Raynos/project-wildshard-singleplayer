import { currentHeldSource, currentHeldInputs, currentHeldWithout, currentHeldEntryWithout } from './fixtures/nalati-current-held';
import { originalHeldMetadata } from './fixtures/nalati-held-original';
import { originalSpeciesOutput } from './fixtures/nalati-original-species';
// oxlint-disable-next-line import/no-nodejs-modules -- Retired publications must remain physically absent.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import pins from './fixtures/nalati-held-files.json' with { type: 'json' };
import speciesPins from './fixtures/nalati-species-files.json' with { type: 'json' };

for (const omitted of [undefined, '/generators/speciesProgram.ts', '/assets/nalati/baked/bodies.bin']) {
  test(omitted === undefined ? 'source-owned held metadata retains both complete original documents without any species publication'
    : `source-owned held metadata refuses omitted source ${omitted} despite complete original outputs`, async () => {
    expect(currentHeldInputs).toContain('/assets/nalati/baked/bodies.bin');
    for (const pin of [...speciesPins, ...pins]) expect(currentHeldInputs).not.toContain(pin.path.replace('src/shards/nalati-grasslands/', ''));
    if (omitted !== undefined) {
      const helper = omitted.endsWith('.ts');
      await expect(helper ? currentHeldEntryWithout(omitted) : currentHeldWithout(omitted))
        .rejects.toThrow(helper ? 'Defining held source helper omitted' : `Missing original species input: ${omitted}`);
      for (const pin of speciesPins) expect(hashImmutableBytes(originalSpeciesOutput(pin.path))).toBe(pin.sha256);
    } else {
      const original = originalHeldMetadata();
      const documents = [currentHeldSource.held.held, currentHeldSource.held.stealth];
      expect(documents).toStrictEqual([original.held, original.stealth]);
      for (const pin of [...speciesPins, ...pins]) expect(existsSync(pin.path), pin.path).toBe(false);
      for (const [index, pin] of pins.entries()) {
        const bytes = new TextEncoder().encode(`${JSON.stringify(documents[index], null, 2)}\n`);
        expect(bytes.length, pin.path).toBe(pin.bytes); expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
        const before = new TextEncoder().encode(`${JSON.stringify(index === 0 ? original.held : original.stealth, null, 2)}\n`);
        expect(Buffer.compare(bytes, before), pin.path).toBe(0);
      }
    }
  });
}
