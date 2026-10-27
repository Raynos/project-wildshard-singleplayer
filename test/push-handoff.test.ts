// oxlint-disable-next-line import/no-nodejs-modules -- Run the candidate metadata policy in its native Python interpreter.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import source from '../scripts/push_handoff.py?raw';
import workflow from '../.github/workflows/deploy.yml?raw';

test('CI handoffs bind explicit steps before upload and retain exact older tips', () => {
  expect(execFileSync('python3', ['test/test_push_handoff.py', '--candidate-stdin'], {
    input: source, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
  })).toBe('');
});

test('push CI runs exact handoffs independently and keeps every original smoke prerequisite', () => {
  const job = workflow.split('\n  gate-deferred:\n')[1]?.split('\n  build-and-deploy:\n')[0];
  expect(job).toBeDefined();
  if (job === undefined) throw new Error('Missing handoff job');
  expect(job).toContain("if: github.event_name == 'push'");
  expect(job).toMatch(/WS_GATE_DEFERRED: \$\{\{ vars\.WS_GATE_DEFERRED \}\}/u);
  expect(job).toContain('fetch-depth: 0');
  expect(job.indexOf('scripts/push_handoff.py --select')).toBeLessThan(job.indexOf('pnpm install'));
  expect(job).toContain('scripts/push-deferred-ci.mjs "$HANDOFF_BASE" "$HANDOFF_STEPS"');
  expect(job).toContain('python3 scripts/ci-fail-fast.py -- node');
  expect(job).toContain('name: ci-failures-gate-deferred');
  const dispatch = workflow.split('\n  dispatch-boot-smoke:\n')[1];
  expect(dispatch).toContain('needs: [gate-deferred,');
  for (const name of ['build-and-deploy', 'typecheck-lint', 'derived-docs', 'generated-inputs', 'products', 'behaviour', 'behaviour-products'])
    expect(dispatch).toContain(name);
});
