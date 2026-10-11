// oxlint-disable-next-line import/no-nodejs-modules -- Audits the defining authoring source closure without executing a renderer.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs } from '../../../scripts/authoring-inputs.mjs';
import { GHOST_LAIR } from '../../../src/shards/pine-hollow/data/eliteHomes';
import { GHOST_STAG_BRAIN, PINE_ELITE_MODULES } from '../../../src/shards/pine-hollow/data/eliteBrainRows';
import { PINE_ELITE_DEFS } from '../../../src/shards/pine-hollow/combat/eliteRoster';

it('keeps the actual AS declarations and module bytes in an independent authoring closure', () => {
  const audit = auditAuthoringInputs(process.cwd(), 'pine-hollow', 'src/shards/pine-hollow/data/eliteBrainRows.ts');
  expect(audit.issues).toEqual([]);
  expect(audit.files).toContain('src/shards/pine-hollow/data/eliteHomes.ts');
  expect(audit.files.filter(file => file.includes('/behaviour/'))).toHaveLength(4);
  expect(Object.keys(PINE_ELITE_MODULES)).toHaveLength(4);
});

it('uses the same authored lair for the live roster and the admitted Ghost Stag script', () => {
  expect(GHOST_LAIR).toStrictEqual({ x: 62, z: -100, r: 22 });
  expect(PINE_ELITE_DEFS['ghost-stag']?.lair).toBe(GHOST_LAIR);
  expect(GHOST_STAG_BRAIN.parameters).toStrictEqual([GHOST_LAIR.x, GHOST_LAIR.z, 110]);
});
