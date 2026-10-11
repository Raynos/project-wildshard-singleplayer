// oxlint-disable-next-line import/no-nodejs-modules -- Execute the real lint plugin in an owned fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own all temporary author modules and configuration.
import { cpSync, symlinkSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned fixture directory outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke the current Node without a shell.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('DS0.3 detects author escapes, engine debt and SDK value/type facades without refusing author implementations', () => {
  const root=mkdtempSync(join(tmpdir(),'authoring-boundary-'));
  const put=(file:string,source:string):void=>{const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source);};
  const cases=[
    {file:'src/shards/ember/generators/world.ts',code:"import 'three'; import 'three/addons/math/SimplexNoise'; import '@wildshard/sdk/bake'; import '@wildshard/commons/pack'; import '../data/row';",rule:'generator-imports',count:0},
    {file:'src/shards/ember/data/escapes.ts',code:"import type { X } from '@wildshard/game/plugin/context'; import('@wildshard/engine/sim'); type T = import('../../../game/plugin/context').T; require('node:fs');",rule:'generator-imports',count:4},
    {file:'src/shards/ember/quests/other.ts',code:"export * from '../../other/data/rows'; import 'valibot';",rule:'generator-imports',count:2},
    {file:'src/shards/ember/shard.config.ts',code:"import type X from '@wildshard/engine/core/config';",rule:'generator-imports',count:1},
    {file:'src/shards/ember/runtime/engine.ts',code:"import type X from '@wildshard/engine/sim'; import('../../../engine/sim'); type T = import('@wildshard/engine/physics/query').T; const m = require('@wildshard/engine/math');",rule:'shard-engine-imports',count:4},
    {file:'src/shards/ember/runtime/game.ts',code:"import '@wildshard/game/plugin/context';",rule:'shard-engine-imports',count:0},
    {file:'src/shards/ember-legacy/data/sealed.ts',code:"import '@wildshard/engine/math';",rule:'generator-imports',count:0},
    {file:'src/shards/ember-legacy/data/new.ts',code:"import '@wildshard/engine/math';",rule:'generator-imports',count:1},
    {file:'src/sdk/facade.ts',code:"import { X as Native } from '@wildshard/game/plugin/brain'; import type { State } from '@wildshard/engine/sim'; const intermediate = Native; export const X = intermediate; export type StateAlias = State; export { Native as Other };",rule:'sdk-no-facade',count:3},
    {file:'src/sdk/namespace.ts',code:"import * as Native from '../engine/math'; export const X = Native.X; export type State = import('@wildshard/game/plugin/brain').State; export * from '@wildshard/engine/math';",rule:'sdk-no-facade',count:3},
    {file:'src/sdk/equals.ts',code:"import Native = require('@wildshard/game/plugin/brain'); export const X = Native.X; export { Native };",rule:'sdk-no-facade',count:2},
    {file:'src/sdk/destructured.ts',code:"import * as Native from '@wildshard/game/plugin/brain'; const { X: renamed, nested: { Y }, ...rest } = Native; export { renamed, Y, rest }; export const [first, ...tail] = Native.rows;",rule:'sdk-no-facade',count:5},
    {file:'src/sdk/own-destructured.ts',code:"const authored = { x: 1, y: 2 }; export const { x, ...rest } = authored;",rule:'sdk-no-facade',count:0},
    {file:'src/shards/ember/generators/computed.ts',code:"import('../data/' + name); require('@wildshard/sdk/' + name);",rule:'generator-imports',count:2},
    {file:'src/shards/ember/generators/trusted.ts',code:"import '@wildshard/sdk/runtime/state';",rule:'generator-imports',count:1},
    {file:'src/sdk/author.ts',code:"import { Vector3 } from 'three'; import { clamp } from '@wildshard/engine/math'; export class Mesh { position = new Vector3(); } export function bake(x: number) { return clamp(x * 2, 0, 1); } export type Options = { scale: number };",rule:'sdk-no-facade',count:0},
    {file:'src/game/own.ts',code:"import { X } from '@wildshard/engine/math'; export const Y = X;",rule:'sdk-no-facade',count:0},
  ];
  try {
    cpSync(resolve('lint'),join(root,'lint'),{recursive:true});
    put('lint/legacy-shards.json',JSON.stringify({version:1,sealed:true,shards:{'ember-legacy':{primary:'ember',source:'a'.repeat(40),files:{'data/sealed.ts':'b'.repeat(64)}}}}));
    for(const name of ['vite','@typescript/typescript6']){const path=join(root,'node_modules',name);mkdirSync(dirname(path),{recursive:true});symlinkSync(resolve('node_modules',name),path,'dir');}
    for(const row of cases)put(row.file,row.code);
    put('config.json',JSON.stringify({jsPlugins:[join(root,'lint/wildshard-plugin.js')],categories:{correctness:'off'},rules:{'wildshard/generator-imports':'error','wildshard/shard-engine-imports':'error','wildshard/sdk-no-facade':'error'}}));
    const result=spawnSync(execPath,[resolve('node_modules/oxlint/bin/oxlint'),'-c',join(root,'config.json'),'-f','json','src'],{cwd:root,encoding:'utf8'});
    const output:unknown=JSON.parse(result.stdout);
    if(output===null||typeof output!=='object'||!('diagnostics' in output)||!Array.isArray(output.diagnostics))throw new Error('Missing diagnostics');
    const diagnostics:unknown[]=output.diagnostics;
    expect(result.status,result.stderr).toBe(1);
    for(const row of cases)expect(diagnostics.filter(d=>d!==null&&typeof d==='object'&&'filename' in d&&'code' in d&&d.filename===row.file&&d.code===`wildshard(${row.rule})`),row.file).toHaveLength(row.count);
  } finally {rmSync(root,{recursive:true,force:true});}
});
