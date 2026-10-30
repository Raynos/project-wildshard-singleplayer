import { expect, test, afterAll } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The writer retires only its own cold source cache.
import { rmSync } from 'node:fs';
import { coldOutputFixture } from '../fixtures/nalati-output-cache';

// Construction is shared; every cache, corruption and publication oracle stays in its original suite.
test('nalati-output-cache snapshot', () => { expect(coldOutputFixture.output).toBeDefined(); });
afterAll(() => { rmSync(coldOutputFixture.cache, { recursive: true, force: true }); });
