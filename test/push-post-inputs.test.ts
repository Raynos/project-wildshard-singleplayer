// oxlint-disable-next-line import/no-nodejs-modules -- Exercise cache publication on owned tiny files.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the owned source fixture.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { object, parse, record, string } from 'valibot';
import { beginPushInputs } from '../scripts/push-post-inputs.mjs';

test('only completed stable generation seals post tables and lint words', () => {
  const root = mkdtempSync(resolve('tmp/post-inputs-'));
  const put = (name: string, value: string): void => { const path = resolve(root, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, value); };
  try {
    put('src/author.ts', 'export const value = 1;');
    put('lint/ask-ids.json', '[]');
    const finish = beginPushInputs(root, { revision: 'a'.repeat(40), files: ['src/author.ts', 'lint/ask-ids.json'] });
    put('lint/ask-ids.json', '["E2"]');
    put('src/shards/fixture/discovery.generated.ts', 'export default {};');
    put('lint/shard-words.generated.json', '{}');
    put('lint/host-catalogue.generated.json', '{"staleDocs":true}');
    put('.cache/generation-phase.json', '{"seal":"phase-proof"}');
    finish();
    const saved = parse(object({ phase: string(), revision: string(), outputs: record(string(), string()) }),
      JSON.parse(readFileSync(resolve(root, '.cache/push-post-inputs.json'), 'utf8')));
    expect(saved.phase).toBe('phase-proof');
    expect(saved.revision).toBe('a'.repeat(40));
    expect(Object.keys(saved.outputs).sort()).toEqual(['lint/shard-words.generated.json', 'src/shards/fixture/discovery.generated.ts']);
    put('src/author.ts', 'export const value = 2;');
    expect(finish).toThrow('source moved');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
