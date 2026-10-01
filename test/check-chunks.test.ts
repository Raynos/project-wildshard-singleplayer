// oxlint-disable-next-line import/no-nodejs-modules -- Fixture tests execute the build checker on isolated files.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture build outputs stay outside the shared tree.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths need the host temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths are absolute for the CLI.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The checker runs under the current Node executable.
import { execPath } from 'node:process';
import { describe, it, expect } from 'vitest';

function check(rows: Record<string, { name: string; moduleIds: string[]; gzBytes: number }>, imports: string[] = [], links: Record<string, { imports?: string[]; dynamicImports?: string[] }> = {}): { status: number | null; output: string } {
  const root = mkdtempSync(join(tmpdir(), 'chunk-check-'));
  try {
    mkdirSync(join(root, 'dist/.vite'), { recursive: true });
    mkdirSync(join(root, 'src/game/shard'), { recursive: true });
    writeFileSync(join(root, 'src/game/shard/manifest-closure.generated.json'), JSON.stringify({ alpha: ['src/shards/alpha/manifest.ts', 'src/shards/alpha/data.ts'] }));
    const manifest = { 'index.html': { isEntry: true, file: 'entry.js', imports: ['main'] }, main: { src: 'src/main.ts', file: 'engine.js', imports }, ...Object.fromEntries(Object.keys(rows).filter((f) => f !== 'entry.js' && f !== 'engine.js').map((file) => [file, { file, ...links[file] }])) };
    writeFileSync(join(root, 'dist/.vite/manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(root, 'dist/.vite/chunk-modules.json'), JSON.stringify(rows));
    const run = spawnSync(execPath, [resolve('scripts/check-chunks.mjs'), 'dist'], { cwd: root, encoding: 'utf8' });
    return { status: run.status, output: run.stdout + run.stderr };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const row = (name: string, ...moduleIds: string[]): { name: string; moduleIds: string[]; gzBytes: number } => ({ name, moduleIds, gzBytes: 10 });
const base = { 'entry.js': row('entry', 'src/entry.ts'), 'engine.js': row('engine', 'src/main.ts', 'src/shards/alpha/manifest.ts', 'src/shards/alpha/data.ts') };

describe('chunk isolation gate', () => {
  it('allows manifest data at startup and a lazy plugin in its own chunk', () => {
    expect(check({ ...base, 'alpha.js': row('shard-alpha', 'src/shards/alpha/plugin.ts') }).status).toBe(0);
  });
  it('rejects a plugin reached by the cold boot static graph', () => {
    const result = check({ ...base, 'alpha.js': row('shard-alpha', 'src/shards/alpha/plugin.ts') }, ['alpha.js']);
    expect(result.status).toBe(1); expect(result.output).toContain('cold-boot');
  });
  it('allows a shard split over its own lazy chunks without requiring grouped names', () => {
    expect(check({ ...base, 'alpha.js': row('plugin', 'src/shards/alpha/plugin.ts'), 'extra.js': row('world', 'src/shards/alpha/world.ts') }, [], { 'alpha.js': { imports: ['extra.js'] } }).status).toBe(0);
  });
  it('rejects a plugin in main and mixed shard owners', () => {
    expect(check({ ...base, 'engine.js': row('engine', 'src/shards/alpha/plugin.ts') }).status).toBe(1);
    expect(check({ ...base, 'alpha.js': row('plugin', 'src/shards/alpha/plugin.ts', 'src/shards/beta/plugin.ts') }).output).toContain('mixes shard owners');
  });
  it.each(['imports', 'dynamicImports'] as const)('rejects a planted cross-shard %s edge', (edge) => {
    const result = check({ ...base, 'alpha.js': row('plugin', 'src/shards/alpha/plugin.ts'), 'beta.js': row('plugin', 'src/shards/beta/plugin.ts') }, [], { 'alpha.js': { [edge]: ['beta.js'] } });
    expect(result.status).toBe(1); expect(result.output).toContain('imports another shard (beta)');
  });
  it('rejects an import whose chunk is missing from the manifest', () => {
    const result = check({ ...base, 'alpha.js': row('plugin', 'src/shards/alpha/plugin.ts') }, [], { 'alpha.js': { imports: ['missing.js'] } });
    expect(result.status).toBe(1); expect(result.output).toContain('imports missing chunk');
  });
  it('rejects App or Three in the pre-entry graph, before retry can run', () => {
    for (const id of ['src/engine/app/runtime.ts', 'node_modules/three/build/three.module.js']) {
      expect(check({ ...base, 'engine.js': row('engine', id) }).output).toContain('pre-entry static graph');
    }
  });
  it('fails closed when the module report misses the entry chunk', () => {
    const result = check({ 'engine.js': base['engine.js'] });
    expect(result.status).toBe(1); expect(result.output).toContain('missing module report');
  });
});
