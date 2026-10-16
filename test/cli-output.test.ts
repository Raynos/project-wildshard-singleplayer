// oxlint-disable-next-line import/no-nodejs-modules -- Own bounded project and output fixtures under repository tmp.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned fixture paths.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { runCli } from '../src/sdk/cli';
import { buildProject, newProject } from '@wildshard/sdk/project';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';

test('CLI validates v2 output and refuses monolith disk inputs for validate and prove', async () => {
  mkdirSync('tmp', { recursive: true });
  const scratch = mkdtempSync(resolve('tmp', 'cli-output-')), log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    const project = resolve(scratch, 'project'), output = resolve(scratch, 'out'), old = resolve(scratch, 'old');
    newProject(project, 'cli-output');
    const source = await buildProject(project, output, { client: null, placeholders: false });
    await expect(runCli(['validate', output])).resolves.toBeUndefined();
    await expect(runCli(['validate', resolve(output, 'shard.json')])).resolves.toBeUndefined();
    await expect(runCli(['validate', resolve(output, 'other.json')])).rejects.toThrow('format-2 shard.json');
    mkdirSync(old);
    writeFileSync(resolve(old, 'shard.json'), encodeCanonicalJson(source));
    await expect(runCli(['validate', old])).rejects.toThrow(/format/u);
    await expect(runCli(['prove', resolve(old, 'shard.json'), resolve(scratch, 'absent-proof.json')])).rejects.toThrow(/format/u);
  } finally { log.mockRestore(); rmSync(scratch, { recursive: true, force: true }); }
});
