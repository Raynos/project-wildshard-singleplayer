// oxlint-disable-next-line import/no-nodejs-modules -- Copy/build fixtures own and remove their isolated author projects.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated author projects live outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the source template and SDK-only workspace link.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { buildProject, projectAssets, validateProject } from '@wildshard/sdk/project';
import { validateSimulation } from '../src/sdk/headless';

it('a fresh copy of the template builds identically and validates its actual simulation and edge walks', async () => {
  const root = mkdtempSync(join(tmpdir(), 'template-scaffold-'));
  try {
    const project = join(root, 'author'); cpSync(resolve('src/shards/_template'), project, { recursive: true });
    mkdirSync(join(project, 'node_modules/@wildshard'), { recursive: true });
    symlinkSync(resolve('src/sdk'), join(project, 'node_modules/@wildshard/sdk'));
    const one = await buildProject(project, join(root, 'one'), { client: null });
    await buildProject(project, join(root, 'two'), { client: null });
    expect(readFileSync(join(root, 'one/shard.json'))).toEqual(readFileSync(join(root, 'two/shard.json')));
    const assets = projectAssets(project, one); expect(validateProject(one, assets)).toEqual(one);
    const proof = await validateSimulation(one, assets);
    expect(proof.lanes).toBe(92); expect(proof.steps).toBeGreaterThan(46000);
    expect(one.runtime).toBeNull(); expect(one.rows.looks.every((row) => row.recipe === 'platform.skin')).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
