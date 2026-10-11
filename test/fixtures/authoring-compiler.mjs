// Run the real static compiler outside V8's runtime coverage collector.
// No engine module executes here; example gameplay stays covered in the parent.
import process from 'node:process';
import { apiSurface } from '../../scripts/gen-api.mjs';
import { checkAuthoringExamples } from '../../scripts/docs/authoring-reference.mjs';

const [kind, root, ...files] = process.argv.slice(2);
if (root === undefined) throw new Error('Missing compiler root');
const result = kind === 'api' ? apiSurface(root)
  : kind === 'examples' ? checkAuthoringExamples(root, files.length === 0 ? undefined : files)
  : (() => { throw new Error('Unknown static compiler proof'); })();
process.stdout.write(`${JSON.stringify(result)}\n`);
