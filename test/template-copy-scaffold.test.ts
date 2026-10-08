// oxlint-disable-next-line import/no-nodejs-modules -- Copy/build fixtures own and remove their isolated author projects.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated author projects live outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the source template and SDK-only workspace link.
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildProject, canonicalJson, projectAssets, validateProject } from '@wildshard/sdk/project';
import { validateSimulation } from '../src/sdk/headless';

const root = mkdtempSync(join(tmpdir(), 'template-scaffold-'));
const project = join(root, 'author');
let built: Awaited<ReturnType<typeof buildProject>> | undefined;
let assets: ReturnType<typeof projectAssets> | undefined;

beforeAll(async () => {
  cpSync(resolve('src/shards/_template'), project, { recursive: true });
  mkdirSync(join(project, 'node_modules/@wildshard'), { recursive: true });
  symlinkSync(resolve('src/sdk'), join(project, 'node_modules/@wildshard/sdk'));
  // One copied-project tooling/config build. Small baker fixtures separately prove repeat-bake identity.
  built = await buildProject(project, join(root, 'product'), { client: null });
  assets = projectAssets(project, built);
}, 60_000);
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

it('a fresh template copy builds a canonical product with its actual immutable assets', () => {
  if (built === undefined || assets === undefined) throw new Error('Copied template was not built');
  expect(readFileSync(join(root, 'product/shard.json'), 'utf8')).toBe(canonicalJson(built));
  expect(validateProject(built, assets)).toEqual(built);
  expect(built.runtime).toBeNull(); expect(built.rows.looks.every((row) => row.recipe === 'platform.skin')).toBe(true);
});

it('the copied product validates its actual simulation and all 92 edge lanes', async () => {
  if (built === undefined || assets === undefined) throw new Error('Copied template was not built');
  const proof = await validateSimulation(built, assets);
  expect(proof.lanes).toBe(92); expect(proof.steps).toBeGreaterThan(46000);
// Keep the native proof intact, with its own original deadline instead of combining two config builds and the proof.
}, 60_000);
