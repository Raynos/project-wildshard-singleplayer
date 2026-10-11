// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Nalati raid compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nalati-raid-director');
  if(job===undefined)throw new Error('Missing Nalati raid job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'nalati-grasslands',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'nalati-grasslands','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nalati-grasslands')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/nalati-grasslands/behaviour/director.generated.json','src/shards/nalati-grasslands/assets/077258690108c4ffde5eb0c46105e323ff854070323da971c08586751e427646']);
  expect(job.buildOutputs).toEqual({
    'src/shards/nalati-grasslands/behaviour/director.generated.json':'fa7b67a7ed284b103f38de59730335dac1e8a837ef76e1aeef98def4de97b1bd',
    'src/shards/nalati-grasslands/assets/077258690108c4ffde5eb0c46105e323ff854070323da971c08586751e427646':'077258690108c4ffde5eb0c46105e323ff854070323da971c08586751e427646',
  });
});
