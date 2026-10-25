// Path-only play boundary, shared by lint and the typed catalogue builder.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const freezes = new Map();
/** Build-only functions and exact frozen predecessors are not play callbacks. */
export function hostPlayFile(root, file) {
  const match = /^src\/shards\/([^/]+)\/(.+)$/u.exec(file);
  if (!match || /^(?:data|generators|behaviour|assets|blender)\/|^shard\.config\.|\.d\.ts$|\.generated\./u.test(match[2])) return false;
  if (!freezes.has(root)) {
    const frozen = resolve(root, 'lint/legacy-shards.json');
    freezes.set(root, existsSync(frozen) ? JSON.parse(readFileSync(frozen, 'utf8')).shards ?? {} : {});
  }
  const row = freezes.get(root)[match[1]];
  return row === undefined || !Object.hasOwn(row.files, match[2]);
}
