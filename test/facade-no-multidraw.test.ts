// E271 / E272 / E323: facade multi-draw is banned on every shard, tier and platform (docs/audits/nine-dragon-mobile-multidraw.md).
// The real-scene check (scripts/test-facade-instancing.mjs) only runs by hand in `pnpm test:gpu-boot`. Since E315 the facade
// is placed through the shared `place()`, whose `draw: 'batched'` is multi-draw — one word away. This static check runs in
// every push and CI: nothing under Nine Dragon may ask for batched drawing, BatchedMesh or the multi-draw extension.
// (Non-facade batching elsewhere — the Pine Hollow forest and crags — is allowed by the audit and not checked here.)
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(["../src/shards/nine-dragon-stack/**/*.ts","../src/game/systems/viewmodel/armRig.ts"], { query: '?raw', import: 'default', eager: true });
expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
const FACADE = '../src/shards/nine-dragon-stack/world/facade/batch.ts';
const BANNED = /BatchedMesh|WEBGL_multi_draw|multiDraw|draw\s*:\s*['"`]batched['"`]|drawBatched/;

/** The code only: block and line comments stripped, so a comment that names the ban does not trip it. */
function code(src: string): string {
  return src.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('no facade multi-draw (E272)', () => {
  it('nothing under nine-dragon-stack asks for batched drawing', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    const hits = Object.entries(SOURCES).flatMap(([f, src]) => code(src).split('\n')
      .map((line, i) => (BANNED.test(line) ? `${f}:${i + 1}: ${line.trim()}` : null))
      .filter((h): h is string => h !== null));
    expect(hits).toEqual([]);
  });

  it('every draw mode the facade asks for is a literal that is not batched', () => {
    const src = code(SOURCES[FACADE] ?? '');
    const modes = [...src.matchAll(/draw\s*:\s*([^,}\n]+)/g)].map((m) => (m[1] ?? '').trim());
    expect(modes.length).toBeGreaterThan(0);
    for (const m of modes) expect(m, `batch.ts draw: ${m} (must be a string literal, never 'batched')`).toMatch(/^'(instanced|merged|single)'$/);
  });
});
