// CI7: prepare runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Nine's source program runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { generated } from '../fixtures/nine-source-program';

test('nine-source-program snapshot', () => { expect(generated).toBeDefined(); });
