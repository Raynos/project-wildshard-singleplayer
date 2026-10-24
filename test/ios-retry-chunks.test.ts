// oxlint-disable-next-line import/no-nodejs-modules -- Bind retry witnesses to actual source modules.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { retryChunks, type ChunkModules } from '../scripts/ios-retry-check.mjs';

const modules: ChunkModules = {
  'assets/three.js': { name: 'three', moduleIds: ['node_modules/three/build/three.module.js'] },
  'assets/engine.js': { name: 'engine', moduleIds: ['src/engine/core/Game.ts'] },
  'assets/client-plan.js': { name: 'client-plan', moduleIds: ['src/game/shardfile/clientPlan.ts'] },
};

test('retry selection uses the current data-only client plan module', () => {
  for (const row of Object.values(modules)) for (const id of row.moduleIds) expect(existsSync(id), id).toBe(true);
  expect(retryChunks(modules)).toEqual(['/assets/three.js', '/assets/engine.js', '/assets/client-plan.js']);
});

test('renamed bundles use actual module identities and shared bundles deduplicate', () => {
  const bundle = { name: 'entry', moduleIds: Object.values(modules).flatMap(row => row.moduleIds) };
  expect(retryChunks({ 'assets/entry.js': bundle })).toEqual(['/assets/entry.js']);
});

test('missing actual client runtime refuses rather than silently shortening retry coverage', () => {
  const { 'assets/client-plan.js': _client, ...withoutClient } = modules;
  expect(() => retryChunks(withoutClient)).toThrow('No actual chunk for client-plan');
});
