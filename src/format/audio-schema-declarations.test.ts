// oxlint-disable-next-line import/no-nodejs-modules -- Exercise actual declaration emission and consumption.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only these small compiler fixture files.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the repository compiler without a shell.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the installed TypeScript CLI.
import { execPath } from 'node:process';
import { expect, test } from 'vitest';

test('audio schemas emit isolated declarations that remain strictly checked and compact', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/audio-schema-declarations-'));
  const put = (file: string, text: string): void => { writeFileSync(resolve(root, file), text); };
  const run = (config: string): ReturnType<typeof spawnSync> => spawnSync(execPath,
    [resolve('node_modules/typescript/bin/tsc'), '-p', resolve(root, config)], { encoding: 'utf8', timeout: 10_000 });
  const options = { strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, types: [],
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', skipLibCheck: false };
  try {
    for (const name of ['audioProfiles', 'voicePatches']) put(`${name}.ts`, readFileSync(`src/format/${name}.ts`, 'utf8'));
    put('emit.json', JSON.stringify({ compilerOptions: { ...options, declaration: true, emitDeclarationOnly: true,
      isolatedDeclarations: true, outDir: 'out' }, files: ['audioProfiles.ts', 'voicePatches.ts'] }));
    const emit = run('emit.json');
    expect(emit.status, String(emit.stdout) + String(emit.stderr)).toBe(0);
    const declarations = ['audioProfiles', 'voicePatches'].map(name => readFileSync(resolve(root, `out/${name}.d.ts`), 'utf8'));
    expect(declarations.join('').length).toBeLessThan(35_000);
    expect(declarations.join('')).not.toContain('SchemaWithPipe');
    put('consumer.ts', `import * as v from 'valibot';
import { AudioNodeSchema, AudioSamplesSchema, AudioPhraseProgramSchema } from './out/audioProfiles';
import { VoicePatchesSchema } from './out/voicePatches';
export const node: v.InferInput<typeof AudioNodeSchema> = { id: 'filter', filter: ['lowpass', 100] };
export const samples: v.InferInput<typeof AudioSamplesSchema> = { set: 'birds', bed: 'woods', loopGains: {}, omitLoops: undefined };
export const phrase: v.InferOutput<typeof AudioPhraseProgramSchema> = { steps: [{ kind: 'repeat', count: 1, max: 2, body: [{ kind: 'value', id: 'gain', value: ['*', 2, 3] }] }] };
export type Voice = v.InferOutput<typeof VoicePatchesSchema>;
export const parsed: v.InferOutput<typeof AudioNodeSchema> = v.parse(AudioNodeSchema, node);
`);
    put('check.json', JSON.stringify({ compilerOptions: { ...options, noEmit: true }, files: ['consumer.ts'] }));
    const check = run('check.json');
    expect(check.status, String(check.stdout) + String(check.stderr)).toBe(0);
    put('consumer.ts', `import type * as v from 'valibot';
import { AudioNodeSchema } from './out/audioProfiles';
export const invalid: v.InferOutput<typeof AudioNodeSchema> = { id: 'emitter', panner: [1, 2] };
`);
    const invalid = run('check.json');
    expect(invalid.status).not.toBe(0);
    expect(String(invalid.stdout) + String(invalid.stderr)).toContain('TS2322');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
