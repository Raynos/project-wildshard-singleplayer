// oxlint-disable-next-line import/no-nodejs-modules -- Verify generator bytes in an isolated temporary fixture.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the temporary generator destination.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact generated output paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from '../src/game/systems/viewmodel/armClips';
import { genStarterArmClips, starterArmClipsTableSource } from '../scripts/gen-starter-arm-clips.mjs';
import aliases from '../src/game/systems/viewmodel/armAliases.json' with { type: 'json' };

it('keeps the two-user aliases and preserves exact runtime names and order', () => {
  // Frozen from the pre-pack aliases: catches any renamed source track or changed ordering.
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(aliases)))).toBe('54a9ad828ec4b55ce91d7fccebedaba9d54799880130f260d5d30ca1dcb8981d');
  expect(aliases).toEqual({ arm: ARM_CLIPS, swim: SWIM_CLIPS });
  expect(armClipNames(ARM_CLIPS)).toEqual(['idle', 'walk', 'attack.light', 'attack.light2', 'attack.light3',
    'attack.charge', 'attack.heavy', 'attack.parry', 'idle.sheathe', 'attack.draw', 'idle.sheathed',
    'idle.left', 'walk.left', 'attack.grapple-aim', 'attack.grapple-fire', 'idle.grapple-hold']);
  expect(SWIM_CLIPS).toEqual({ 'swim.stroke': 'swimStroke', 'swim.tread': 'swimTread' });
  expect(readFileSync('src/game/systems/viewmodel/clips.generated.ts', 'utf8')).toBe(starterArmClipsTableSource());
});

it('regenerates missing or stale aliases without runtime imports', () => {
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
