import { expect, test } from 'vitest';
import { createMantisCompleteMotionPreviewOutput, createMantisCompleteMotionPreviewSource, MANTIS_COMPLETE_MOTION_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/mantisCompleteMotionPreview';

test('isolated source keeps only Mantis, both real strikes and one decision, with no world progress', () => {
  const source = createMantisCompleteMotionPreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['splinter-mantis']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['mantis-st', 'mantis-beat', 'regular-clock', 'mantis-pose-phase', 'mantis-pose-clock']);
  expect(MANTIS_COMPLETE_MOTION_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createMantisCompleteMotionPreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/splinter-mantis.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});

test('complete motion source preserves exact candidate7 AI, combat, rewards and bodies',async()=>{
  const previous=await import('../src/shards/driftwood-isle/generators/mantisPrecontactPreview');
  const oldSource=previous.createMantisPrecontactPreviewSource(), nextSource=createMantisCompleteMotionPreviewSource();
  expect(JSON.stringify(nextSource).replaceAll('CompleteMotion','Precontact')).toBe(JSON.stringify(oldSource));
  const old=previous.createMantisPrecontactPreviewOutput({diagnosticOnly:true}),next=createMantisCompleteMotionPreviewOutput({diagnosticOnly:true});
  expect(next.platform?.sections.filter(row=>row.name!=='actors/species-programs')).toEqual(old.platform?.sections.filter(row=>row.name!=='actors/species-programs'));
  for(const [path,bytes]of old.platform?.files??[]){const current=next.platform?.files.get(path);if(current===undefined)throw new Error('Missing unchanged platform file');
    expect(new TextDecoder().decode(current).replaceAll('CompleteMotion','Precontact')).toBe(new TextDecoder().decode(bytes));}
  for(const row of old.namedFiles??[])if(row.name!=='poses/splinter-mantis.json')expect(next.namedFiles?.find(value=>value.name===row.name)).toEqual(row);
});
