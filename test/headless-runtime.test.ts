// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the SDK worker and trusted entry in plain Node without browser-like Vitest globals.
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('installs trusted native actors before exact restore, buffers effects and refuses missing entry proofs', () => {
  const result: unknown = JSON.parse(execFileSync('node', ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', 'test/fixtures/headless/trusted-run.mjs'], { encoding: 'utf8', timeout: 60_000 }));
  expect(result).toEqual({ nativeActors: 1, damaged: true, suffixTicks: 30, exact: true, rewards: 1, entryProofRefused: true, invalidModuleRefused: true });
}, 60_000);

it('hands a validated deferred roster to the trusted installer before native restoration', () => {
  const result: unknown = JSON.parse(execFileSync('node', ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', 'test/fixtures/headless/deferred-run.mjs'], { encoding: 'utf8', timeout: 60_000 }));
  expect(result).toEqual({ checkpoints: 2, exact: true, respawns: true });
}, 60_000);
