import { dirname, resolve } from 'node:path';

/** Resolve source syntax to the game boundary; relative imports cannot bypass the author-package rule. */
export function shardGameImport(filename, source) {
  if (typeof source !== 'string') return false;
  if (/^@wildshard\/game(?:\/|$)/u.test(source)) return true;
  return source.startsWith('.') && /\/src\/game(?:\/|$)/u.test(resolve(dirname(filename), source).replaceAll('\\', '/'));
}

/** Historical NPC definitions remain reachable only by the exact frozen compatibility consumers. */
export function legacyNpcImport(filename, source) {
  if (typeof source !== 'string') return false;
  const target = source.startsWith('@wildshard/game/') ? `src/game/${source.slice('@wildshard/game/'.length)}`
    : source.startsWith('.') ? resolve(dirname(filename), source).replaceAll('\\', '/') : '';
  return /(?:^|\/)src\/game\/systems\/npc\/(?:figureRig|figureMotion|faceHeads)(?:\.(?:ts|js))?$/u.test(target)
    || /(?:^|\/)src\/game\/systems\/npc\/?$/u.test(target);
}
