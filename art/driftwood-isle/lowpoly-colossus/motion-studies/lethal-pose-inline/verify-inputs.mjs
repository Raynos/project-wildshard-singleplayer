import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir='art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/';
const pins=JSON.parse(readFileSync(dir+'protected-inputs.json','utf8'));
for(const [path,pin] of Object.entries(pins)) {
  const bytes=readFileSync(path);
  assert.equal(bytes.length,pin.bytes,path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,path);
}
const original=dir.replace('lethal-pose-inline','lethal-pose-input');
const closure=JSON.parse(readFileSync(original+'closure.json','utf8'));
for(const [path,digest] of Object.entries({...closure.sourceFiles,...closure.protectedInputs})) {
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,path);
}
console.log(`PASS: ${Object.keys(pins).length} pinned inputs and original failed-study closure unchanged`);
