import { expect } from 'vitest';
import { isAuthoringInput } from '../../scripts/authoring-inputs.mjs';

const METADATA = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);

/**
 * G320 for one generation job, as a limit rather than an exact list (usage audit 2026-10-13, Jake's pick): every file of
 * the producer's real closure is keyed (a missing key would reuse a stale output), and any extra key is still confined to
 * the shard's authoring folders, the authoring packages or workspace metadata (an extra key only costs a rebuild).
 */
export function expectKeyedClosure(inputRoots: readonly string[], closure: readonly string[], shard: string): void {
  expect(closure.filter(file => !inputRoots.includes(file)), 'closure files the job does not key').toEqual([]);
  expect(inputRoots.filter(file => !closure.includes(file) && !METADATA.has(file) && !isAuthoringInput(file, shard)),
    'keyed files outside the authoring boundary').toEqual([]);
}
