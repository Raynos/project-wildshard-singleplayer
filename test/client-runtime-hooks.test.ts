import { expect,test,vi } from 'vitest';
import { BufferGeometry,Group,Mesh,MeshBasicMaterial,Object3D,Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { installClientRuntimeHooks } from '../src/game/shardfile/clientRuntimeHooks';
import { lendEntryOwner,publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { legacyDouble } from './fake/FakeGame';

function runtime():ShardRuntime{return {world:null,play:null,step:null,interactables:[],overhead:[],hooks:{},objects:{},viewer:()=>new Vector3(),horizonVeil:null};}
function context(scope:Scope,shell:ShardRuntime):ShardContext{return legacyDouble<ShardContext>({scope,game:legacyDouble<ShardContext['game']>({runtime:shell})});}

test('world hooks borrow the exact floor and groups and restore original values on leave',()=>{
  const scope=new Scope('hooks'),shell=runtime(),original=()=>19,floor=vi.fn(()=>7),group=new Group(),foreign=new Group(),later=new Group();
  shell.hooks.spawnFloor=original;shell.hooks.meleeSilent=false;shell.overhead.push(foreign);
  publishEntryOwner(scope,'floor','pier',floor);publishEntryOwner(scope,'object','flock',group);
  installClientRuntimeHooks(context(scope,shell),{floor:'pier',overhead:['flock'],meleeSilent:true});
  expect(shell.hooks.spawnFloor).toBe(floor);expect(shell.hooks.meleeSilent).toBe(true);expect(floor).not.toHaveBeenCalled();
  expect(shell.overhead).toEqual([foreign,group]);shell.overhead.push(later);
  scope.dispose();expect(shell.hooks.spawnFloor).toBe(original);expect(shell.hooks.meleeSilent).toBe(false);expect(shell.overhead).toEqual([foreign,later]);
  expect(group.parent).toBeNull();
});

test('every loan preflights before any publication, including a late missing or non-group object',()=>{
  const scope=new Scope('preflight'),shell=runtime(),floor=()=>3,group=new Group(),ctx=context(scope,shell);
  publishEntryOwner(scope,'floor','pier',floor);publishEntryOwner(scope,'object','flock',group);publishEntryOwner(scope,'object','wrong',new Object3D());
  try{
    for(const id of ['missing','wrong']){
      expect(()=>installClientRuntimeHooks(ctx,{floor:'pier',overhead:['flock',id],meleeSilent:true})).toThrow();
      expect(shell.hooks).toEqual({});expect(shell.overhead).toEqual([]);
    }
    expect(()=>installClientRuntimeHooks(ctx,{overhead:['flock','flock']})).toThrow('Repeated overhead');
    installClientRuntimeHooks(ctx,{floor:'pier',overhead:['flock']});
    expect(()=>installClientRuntimeHooks(ctx,{overhead:[]})).toThrow('already installed');
  }finally{scope.dispose();}
  expect(shell.hooks).toEqual({});
});

test('nested and out-of-order entries never resurrect ended hooks or remove another overhead borrower',()=>{
  const construction=new Scope('world'),first=construction.child('first'),second=construction.child('second'),shell=runtime(),group=new Group(),floor=()=>4;
  publishEntryOwner(construction,'object','flock',group);publishEntryOwner(construction,'floor','pier',floor);
  for(const scope of [first,second]){
    lendEntryOwner(scope,construction,'object','flock');lendEntryOwner(scope,construction,'floor','pier');
    installClientRuntimeHooks(context(scope,shell),{floor:'pier',overhead:['flock'],meleeSilent:scope===first});
  }
  expect(shell.overhead).toEqual([group]);expect(shell.hooks.meleeSilent).toBe(false);
  first.dispose();expect(shell.overhead).toEqual([group]);expect(shell.hooks.spawnFloor).toBe(floor);expect(shell.hooks.meleeSilent).toBe(false);
  second.dispose();expect(shell.overhead).toEqual([]);expect(shell.hooks).toEqual({});expect(construction.disposed).toBe(false);
  construction.dispose();
});

test('pre-existing overhead remains and borrowed geometry is never disposed',()=>{
  const construction=new Scope('world'),entered=construction.child('entered'),shell=runtime(),group=new Group(),dispose=vi.fn(),geometry=new BufferGeometry(),material=new MeshBasicMaterial();
  geometry.addEventListener('dispose',()=>{dispose();});material.addEventListener('dispose',()=>{dispose();});group.add(new Mesh(geometry,material));
  shell.overhead.push(group);publishEntryOwner(construction,'object','flock',group);lendEntryOwner(entered,construction,'object','flock');
  installClientRuntimeHooks(context(entered,shell),{overhead:['flock']});entered.dispose();
  expect(shell.overhead).toEqual([group]);expect(dispose).not.toHaveBeenCalled();construction.dispose();geometry.dispose();material.dispose();
});

test('retired entered or construction owners refuse without changing the runtime',()=>{
  const construction=new Scope('world'),entered=construction.child('entered'),shell=runtime();
  publishEntryOwner(construction,'object','flock',new Group());lendEntryOwner(entered,construction,'object','flock');construction.dispose();
  expect(()=>installClientRuntimeHooks(context(entered,shell),{overhead:['flock'],meleeSilent:true})).toThrow('living entered');
  expect(shell.hooks).toEqual({});expect(shell.overhead).toEqual([]);
});
