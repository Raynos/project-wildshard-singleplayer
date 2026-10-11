// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns its source tree and generated outputs.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A disposable root cannot affect authored repository rows.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Check only fixture-owned paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { debugFlags } from '../lint/debug-flags.mjs';

it('inventories authored SDK rows once, ignores compiled copies and still refuses opaque source rows', () => {
  const root = mkdtempSync(join(tmpdir(), 'debug-source-'));
  try {
    const source = join(root, 'src/sdk'), generated = join(source, 'dist/client');
    mkdirSync(generated, { recursive: true });
    writeFileSync(join(source, 'authored.ts'), "const DEBUG_ROWS = [{id:'owned',ask:'E435',reviewBy:'2026-12-01'}];");
    writeFileSync(join(generated, 'compiled.js'), 'ctx.debugRow(minifiedValue);');
    expect(debugFlags(root).map(row => row.id)).toEqual(['owned']);
    writeFileSync(join(source, 'authored.ts'), 'ctx.debugRow(opaque);');
    expect(() => debugFlags(root)).toThrow('Unresolvable Debug row');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
