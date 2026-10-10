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

/** G307: a game's exports map is its plugin surface, never a parallel SDK facade allowlist. */
export function gamePluginImportViolation(filename, source, exports) {
  const path = filename.replaceAll('\\', '/');
  const local = /(?:^|\/)src\/shards\/[^/]+\/(.+)$/u.exec(path)?.[1];
  if (local === undefined || !shardGameImport(filename, source)) return null;
  if (!local.startsWith('runtime/')) return 'game imports belong only in runtime/';
  if (!source.startsWith('@wildshard/game/')) return 'use the defining @wildshard/game package export';
  if (!source.startsWith('@wildshard/game/plugin/')) return 'runtime imports use only game/plugin/*';
  const key = `.${source.slice('@wildshard/game'.length)}`;
  return Object.hasOwn(exports, key) ? null : 'game plugin module is not published in package exports';
}

/** Identify an engine boundary without letting relative imports bypass the shrink-only migration count. */
export function shardEngineImport(filename, source) {
  if (typeof source !== 'string') return false;
  if (/^@wildshard\/engine(?:\/|$)/u.test(source)) return true;
  return source.startsWith('.') && /\/src\/engine(?:\/|$)/u.test(resolve(dirname(filename), source).replaceAll('\\', '/'));
}

/** DS0.3 author folders use three, the authoring SDK, commons, and their own shard files only. */
export function generatorImportViolation(filename, source) {
  const path=filename.replaceAll('\\','/'), match=/(?:^|\/)src\/shards\/([^/]+)\/(.+)$/u.exec(path);
  if(match===null || !(/^(?:generators|data|quests)\//u.test(match[2]) || match[2]==='shard.config.ts')) return null;
  if(typeof source!=='string')return null;
  if(/^@wildshard\/sdk\/runtime(?:\/|$)/u.test(source))return 'trusted SDK runtime code is not an authoring import';
  if(source==='three' || source.startsWith('three/') || /^@wildshard\/(?:sdk|commons)(?:\/|$)/u.test(source))return null;
  const local=source.startsWith('.') ? resolve(dirname(filename),source).replaceAll('\\','/') : '';
  const boundary=path.slice(0,path.length-match[2].length);
  if(local.startsWith(boundary))return null;
  return 'author folders import only three, sdk, commons or their own shard files';
}
