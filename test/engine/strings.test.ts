// oxlint-disable-next-line import/no-nodejs-modules -- This Node contract inventories every authored engine string key.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_STRINGS, engineString, installEngineStrings } from '../../src/engine/strings';
import { ENGINE_CONTENT_STRINGS } from '../../src/game/engineStrings';

describe('engine strings', () => {
  it('preserves English copy and template coercion', () => {
    installEngineStrings(ENGINE_CONTENT_STRINGS);
    expect(Object.values(ENGINE_STRINGS)).toContain('Resume');
    for (const [key, text] of Object.entries(ENGINE_CONTENT_STRINGS)) expect(engineString(key as keyof typeof ENGINE_STRINGS)).toBe(text);
    const keys = Object.keys(ENGINE_STRINGS) as (keyof typeof ENGINE_STRINGS)[];
    const template = keys.find((key) => ENGINE_STRINGS[key] === '⟦0⟧×');
    if (!template) throw new Error('Missing numeric template');
    expect(engineString(template, [1.25])).toBe('1.25×');
  });
  it('every static key used by an engine view exists', () => {
    let count = 0;
    function scan(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { scan(path); continue; }
        if (!path.endsWith('.ts') || path.endsWith('/strings.ts')) continue;
        for (const match of readFileSync(path, 'utf8').matchAll(/engineString\('([^']+)'/gu)) { expect(ENGINE_STRINGS).toHaveProperty(match[1] ?? ''); count++; }
      }
    }
    scan('src/engine'); expect(count).toBeGreaterThan(200);
    for (const [key, text] of Object.entries(ENGINE_STRINGS)) if (text === '') expect(ENGINE_CONTENT_STRINGS).toHaveProperty(key);
  });
});
