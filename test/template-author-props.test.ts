// oxlint-disable-next-line import/no-nodejs-modules -- Compare every authored asset with the retained immutable bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The byte comparison includes binary GLB payloads.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Audit this producer's exact source root.
import process from 'node:process';
import { expect, it } from 'vitest';
import { Rng, fnv1a32 } from '../src/engine/core/rng';
import { bakeProps } from '../src/sdk/bake/props';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { templateProps } from '../src/shards/_template/generators/templatePropsSource';
import { templateScatterRandom } from '../src/shards/_template/generators/landscapeNoise';

it('preserves the original named cosmetic stream without a session RNG service', () => {
  for (const seed of [0, 357, 0xffffffff]) {
    const native = new Rng(fnv1a32(`${String(seed)}:cosmetic`)), authored = templateScatterRandom(seed);
    for (let i = 0; i < 1000; i++) expect(authored.range(-250, 250)).toBe(native.range(-250, 250));
  }
});

it('regenerates every prop, collider, panel and immutable geometry byte exactly', () => {
  const fixture = templateProps(20);
  try {
    const props = bakeProps(fixture.source);
    const rows = { props: props.props, tiles: props.tiles, files: props.files, library: props.library, far: props.far, report: props.report };
    expect(encodeCanonicalJson(rows)).toBe(readFileSync('src/shards/_template/data/props.json', 'utf8'));
    for (const [hash, bytes] of props.assets) expect(Buffer.from(bytes), hash).toEqual(readFileSync(`src/shards/_template/assets/${hash}`));
  } finally { fixture.dispose(); }
});

it('owns the complete producer closure without game, engine, runtime or generated seeds', () => {
  const audit = auditAuthoringInputs(process.cwd(), '_template', 'src/shards/_template/generators/bake-template-props.mjs');
  expect(audit.issues).toEqual([]);
  expect(audit.files.some(file => file.startsWith('src/engine/') || file.startsWith('src/game/') || file.includes('/runtime/'))).toBe(false);
  expect(audit.files).toContain('src/shards/_template/generators/world.ts');
});
