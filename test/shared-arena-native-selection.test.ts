import type { PracticeNativeSelection } from '../src/game/practice/PracticeNativeActor';
import { expect, test } from 'vitest';
import { validateNativeSelectionKeys } from '../practice/shared-arena/nativeSelection';

const selected = { poseFile: 'poses/candidate.json', corpse: 'rigid' as const };
test('legacy products retain absence and exact native selection is accepted without promoting other identities', () => {
  expect(() => validateNativeSelectionKeys(['one:one'], undefined)).not.toThrow();
  expect(() => validateNativeSelectionKeys(['one:one'], { 'one:one': selected })).not.toThrow();
});
test('native composition refuses wildcard, unrelated, empty and multiple entries', () => {
  const cases: Readonly<Record<string, PracticeNativeSelection>>[] = [{}, { '*': selected }, { 'two:two': selected }, { 'one:one': selected, 'two:two': selected }];
  for (const selection of cases)
    expect(() => validateNativeSelectionKeys(['one:one', 'three:three'], selection)).toThrow('one exact admitted opponent');
});
