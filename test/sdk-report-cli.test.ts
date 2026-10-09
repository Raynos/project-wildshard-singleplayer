// oxlint-disable-next-line import/no-nodejs-modules -- CLI fixture owns only temporary author projects and outputs.
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture outside trusted legacy paths.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture and its workspace SDK link.
import { join, resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { newProject } from '../src/sdk/project';
import { runCli } from '../src/sdk/cli';

it('build prints the complete measured card and refuses an outside target overflow before emitting files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sf62-cli-')), project = join(root, 'project'), output = join(root, 'product');
  const messages: string[] = [], info = vi.spyOn(console, 'info').mockImplementation(message => { messages.push(String(message)); });
  try {
    newProject(project, 'report-fixture'); symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
    await runCli(['build', project, output, '--product-only']);
    expect(existsSync(join(output, 'shard.json'))).toBe(true);
    const text = messages.join('\n');
    for (const field of ['PERFORMANCE REPORT report-fixture: PASS', 'memory near player', 'worst grid memory', 'draws', 'triangles', 'graphs:', 'measured scripts (180 ticks)', 'fuel', 'critical', 'tiles', 'library', 'estimated playable']) expect(text).toContain(field);
    writeFileSync(join(project, 'shard.config.ts'), "import { emptyShardfile } from '@wildshard/sdk/author'; const s=emptyShardfile({slug:'pine-hollow',name:'Borrowed',author:'Fixture',revision:1,seed:1}); s.budgets.library.compressed=8000001; export default s;\n");
    const refused = join(root, 'refused');
    await expect(runCli(['build', project, refused, '--product-only'])).rejects.toThrow('PERFORMANCE REPORT pine-hollow: REFUSED');
    expect(existsSync(refused)).toBe(false);
  } finally { info.mockRestore(); rmSync(root, { recursive: true, force: true }); }
});
