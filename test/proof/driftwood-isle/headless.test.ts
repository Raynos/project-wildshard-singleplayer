import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('fails closed on the real trusted entry without executing an empty data proxy', () => {
  const result = nativeCompatibility('driftwood-isle', 'headless');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ slug: 'driftwood-isle', compatible: false,
    headless: { status: 'blocked', ticksExecuted: 0, dependency: 'TypeScript parameter property is not supported in strip-only mode' } });
});
