// oxlint-disable-next-line import/no-nodejs-modules -- Exercise native source recipes without a source-tree publication.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the real author bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

const native = ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs'];

test('source dressing retains every native static and runtime plan value', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { prepareNativeTerrain } from './scripts/bake/nativeWorld.mjs';
    import { installBakeEnvironment } from './scripts/bake/environment.mjs';
    import { MANIFEST } from './src/shards/nalati-grasslands/discovery.generated.ts';
    import { dressingRecipe,dressingPoiColliders } from './src/shards/nalati-grasslands/generators/dressingPlan.ts';
    import { dressingRockColliders } from './src/shards/nalati-grasslands/generators/places.ts';
    import * as layoutSource from './src/shards/nalati-grasslands/generators/layout.ts';
    import * as terrainSource from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    import * as noise from '@wildshard/engine/core/noise';
    import { bakeNalatiDressingSource } from './src/shards/nalati-grasslands/generators/dressingSource.ts';
    import { inSpruceClearing,loneSpruceMask,edgeBermAt,RIVER } from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    import { edgeSpruceMask } from './src/shards/nalati-grasslands/generators/edgeRecipe.ts';
    import { SPRUCE_SPECS } from './src/shards/nalati-grasslands/generators/spruceGeometry.ts';
    import layout from './src/shards/nalati-grasslands/data/grassFieldLayout.json' with {type:'json'};
    import * as field from '@wildshard/engine/world/Heightfield';
    import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { TIER_CONFIG } from '@wildshard/engine/core/tier';
    import { bakeForestPlacements } from '@wildshard/sdk/bake/forest';
    import { bakeMeadowField } from '@wildshard/sdk/bake/meadow';
    import { hashImmutableBytes } from '@wildshard/sdk/immutable';
    const hash=value=>hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value)));
    for(const mask of [undefined,(x,z)=>inSpruceClearing(x,z)?0:Math.max(loneSpruceMask(x,z),edgeSpruceMask(x,z,edgeBermAt(x,z)))]){
      const environment=installBakeEnvironment(process.cwd());
      try{
        const definition=mask===undefined?MANIFEST:{...MANIFEST,forest:{...MANIFEST.forest,mask}};
        await prepareNativeTerrain(definition,{root:process.cwd(),bytes:readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')});
        const meadow=bakeMeadowField({seed:definition.seed,half:250,heightAt:terrainHeight,
          normalAt:field.normalAt,splatAt:field.splatAt,trailDistance:field.trailDistance,
          cabinMask:field.cabinMask,pondMask:field.pondMask,waterLevel:field.waterLevel,
          paint:(x,z,y,slope,out)=>{const paint=definition.groundColor,ground=definition.ground.terrain;
            if(!paint||!ground)return false;paint(x,z,y,slope,ground,out);return true;},
          layout:{...layout,riverZ:RIVER.z,riverHalf:RIVER.half}});
        const forest=bakeForestPlacements({seed:definition.seed,treeCount:definition.treeCount,forest:definition.forest,
          heightAt:field.heightAt,normalAt:field.normalAt,trailDistance:field.trailDistance,cabinMask:field.cabinMask,pondMask:field.pondMask},
          SPRUCE_SPECS.map(row=>({trunkRadius:row.trunk,height:row.height})));
        // Independent predecessor composition reads the original committed POI metadata.
        // Its scatter and place wire oracles also remain in the native construction suite.
        const recipe=dressingRecipe({layout:layoutSource,...terrainSource,...noise,...field,heightAt:terrainHeight,
          grassBaseHeightAt:(x,z)=>meadow.baseHeightAt(x,z),grassToneAt:(x,z)=>meadow.sample(x,z,1),flowerPatchAt:(x,z)=>meadow.sample(x,z,2)});
        const oldPlan=await recipe.planDressing(forest);
        const oldPlaces=JSON.parse(readFileSync('test/fixtures/nalati-places-original.json','utf8')).rows;
        const sequence=JSON.parse(readFileSync('src/shards/nalati-grasslands/data/worldView.json','utf8')).sequence;
        const oldAvoid=[...dressingPoiColliders(oldPlaces,sequence,terrainHeight),...dressingRockColliders(terrainHeight,TIER_CONFIG.maxTexture<=1024,
          {normalAt:field.normalAt,trailDistance:field.trailDistance})];
        const expected={plan:oldPlan,clutter:recipe.campClutterSpots(oldAvoid),trees:forest.trees.length,avoid:oldAvoid.length};
        const before=selectedLevel(),trees=hash(forest.trees),samples=hashImmutableBytes(new Uint8Array(meadow.values.buffer));
        const made=await bakeNalatiDressingSource({heightAt:terrainHeight,normalAt:field.normalAt,trailDistance:field.trailDistance,
          inChunk:field.inChunk,trails:field.TRAILS,meadow,forest,phone:TIER_CONFIG.maxTexture<=1024});
        assert.equal(hash(made),hash(expected));assert.equal(selectedLevel(),before);
        assert.equal(hash(forest.trees),trees);assert.equal(hashImmutableBytes(new Uint8Array(meadow.values.buffer)),samples);
      }finally{environment.dispose();}
    }
  `;
  execFileSync(process.execPath, [...native, '--import', './test/fixtures/authoring-shard.mjs', '--input-type=module', '--eval', source, '--', '--generation-shard=nalati-grasslands']);
});

test('source dressing needs no selected world or installed terrain', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { selectedLevel } from '@wildshard/engine/level/selection';
    import { bakeNalatiDressingSource } from './src/shards/nalati-grasslands/generators/dressingSource.ts';
    import { hashImmutableBytes } from '@wildshard/sdk/immutable';
    assert.equal(selectedLevel(),null);
    const input={heightAt:()=>0,normalAt:()=>[0,1,0],trailDistance:()=>Infinity,
      inChunk:(x,z,margin=0)=>Math.abs(x)<=250-margin&&Math.abs(z)<=250-margin,trails:[],
      meadow:{baseHeightAt:()=>0,sample:()=>0},forest:{trees:[],nearby:()=>[]},phone:true};
    const first=await bakeNalatiDressingSource(input),next=await bakeNalatiDressingSource(input);
    const hash=value=>hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value)));
    assert.equal(hash(first),hash(next));assert.notEqual(first.plan,next.plan);assert.notEqual(first.clutter,next.clutter);
    assert.equal(first.trees,0);assert.ok(first.avoid>0);assert.equal(selectedLevel(),null);
  `;
  execFileSync(process.execPath, [...native, '--input-type=module', '--eval', source]);
});

test('the complete dressing source is one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/dressingSource.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing dressing source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
