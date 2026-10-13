// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the defining offline comparator without opening a browser.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Evaluate only the exact comparator branch with in-memory capture files.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync('scripts/proof-driftwood-look-parity.mjs', 'utf8');
const comparator = source.slice(source.indexOf('const compare ='), source.indexOf('const url ='));
function compare(changed: boolean, raw: boolean, extraPose = false): { status: number; lines: string[] } {
  const row = { tier: 'phone', pose: 'wreck', calls: 1, triangles: 1, width: 1, height: 1, pixels: 'equal', raw: 'base.rgba' };
  const base = { build: 'base', rows: [row], tiers: { phone: { gpuBytes: 4, colliders: 'same', pieces: 1, colliderCount: 1, programs: 1, shaders: 'same' } } };
  const candidate = { ...base, build: 'candidate', rows: [{ ...row, pixels: changed ? 'different' : 'equal', raw: 'candidate.rgba' }] };
  if (extraPose) candidate.rows.push({ ...row, pose: 'extra' });
  const files = new Map<string, string | Uint8Array>([
    ['base.json', JSON.stringify(base)], ['candidate.json', JSON.stringify(candidate)],
    ['base.rgba', Uint8Array.from([0, 0, 0, 255])],
    ['candidate.rgba', Uint8Array.from([0, 0, 0, changed ? 254 : 255])],
  ]);
  const lines: string[] = [];
  let status = -1;
  runInNewContext(comparator, {
    arg: () => 'base.json,candidate.json', existsSync: () => raw,
    readFileSync: (path: string) => { const file = files.get(path); if (file === undefined) throw new Error('Missing comparison fixture'); return file; },
    console: { log: (line: string) => { lines.push(line); } }, process: { exit: (code: number) => { status = code; } },
  });
  return { status, lines };
}

it.each([true, false])('refuses a differing pixel hash with raw capture availability %s', raw => {
  const result = compare(true, raw);
  expect(result.status).toBe(1);
  expect(result.lines.join('\n')).toContain('pixels differ');
  if (raw) expect(result.lines.join('\n')).toContain('1 of 1 pixels differ');
});
it('accepts byte-identical captures and rejects a missing pose', () => {
  expect(compare(false, true).status).toBe(0);
  expect(compare(false, true, true).status).toBe(1);
});
