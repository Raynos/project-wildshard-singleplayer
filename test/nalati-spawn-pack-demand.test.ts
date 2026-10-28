import {expect,test} from 'vitest';
import observed from '../src/shards/nalati-grasslands/data/spawnPackDemand.json' with {type:'json'};
import {nalatiSpawnPackLateNames} from '../src/shards/nalati-grasslands/generators/spawnPackDemand';

const files=observed.groups.flatMap(group=>group.members.map(row=>({hash:row.hash,compressed:row.bytes,critical:false,...row.name===null?{}:{name:row.name}})));
const spruce=(()=>{const file=files.find(row=>row.name==='models/trees/spruce.glb');
  if(file===undefined)throw new Error('Missing measured spruce member');return file;})();

function syntheticUnread(){
  return {...observed,demanded:observed.demanded.filter(row=>row.hash!==spruce.hash),
    groups:observed.groups.map(group=>({...group,members:group.members.map(row=>row.hash===spruce.hash
      ?{...row,phase:'unread',firstReadMs:null,paths:[]}:row)}))};
}

test('the complete asynchronous, cached and URL journal keeps all 83 actually read members eager',()=>{
  expect(observed.groups.map(group=>group.members.length).sort((a,b)=>a-b)).toEqual([9,13,61]);
  expect(observed.source.consumerReadCalls).toBe(291);expect(observed.source.retainedReadCalls).toBe(104);
  expect(observed.demanded).toHaveLength(280);
  expect(observed.groups.flatMap(group=>group.members).filter(row=>row.phase==='unread').map(row=>[row.name,row.bytes])).toEqual([]);
  const before=structuredClone({files,observed});expect(nalatiSpawnPackLateNames(files)).toEqual([]);
  expect(observed.directMemberReads.map(row=>[row.hash,row.encodedBytes])).toEqual([[spruce.hash,119515]]);
  expect({files,observed}).toEqual(before);
});

test('a truly unread synthetic member uses the existing deferred phase without mutating its input',()=>{
  const profile=syntheticUnread(),before=structuredClone(profile);
  expect(nalatiSpawnPackLateNames(files,profile)).toEqual(['models/trees/spruce.glb']);expect(profile).toEqual(before);
});

test.each(['critical','revision','size','alias','missing'] as const)('a %s member keeps eager timing instead of inheriting stale measured authority',kind=>{
  const changed=files.filter(file=>file.hash!==spruce.hash);
  if(kind==='critical')changed.push({...spruce,critical:true});
  if(kind==='revision')changed.push({...spruce,hash:'f'.repeat(64)});
  if(kind==='size')changed.push({...spruce,compressed:spruce.compressed+1});
  if(kind==='alias')changed.push(spruce,{...spruce,name:'models/another-reader.glb'});
  expect(nalatiSpawnPackLateNames(changed,syntheticUnread())).toEqual([]);
});

test('a consumed member cannot become deferred by editing only its local phase',()=>{
  const member=observed.groups[0]?.members[0];if(member===undefined)throw new Error('Missing observed consumer');
  const profile={...observed,groups:observed.groups.map(group=>({...group,members:group.members.map(row=>row.hash===member.hash
    ?{...row,phase:'unread',firstReadMs:null,paths:[]}:row)}))};
  expect(()=>nalatiSpawnPackLateNames(files,profile)).toThrow('Unread member has a consumer');
});

test('incomplete windows, duplicate members and inconsistent pack sizes refuse',()=>{
  expect(()=>nalatiSpawnPackLateNames(files,{...observed,window:{...observed.window,playMs:29999}})).toThrow('Incomplete');
  const duplicate=structuredClone(observed),group=duplicate.groups[0],row=group?.members[0];
  if(group===undefined||row===undefined)throw new Error('Missing measured pack');
  group.members.push({...row});group.bytes+=row.bytes;
  expect(()=>nalatiSpawnPackLateNames(files,duplicate)).toThrow('Invalid observed pack member');
  const bad=structuredClone(observed),first=bad.groups[0];if(first===undefined)throw new Error('Missing pack');first.bytes++;
  expect(()=>nalatiSpawnPackLateNames(files,bad)).toThrow('Invalid observed pack inventory');
});
