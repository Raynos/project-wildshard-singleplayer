// oxlint-disable-next-line import/no-nodejs-modules -- Run the real policy plugin against an isolated fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned small compiler inputs, removed after each test.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve policy fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Child oxlint inherits this process environment.
import { cwd, env, execPath } from 'node:process';
import { expect, test } from 'vitest';
import { hostAnalysis, hostCallbackViolations } from '../lint/host-callbacks.mjs';
import { hostCatalogue, hostVerdicts, renderHostCatalogue } from '../scripts/gen-host-catalogue.mjs';

const file = 'src/shards/sample/runtime/main.ts';
function fixture(source: string) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/host-callback-'));
  const write = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text); };
  write('src/game/host.ts', `export function host(options: unknown) { return options; }
export class Base { install(options: object) { return options; } }
export interface Ports { onTick: (fn: () => void) => void }`);
  write('src/shards/sample/runtime/rows.ts', 'export const rows = { step() {} };');
  write(file, source);
  return { root, write, close: () => rmSync(root, { recursive: true, force: true }) };
}

test('resolved host boundaries follow aliases, inherited methods, named callbacks and option spreads', () => {
  const f = fixture(`import {host as accept, Base, type Ports} from '../../../game/host';
import * as api from '../../../game/host'; import {rows} from './rows';
const named=()=>{}; const options={...rows, tick:named};
accept(options); api.host({next: named});
class Derived extends Base { go() { this.install({ready(){}}); } }
function setup(ctx:Ports, callback:()=>void) {ctx.onTick(callback);}
accept.call(null,{run:named}); accept.apply(null,[{run:named}]);`);
  try {
    const issues = hostCallbackViolations(f.root, file);
    expect(issues).toHaveLength(7);
    expect(new Set(issues.map(row => row.module))).toEqual(new Set(['src/game/host.ts']));
    expect(issues.map(row => row.path)).toContain('arg0.*.step');
    expect(issues.some(row => row.export === 'Base' && row.member === 'install')).toBe(true);
    expect(hostAnalysis(f.root).scan(file).calls).toHaveLength(6);
  } finally { f.close(); }
});

test('ordinary helpers, array callbacks, data, build inputs and frozen files do not count', () => {
  const f = fixture(`import {host} from '../../../game/host';
function local(fn:()=>void) { fn(); } local(()=>{}); [1].map(x=>x+1);
host({rows:[{value:1}]}); { const host=(fn:()=>void)=>fn(); host(()=>{}); }`);
  try {
    f.write('src/shards/sample/data/build.ts', `import {host} from '../../../game/host'; host(()=>{});`);
    f.write('lint/legacy-shards.json', JSON.stringify({ shards: { sample: { files: { 'runtime/frozen.ts': 'hash' } } } }));
    f.write('src/shards/sample/runtime/frozen.ts', `import {host} from '../../../game/host'; host(()=>{});`);
    f.write('src/shards/sample/runtime/module.mts', `import {host} from '../../../game/host'; host(()=>{});`);
    expect(hostCallbackViolations(f.root, file)).toEqual([]);
    expect(hostCallbackViolations(f.root, 'src/shards/sample/data/build.ts')).toEqual([]);
    expect(hostCallbackViolations(f.root, 'src/shards/sample/runtime/frozen.ts')).toEqual([]);
    expect(hostCallbackViolations(f.root, 'src/shards/sample/runtime/module.mts')).toHaveLength(1);
  } finally { f.close(); }
});

test('optional and nested forwarded callbacks count without expanding platform service methods', () => {
  const f = fixture(`import {host, Base} from '../../../game/host';
function forward(options:{nested:{run?:()=>void},service:Base},yes:boolean){host(options);host(yes ? ()=>{} : null);}`);
  try {
    const issues = hostCallbackViolations(f.root, file);
    expect(issues.map(row => row.path)).toEqual(['arg0.nested.run', 'arg0.true']);
  } finally { f.close(); }
});

test('ordinary oxlint refuses callback growth and new files, while count mode emits old debt', () => {
  const f = fixture("import {host} from '../../../game/host'; host(()=>{});");
  try {
    const baseline = resolve(f.root, 'ratchet.json'), config = resolve(f.root, 'lint.json');
    f.write('ratchet.json', JSON.stringify({ 'wildshard/no-shard-host-callback': { [file]: 1 } }));
    const run = (count: boolean) => {
      f.write('lint.json', JSON.stringify({ jsPlugins: [resolve(cwd(), 'lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/no-shard-host-callback': ['error', { count }] } }));
      return spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', config, '-f', 'json', '--no-ignore', resolve(f.root, file)], { env: { ...env, WILDSHARD_RATCHET_FILE: baseline }, encoding: 'utf8' });
    };
    expect(run(false).status).toBe(0);
    expect(run(true).stdout).toContain('Shard TS callback');
    f.write(file, "import {host} from '../../../game/host'; host(()=>{}); host({run(){}});");
    expect(run(false).status).toBe(1);
    f.write('ratchet.json', '{}');
    expect(run(false).status).toBe(1);
  } finally { f.close(); }
});

test('catalogue joins section fields and actual callers; pending users grant no pass', () => {
  const f = fixture("import {host} from '../../../game/host'; host('world/props');");
  try {
    f.write('src/format/sections.ts', "export interface PlatformSections { 'world/props': { props: number[] }; 'ui/ui': { title: string } }");
    f.write('src/shards/second/runtime/main.ts', "import {host} from '../../../game/host'; host({answer:7});");
    f.write('lint/platform-pending-users.json', JSON.stringify({ entries: [{ module: 'src/game/host.ts', export: 'Base', shard: 'planned' }] }));
    const reference = { fields: [{ path: '$.props', type: 'array' }], abi: [{ name: 'query' }], contract: { version: 0 } };
    const result = hostCatalogue(f.root, reference), called = result.hosts.find(row => row.export === 'host'), planned = result.hosts.find(row => row.export === 'Base');
    expect(called?.users).toEqual(['sample', 'second']);
    // Both source files may be orphaned: static calls prove candidates, not live adoption.
    expect(called?.verdicts['twoRealUsers']?.status).toBe('needs-review');
    expect(called?.verdicts['dataOnly']?.status).toBe('needs-review');
    expect(planned?.users).toEqual([]);
    expect(planned?.verdicts['twoRealUsers']?.status).toBe('needs-review');
    expect(result.sections[1]?.fields.map(field => field.name)).toEqual(['props']);
    expect(result.sections[1]?.hosts).toEqual(['src/game/host.ts#host']);
    expect(result.sections[1]?.users).toEqual(['sample']);
    expect(result.fields).toEqual(reference.fields);
    expect(result.wasm.signatures).toEqual(reference.abi);
    expect(renderHostCatalogue(result)).toContain('world/props');
    expect(hostCatalogue(f.root, reference)).toEqual(result);
  } finally { f.close(); }
});

test('review credit expires on changed source and never overrides observed callbacks', () => {
  const f = fixture("import {host} from '../../../game/host'; host(()=>{});");
  try {
    const callbacks = hostCallbackViolations(f.root, file);
    const audit = { sourceHash: 'exact', evidence: 'reviewed source and live entry reach', verdicts: { twoRealUsers: 'pass', noShardNouns: 'pass', dataOnly: 'pass', serverSafe: 'fail', deletionTest: 'pass' } };
    const exact = hostVerdicts(['sample'], callbacks, audit, 'exact');
    expect(exact['noShardNouns']?.status).toBe('pass');
    expect(exact['dataOnly']?.status).toBe('fail');
    expect(exact['serverSafe']?.status).toBe('fail');
    expect(exact['twoRealUsers']?.status).toBe('pass');
    expect(hostVerdicts(['sample', 'second'], [], audit, 'changed')['twoRealUsers']?.status).toBe('needs-review');
    expect(hostVerdicts(['sample'], [], audit, 'changed')['noShardNouns']?.status).toBe('needs-review');
  } finally { f.close(); }
});
