// Explicit build-tool composition root: install only this generator's real manifest, never a second shard's runtime.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installShards } from '../src/game/shard/list.ts';

const slug=process.argv.find(arg=>arg.startsWith('--generation-shard='))?.slice(19);
if(slug===undefined || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Missing generator shard');
/** @type {{default:import('../src/game/shard/manifest.ts').ShardManifest}} */
const loaded=await import(pathToFileURL(resolve(import.meta.dirname,`../src/shards/${slug}/manifest.ts`)).href);
if(loaded.default.slug!==slug) throw new Error('Generator manifest identity differs');
installShards([loaded.default]);
