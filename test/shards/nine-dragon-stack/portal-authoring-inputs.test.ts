// oxlint-disable-next-line import/no-nodejs-modules -- Hash the exact JSON wire bytes pinned by the retained producer.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The authoring audit reads this test's isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../../../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../../../scripts/generate.mjs';
import { portalEntryRows } from '../../../src/shards/nine-dragon-stack/generators/portalEntries';
import { PORTAL_VEIL } from '../../../src/shards/nine-dragon-stack/data/portals';
import type { PanelNode } from '../../../src/engine/ui/panel';

it('keeps the page veil checked at its native owner without importing the renderer into authoring data', () => {
  const native:PanelNode = PORTAL_VEIL;
  expect(native).toBe(PORTAL_VEIL);
  expect(native.style).toEqual({position:'absolute',inset:'0',pointerEvents:'none',opacity:'0',display:'none',zIndex:'60',background:'radial-gradient(circle at 50% 50%,#2a1648 0%,#0a0612 70%)'});
});
it('confines the complete entry-row job and preload to authoring sources and preserves its pinned wire bytes', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nine-portal-entries');
  if(job===undefined)throw new Error('Missing Nine portal-entry job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs',job.entry,'portalEntryRows','src/shards/nine-dragon-stack/data/portalEntries.generated.json']);
  expect(auditAuthoringInputs(root,'nine-dragon-stack',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'nine-dragon-stack','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nine-dragon-stack')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  const output=job.outputs[0];if(output===undefined)throw new Error('Missing portal entry output');
  expect(job.outputs).toEqual([output]);
  expect(createHash('sha256').update(`${JSON.stringify(portalEntryRows())}\n`).digest('hex')).toBe(job.buildOutputs?.[output]);
});
