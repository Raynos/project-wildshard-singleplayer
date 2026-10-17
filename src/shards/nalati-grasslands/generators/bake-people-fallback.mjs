// Preserve the camp's load-failure figures without constructing or painting them at runtime.
import { resolve } from 'node:path';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { writeGeometry, join } from './geometryWriter.ts';
import { buildPeopleFallback } from './places.ts';
import frames from '../data/peopleFrames.json' with { type: 'json' };
import motion from '../data/peopleMotion.json' with { type: 'json' };
import content from '../data/questContent.json' with { type: 'json' };

export function bakePeopleFallback() {
  const geometry = part => {
    const blocks = [], row = writeGeometry(part, blocks, 'people fallback');
    part.dispose();
    return { row, bytes: Buffer.from(join(blocks)).toString('base64') };
  };
  return withPortableMath(() => Object.fromEntries(Object.keys(frames).map(id => {
    const parts = buildPeopleFallback(id), profile = structuredClone(motion[id]);
    if (profile.orbit) Object.assign(profile.orbit, { x: content.people[id].x, z: content.people[id].z });
    return [id, { radius: parts.radius, motion: profile, body: geometry(parts.body), head: geometry(parts.head), arm: geometry(parts.arm) }];
  })));
}
if (import.meta.main) {
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-people-fallback');
  writer.put(resolve(import.meta.dirname, '../boot/peopleFallback.generated.json'), jsonBytes(bakePeopleFallback()));
  writer.finish();
}
