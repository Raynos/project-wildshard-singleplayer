#!/usr/bin/env node
// SHARD-PLATFORM (sp-o208): the Antler King's kit baked offline (./kingKit.ts): the lantern, ribcage and core as one
// hash-named rest-geometry pool GLB (public/assets/pine-hollow/baked/<sha256>.glb) and its rows (the pool, the lantern
// spots) in src/shards/pine-hollow/data/kingKit.generated.json, which models/antlerKing.ts reads.
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {bakeKingKit} from './kingKit.ts';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';

const rig=tier=>new Uint8Array(readFileSync(new URL(`../../../../public/assets/pine-hollow/creatures/antler-king-rig${tier==='phone'?'.phone':''}.rigged.glb`,import.meta.url)));
const made=await bakeKingKit(rig),out=new URL('../../../../public/assets/pine-hollow/baked/',import.meta.url);
const hash=createHash('sha256').update(made.glb).digest('hex');
if(hash!=='3d9b5fc17c7ac3e7fe148f4333b2ea62e2e9bf5999d89eea7f2ef0abf65e8220')throw new Error(`King kit hash changed (${hash}); update the declared generation output`);
mkdirSync(out,{recursive:true});writeFileSync(new URL(`${hash}.glb`,out),made.glb);
made.rows.pool.url=`/assets/pine-hollow/baked/${hash}.glb`;
const blobs=namedBlobOutput(new URL('../',import.meta.url),'pine-king-blobs');
blobs.add('models/king/kit.glb','glb',made.glb,made.rows.pool.url);
writeFileSync(new URL('../data/kingKit.generated.json',import.meta.url),`${JSON.stringify(made.rows)}\n`);
blobs.finish(new URL('../data/kingBlobs.generated.json',import.meta.url));
console.info(`pine-hollow king kit: ${String(made.glb.length)} B (${made.rows.pool.url})`);
