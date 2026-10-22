// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the generator's actual Node strip-only parser.
import { stripTypeScriptTypes } from 'node:module';
import { expect,test } from 'vitest';

test('every v2 format module supports the generator strip-only loader',() => {
  const files = import.meta.glob<string>('../src/format/*V2.ts',{ eager: true,query: '?raw',import: 'default' });
  expect(Object.keys(files).length).toBeGreaterThan(0);
  for (const [file,source] of Object.entries(files)) {
    expect(() => stripTypeScriptTypes(source,{ mode: 'strip' }),file).not.toThrow();
  }
});
