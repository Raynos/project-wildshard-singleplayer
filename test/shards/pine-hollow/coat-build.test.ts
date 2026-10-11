// oxlint-disable-next-line import/no-nodejs-modules -- The authoring boundary is checked against the retained source checkout.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The boundary audit resolves sources in this test checkout.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../../../scripts/authoring-inputs.mjs';
import type { ShardGenerationJob } from '../../../scripts/generate.mjs';
import { PINE_HULLS } from '../../../src/shards/pine-hollow/data/creatureHulls';
import pages from '../../../src/shards/pine-hollow/data/coatPages.generated.json';
import { bootSources } from '../../../src/shards/pine-hollow/boot/files';

const catalog = JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')) as { jobs: ShardGenerationJob[] };
const job = catalog.jobs.find(row => row.id === 'pine-coat-pages');

it('rebuilds Pine coats only from retained authoring code/assets, before any job can read their generated metadata', () => {
  if (job === undefined) throw new Error('Pine coat job missing');
  expect(catalog.jobs[0]?.id).toBe(job.id);
  expect(auditAuthoringInputs(cwd(), 'pine-hollow', job.entry).issues).toEqual([]);
  expect(job.command).toEqual([job.entry]);
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'pine-hollow') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file))).toEqual([]);
  expect(job.outputs).toHaveLength(47);
  expect(Object.keys(job.buildOutputs ?? {}).sort()).toEqual([...job.outputs].sort());
});

it.each(['phone', 'desktop'] as const)('charges every %s lossless repaint and retains its existing compressed stand-in', tier => {
  const rasters = Object.entries(pages.tiers[tier]);
  expect(rasters).toHaveLength(16);
  const imageFiles = Object.values(bootSources(tier, 'img')).flat(), compressedFiles = Object.values(bootSources(tier, 'ktx2')).flat();
  for (const [key, raster] of rasters) {
    expect(key).toBe(`procedural:${raster.image}`);
    expect(imageFiles).toContain(raster.image);
    expect(compressedFiles).not.toContain(raster.image);
    expect(raster.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(raster.pixels).toMatch(/^[a-f0-9]{64}$/u);
    const [name, kind, variant] = raster.image.split('/').at(-1)?.replace(/\.phone/u, '').split('.') ?? [];
    expect(PINE_HULLS.hulls[`${kind}:${variant}`]).toBe(name);
  }
  expect(compressedFiles.some(file => file.includes('/creatures/coats/') && file.endsWith('.ktx2'))).toBe(true);
});
