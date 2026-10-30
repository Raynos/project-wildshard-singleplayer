// CI7: prepare runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Nalati's project read runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { readNalatiProject } from '../fixtures/nalati-project';

test('nalati-project snapshot', async () => { expect(await readNalatiProject()).toBeDefined(); });
