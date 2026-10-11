// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Pine night compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='pine-night-director');
  if(job===undefined)throw new Error('Missing Pine night job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'pine-hollow',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'pine-hollow','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'pine-hollow')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/pine-hollow/behaviour/night.generated.json','src/shards/pine-hollow/assets/a99e1e49bad615716eecc55964300848fb9efc9aab3beeeeaee01adffa243cda']);
  expect(job.buildOutputs).toEqual({
    'src/shards/pine-hollow/behaviour/night.generated.json':'19d875cd69bc4ca409dead67186b7a449cdd563868b75202695c06e780ff2ba0',
    'src/shards/pine-hollow/assets/a99e1e49bad615716eecc55964300848fb9efc9aab3beeeeaee01adffa243cda':'a99e1e49bad615716eecc55964300848fb9efc9aab3beeeeaee01adffa243cda',
  });
});
