// CI7: prepare runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Pine's program runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { PINE } from '../fixtures/pine-program';

test('pine-program snapshot', () => { expect(PINE).toBeDefined(); });
