import {expect,test} from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the complete original document bytes.
import {createHash} from 'node:crypto';
import {FixedGeometryGroupsSchema as Root} from '../src/format/islandLibrary';
import {platformFileFamily,validatePlatformFile} from '../src/format/platformFileFamilies';
import {registeredJsonSchema} from '../src/sdk/formatJsonSchema';
import {parseSectionValue} from '../src/sdk/sections';
import {FixedGeometryGroupsSchema as AuthorRoot} from '../src/shards/driftwood-isle/generators/sections';
import roots from './fixtures/approved-geometry-groups.json' with {type:'json'};

const name='models/fixed-geometry.json',source='@wildshard/format/islandLibrary#FixedGeometryGroupsSchema';
test('the complete geometry group root retains its author value and original body',()=>{
 const fixture=roots[name],input:unknown=JSON.parse(fixture.body),before=JSON.stringify(input);
 expect(createHash('sha256').update(fixture.body).digest('hex')).toBe(fixture.sha256);
 expect(v.parse(Root,input)).toEqual(input);
 expect(parseSectionValue(AuthorRoot,input)).toEqual(input);
 expect(validatePlatformFile(name,source,input)?.schema).toBe(Root);
 expect(registeredJsonSchema(name)['$comment']).toBe(source);
 expect(platformFileFamily(name,undefined)).toBeUndefined();
 expect(platformFileFamily(name,`${source}Other`)).toBeUndefined();
 expect(platformFileFamily(`private/${name}`,source)).toBeUndefined();
 expect(JSON.stringify(input)).toBe(before);
});
test('geometry groups refuse missing, foreign and invalid nullable bindings',()=>{
 const row=v.parse(Root,JSON.parse(roots[name].body));
 for(const input of [{...row,foreign:true},{...row,npc:{...row.npc,trader:{...row.npc.trader,fore:undefined}}},
  {...row,piers:{broken:{deck:'deck',cloth:5}}}])expect(()=>validatePlatformFile(name,source,input)).toThrow();
});
