// Nine dressing models from retained author-only three.js recipes; no runtime/Node bridge.
import { bakeDressing, dressingDescription } from './dressingBake.ts';
import { writeNalatiParts, writeDressingScene } from './bake-nalati-places.mjs';

const check = process.argv.includes('--check');
writeNalatiParts([{ name: 'dressing', json: 'dressingGeos.json', part: bakeDressing() }], check);
writeDressingScene(dressingDescription(), check);
