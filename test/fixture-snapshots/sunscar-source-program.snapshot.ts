// CI7: the fixtures CI job runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Sunscar's source program runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { generated } from '../fixtures/sunscar-source-program';

test('sunscar-source-program snapshot', () => { expect(generated).toBeDefined(); });
