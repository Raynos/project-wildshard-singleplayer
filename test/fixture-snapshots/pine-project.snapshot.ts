// CI7: prepare runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Pine's project read runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { readPineProject } from '../fixtures/pine-project';

test('pine-project snapshot', async () => { expect(await readPineProject()).toBeDefined(); });
