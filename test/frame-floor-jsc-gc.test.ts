import {expect, test} from 'vitest';
import {JSC_GC_SETTINGS, prepareJscGcEnvironment} from '../scripts/frame-floor-jsc-gc.mjs';
import {validateFrameFloorArgs} from '../scripts/frame-floor-args.mjs';

function fixture() {
  const values = new Map<string,string>(), calls: string[] = [];
  const port = {
    get: (name: string) => Promise.resolve(values.get(name) ?? ''),
    set: (name: string, value: string) => {calls.push(`set ${name} ${value}`); values.set(name,value); return Promise.resolve();},
    unset: (name: string) => {calls.push(`unset ${name}`); values.delete(name); return Promise.resolve();},
  };
  return {values,calls,port};
}

test('native GC diagnostics set only verbosity/output route and fully unset afterward', async () => {
  expect(JSC_GC_SETTINGS).toEqual({JSC_logGC:'2',JSC_useOSLog:'default'});
  const f=fixture(), stop=await prepareJscGcEnvironment(f.port);
  expect([...f.values]).toEqual([['JSC_logGC','2'],['JSC_useOSLog','default']]);
  await stop();
  expect(f.values.size).toBe(0);
  expect(f.calls).toEqual(['set JSC_logGC 2','set JSC_useOSLog default','unset JSC_useOSLog','unset JSC_logGC']);
});

test('existing foreign launchd setting refuses before changing either option', async () => {
  const f=fixture();f.values.set('JSC_useOSLog','info');
  await expect(prepareJscGcEnvironment(f.port)).rejects.toThrow('Refusing existing');
  expect(f.calls).toEqual([]);expect([...f.values]).toEqual([['JSC_useOSLog','info']]);
});

test('partial setup failure clears both attempted settings and keeps the original failure', async () => {
  const f=fixture(), failure=new Error('set failed');
  const port={...f.port,set:async(name:string,value:string)=>{await f.port.set(name,value);if(name==='JSC_useOSLog')throw failure;}};
  await expect(prepareJscGcEnvironment(port)).rejects.toBe(failure);
  expect(f.values.size).toBe(0);expect(f.calls.slice(-2)).toEqual(['unset JSC_useOSLog','unset JSC_logGC']);
});

test('cleanup attempts every option and refuses a setting that remains', async () => {
  const f=fixture();
  const stop=await prepareJscGcEnvironment({...f.port,unset:name=>{
    if(name==='JSC_useOSLog')return Promise.resolve();
    return f.port.unset(name);
  }});
  await expect(stop()).rejects.toThrow('JSC_useOSLog');
  expect(f.values.has('JSC_logGC')).toBe(false);
});

test('native logging permits only a Simulator grid visit with no other recorders', () => {
  const args=['--surface=sim','--shards=grid','--grid-scenario=all','--jsc-gc-log=tmp/native','--quiet'];
  expect(()=>validateFrameFloorArgs(args)).not.toThrow();
  for(const extra of ['--webkit-timeline=tmp/timeline','--safari-profile=tmp/profile','--native-pressure=tmp/pressure','--buffer-ablation','--gl-time'])
    expect(()=>validateFrameFloorArgs([...args,extra])).toThrow('Native JSC');
  expect(()=>validateFrameFloorArgs(args.filter(arg=>arg!=='--surface=sim'))).toThrow();
  expect(()=>validateFrameFloorArgs([...args,'--jsc-gc-log=tmp/second'])).toThrow('Native JSC');
});

test('missing launchd readback refuses and clears the attempted setting', async () => {
  const f=fixture();
  await expect(prepareJscGcEnvironment({...f.port,set:()=>Promise.resolve()})).rejects.toThrow('not retained');
  expect(f.calls).toEqual(['unset JSC_logGC']);
  expect(f.values.size).toBe(0);
});
