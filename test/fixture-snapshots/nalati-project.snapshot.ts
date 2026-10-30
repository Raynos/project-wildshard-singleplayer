// CI7: the fixtures CI job runs this file with WS_FIXTURE_SNAPSHOT_WRITE so Nalati's project read runs once per CI run (test/fixtures/runSnapshot.ts).
import { expect, test } from 'vitest';
import { readNalatiProject } from '../fixtures/nalati-project';

// Read at import, like the program fixtures: a project read outlasts a test's 30 s timeout on CI.
const project = await readNalatiProject();

test('nalati-project snapshot', () => { expect(project).toBeDefined(); });
