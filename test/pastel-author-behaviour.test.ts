// oxlint-disable-next-line import/no-nodejs-modules -- Compare compilation with immutable retained products.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Native binary equality includes all metering instructions.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect this exact authoring source root.
import process from 'node:process';
import { expect, it } from 'vitest';
import { compileScript } from '../src/sdk/compileScript';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';

it('rebuilds door, item hooks and presentation idle from retained AS with their exact admitted limits', async () => {
  const sources = [
    { name: 'door', maximumPages: 2, hash: 'ecc886d8bbebcf190298ff9162b6bb364f2125606f5bdc8cc220ea28044f96ea' },
    { name: 'items', maximumPages: 64, hash: '7035c479edde46ee0baf713fce437fe21e7b61967154f36b5f1126708b2bfaa7' },
    { name: 'idle', maximumPages: 2, hash: '875e798b8b1be62129b477e6b85e7c45cf11ae67cba006596d869133b469726b' },
  ];
  for (const { name, maximumPages, hash } of sources) {
    const bytes = await compileScript(readFileSync(`src/shards/pastel-plain/behaviour/${name}.as`, 'utf8'), { maximumPages });
    expect(hashImmutableBytes(bytes), name).toBe(hash);
    expect(Buffer.from(bytes), name).toEqual(readFileSync(`src/shards/pastel-plain/assets/${hash}`));
    if (name === 'door') expect(`${JSON.stringify({ hash, compressed: bytes.length }, null, 2)}\n`).toBe(readFileSync('src/shards/pastel-plain/behaviour/door.json', 'utf8'));
  }
});

it('closes the author-only compiler through a literal external dependency, never a computed source import', () => {
  const report = auditAuthoringInputs(process.cwd(), 'pastel-plain', 'src/shards/pastel-plain/generators/bake-pastel-behaviour.mjs');
  expect(report.issues).toEqual([]);
  expect(report.files).toContain('src/sdk/assemblyscriptCompiler.mjs');
  expect(report.files.some(file => file.startsWith('src/game/') || file.startsWith('src/engine/') || file.includes('/runtime/'))).toBe(false);
});
