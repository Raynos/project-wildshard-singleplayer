// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Nalati ghost volley compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nalati-ghost-volley-director');
  if(job===undefined)throw new Error('Missing Nalati ghost volley job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'nalati-grasslands',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'nalati-grasslands','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nalati-grasslands')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/nalati-grasslands/assets/3e6bce711c85df2ed170797d6d5ac606e89436e21d7865b07bc91f13d7912de1','src/shards/nalati-grasslands/behaviour/ghostVolley.generated.json']);
  expect(job.buildOutputs).toEqual({
    'src/shards/nalati-grasslands/behaviour/ghostVolley.generated.json':'239d2d3d994be82ee5958a10612cfa1f7907c59df8ad3dd3d6937d34b3e333ba',
    'src/shards/nalati-grasslands/assets/3e6bce711c85df2ed170797d6d5ac606e89436e21d7865b07bc91f13d7912de1':'3e6bce711c85df2ed170797d6d5ac606e89436e21d7865b07bc91f13d7912de1',
  });
});
