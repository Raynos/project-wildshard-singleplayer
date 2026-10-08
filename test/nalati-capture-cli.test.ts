// oxlint-disable-next-line import/no-nodejs-modules -- This proves the real native capture executable and its normal process teardown.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The executable writes only inside this fixture's owned temporary directory.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns and removes its unique scratch output.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the repository and owned output paths for the native child.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the running Node binary for the source loader child.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture runs from the real repository root, independent of test cwd.
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const summarySchema = v.object({
  nativeTerrain: v.object({ bytes: v.number(), sha256: v.string() }),
  placements: v.array(v.object({ model: v.string(), role: v.picklist(['static-candidate', 'hybrid']), copies: v.number(), copiesSha256: v.string() })),
  roots: v.array(v.object({ name: v.string(), meshes: v.array(v.object({ name: v.string(),
    attributes: v.record(v.string(), v.object({ values: v.number(), sha256: v.string() })),
  })) })),
  counts: v.object({ placementRows: v.number(), authoredCopies: v.number(), roots: v.number(), meshes: v.number(), weldBuilds: v.number() }),
  physics: v.object({ colliders: v.number() }),
  cleanup: v.object({ page: v.record(v.string(), v.number()), levelUnloaded: v.boolean(), physicsReleased: v.boolean(), renderReleased: v.boolean() }),
});

it('captures the actual settled Nalati world, including unculled copies and async GLBs, then exits with every scope counter zero', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'nalati-capture-fixture-')), output = join(scratch, 'summary.json');
  try {
    const child = spawnSync(execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'scripts/bake/nalati-capture.mjs', `--out=${output}`], {
      cwd: root, encoding: 'utf8', timeout: 120_000,
    }); // Real geometry/physics capture shares CPU with the parallel gate; time is never a world correctness verdict.
    expect(child.error, child.stderr).toBeUndefined(); expect(child.status, child.stderr).toBe(0);
    const summary = v.parse(summarySchema, JSON.parse(readFileSync(output, 'utf8')));
    expect(summary.nativeTerrain).toEqual({ bytes: 540483, sha256: '8e610bab24eeae2d8fbd710466c99fbaf9f7fdfe721adbbfb218b4f5550855fa' });
    expect(summary.counts.placementRows).toBe(summary.placements.length); expect(summary.counts.roots).toBe(summary.roots.length);
    expect(summary.counts.authoredCopies).toBe(summary.placements.reduce((sum, row) => sum + row.copies, 0));
    for (const row of summary.placements) expect(row.copiesSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(summary.counts.authoredCopies).toBeGreaterThan(1000); expect(summary.physics.colliders).toBeGreaterThan(0);
    expect(summary.placements.find(row => row.model === 'nalati-grasslands/herd-horse')?.role).toBe('hybrid');
    const generated = summary.roots.flatMap(row => row.meshes).filter(mesh => mesh.name.startsWith('nalati-model-'));
    expect(generated.some(mesh => mesh.name === 'nalati-model-chest')).toBe(true);
    expect(generated.some(mesh => mesh.name === 'nalati-model-watchtower')).toBe(true);
    for (const mesh of generated) {
      expect(mesh.attributes['position']?.values).toBeGreaterThan(0);
      expect(mesh.attributes['position']?.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(summary.cleanup).toMatchObject({ levelUnloaded: true, physicsReleased: true, renderReleased: true });
    expect(Object.values(summary.cleanup.page).every(value => value === 0)).toBe(true);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}, 150_000); // Child gets the generous offline CLI ceiling even while the clean gate runs tests in parallel.
