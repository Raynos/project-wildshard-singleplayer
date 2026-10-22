import { expect,test } from 'vitest';
import { selectDeveloperScriptV2 } from '../src/engine/script/selectionV2';

const row = () => ({ abi: 2,minor: 0,compilerRevision: 1,admissionRevision: 1,hash: 'a'.repeat(64),lane: 'view',pages: 1,ioBytes: 656 });
test('public construction never even reads the optional v2 declaration', () => {
  expect(selectDeveloperScriptV2({ get v2() { throw new Error('Public entry touched v2'); } },false)).toBeNull();
  expect(selectDeveloperScriptV2({},true)).toBeNull();
});
test('Developer selection snapshots its chosen metadata', () => {
  const input = row(), selected = selectDeveloperScriptV2({ v2: input },true);input.pages = 4;input.lane = 'sim';
  expect(selected).toEqual(row());expect(Object.isFrozen(selected)).toBe(true);
});
