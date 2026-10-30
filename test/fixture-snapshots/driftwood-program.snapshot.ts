// CI7: the fixtures CI job runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Driftwood's source program runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { DRIFTWOOD } from '../fixtures/driftwood-program';

test('driftwood-program snapshot', () => { expect(DRIFTWOOD).toBeDefined(); });
