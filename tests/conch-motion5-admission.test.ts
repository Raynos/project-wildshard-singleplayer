import {expect,test} from 'vitest';

test('root and lower-body programs retain exact motion3 bytecode and strict node bounds', async () => {
  const { conchPlantedClips } = await import('../src/shards/driftwood-isle/generators/conchPlantedClips');
  const { conchMotion5Clips } = await import('../art/driftwood-isle/approved-conch/motion5-study/conchMotion5Clips');
  const old = conchPlantedClips(), next = conchMotion5Clips();
  const lower = (program: typeof old.programs[number]) => {
    const target = program.numeric?.outputs[0]?.target;
    return target === 'joint.body' || target?.startsWith('joint.leg') === true;
  };
  const bytecode = (program: typeof old.programs[number]) => ({ ...program, id: 'identity-ignored' });
  expect(next.programs.filter(lower).map(bytecode)).toEqual(old.programs.filter(lower).map(bytecode));
  expect(next.scalars).toEqual(old.scalars);
  for (const program of next.programs) expect(program.nodes.length).toBeLessThanOrEqual(128);
});

test('motion5 retains strict stateless admission and rejects extra pose storage', async () => {
  const { conchMotion5Clips } = await import('../art/driftwood-isle/approved-conch/motion5-study/conchMotion5Clips');
  const { numericCreaturePose } = await import('../src/game/plugin/channelPrograms');
  const clip = conchMotion5Clips();
  expect(() => numericCreaturePose(clip)).not.toThrow();
  expect(() => numericCreaturePose({ ...clip, privatePoseHistory: [] })).toThrow();
  const withLocal = conchMotion5Clips(), first = withLocal.programs[0];
  if (first === undefined) throw new Error('Missing first pose programme');
  first.locals = [{ initial: { op: 'constant', value: 0 }, next: 0 }];
  expect(() => numericCreaturePose(withLocal)).toThrow();
});

test('export exact admitted candidate numeric programs for capture preparation', async () => {
  // oxlint-disable-next-line import/no-nodejs-modules -- Persist exact admitted numeric evidence in the Node test harness.
  const {mkdirSync,writeFileSync}=await import('node:fs');
  const {conchMotion5Clips}=await import('../art/driftwood-isle/approved-conch/motion5-study/conchMotion5Clips');
  const clip=conchMotion5Clips();
  mkdirSync('tmp/conch-motion5-offline',{recursive:true});
  writeFileSync('tmp/conch-motion5-offline/poses.json',JSON.stringify(clip));
  writeFileSync('tmp/conch-motion5-offline/admission.json',JSON.stringify({programs:clip.programs.length,maximumNodes:Math.max(...clip.programs.map(p=>p.nodes.length)),scalars:clip.scalars},null,2));
});
