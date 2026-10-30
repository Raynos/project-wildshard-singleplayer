// CI7: the fixtures CI job runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Nine's product source read runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { inputs } from '../fixtures/nine-product-inputs';

test('nine-product-inputs snapshot', () => { expect(inputs).toBeDefined(); });
