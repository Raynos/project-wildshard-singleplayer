// oxlint-disable-next-line import/no-nodejs-modules -- Verify generator bytes in an isolated temporary fixture.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the temporary generator destination.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact generated output paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { starterArmClipsPack } from '@wildshard/commons/packs/arms';
import { buildCommons } from '@wildshard/sdk/commons';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from '../src/game/systems/viewmodel/armClips';
import { genStarterArmClips, starterArmClipsTableSource } from '../scripts/gen-starter-arm-clips.mjs';

it('packs the two-user aliases deterministically and preserves exact runtime names and order', () => {
  const provenance = { credit: 'Fixture publisher', licence: 'Fixture licence' };
  const first = buildCommons([starterArmClipsPack(provenance)]), second = buildCommons([starterArmClipsPack(provenance)]);
  expect(first).toEqual(second);
  const entry = first.catalogue.entries[0];
  if (entry === undefined) throw new Error('Missing arm aliases entry');
  expect(entry).toMatchObject({ id: 'arm-clips/aliases', packVersion: '1.0.0', kind: 'binary' });
  // Frozen from the pre-pack aliases: catches any renamed source track or changed ordering.
  expect(entry.hash).toBe('54a9ad828ec4b55ce91d7fccebedaba9d54799880130f260d5d30ca1dcb8981d');
  const bytes = first.assets.get(entry.hash);
  if (bytes === undefined) throw new Error('Missing alias bytes');
  const aliases: unknown = JSON.parse(new TextDecoder().decode(bytes));
  expect(aliases).toEqual({ arm: ARM_CLIPS, swim: SWIM_CLIPS });
  expect(armClipNames(ARM_CLIPS)).toEqual(['idle', 'walk', 'attack.light', 'attack.light2', 'attack.light3',
    'attack.charge', 'attack.heavy', 'attack.parry', 'idle.sheathe', 'attack.draw', 'idle.sheathed',
    'idle.left', 'walk.left', 'attack.grapple-aim', 'attack.grapple-fire', 'idle.grapple-hold']);
  expect(SWIM_CLIPS).toEqual({ 'swim.stroke': 'swimStroke', 'swim.tread': 'swimTread' });
  expect(readFileSync('src/game/systems/viewmodel/clips.generated.ts', 'utf8')).toBe(starterArmClipsTableSource());
});

it('regenerates missing or stale aliases without executing commons in the runtime', () => {
  const root = mkdtempSync(join(tmpdir(), 'commons-arm-aliases-'));
  try {
    const file = join(root, 'src/game/systems/viewmodel/clips.generated.ts');
    genStarterArmClips(root);
    const source = readFileSync(file, 'utf8');
    expect(source).toBe(starterArmClipsTableSource());
    expect(source).not.toMatch(/\bimport\b/u);
    writeFileSync(file, 'stale aliases');
    genStarterArmClips(root);
    expect(readFileSync(file, 'utf8')).toBe(source);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
