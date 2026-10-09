import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('fails closed on the real trusted entry without executing an empty data proxy', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'headless');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ slug: 'nine-dragon-stack', compatible: false,
    headless: { status: 'blocked', ticksExecuted: 0, dependency: 'Renderer dependency in Node simulation: repo:/src/engine/combat/view/SweptMelee.ts' } });
});
