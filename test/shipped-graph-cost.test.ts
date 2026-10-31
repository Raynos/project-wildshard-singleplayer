import {afterAll,expect,test} from 'vitest';
import {manifestFolders,shardProducts} from '../scripts/shard-outputs.mjs';
import {legacyInventory} from '../scripts/legacy-shards.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same buildable-folder rule as the normal product writer.
import {existsSync} from 'node:fs';
import {builtProduct} from './fixtures/builtProduct';
import {shippedGraphCosts,type ShippedGraphCost} from './fixtures/shipped-graph-costs';

const frozen=legacyInventory(process.cwd());
const folders=manifestFolders(process.cwd()).filter(folder=>!Object.hasOwn(frozen.shards,folder)&&existsSync(`src/shards/${folder}/shard.config.ts`));
const products=shardProducts(process.cwd(),folders),reports:ShippedGraphCost[]=[];
for(const {slug} of products)test(`emitted shader work for every admitted graph in ${slug}`,async()=>{
 const rows=await shippedGraphCosts(builtProduct(slug));
 expect(new Set(rows.map(row=>row.graphHash)).size).toBe(rows.length);
 for(const row of rows){
  expect(row.slug).toBe(slug);expect(row.aliases.length).toBeGreaterThan(0);
  for(const program of Object.values(row.execution))if(program!==null)for(const stage of Object.values(program))for(const value of Object.values(stage)){
   expect(Number.isSafeInteger(value)).toBe(true);expect(value).toBeGreaterThanOrEqual(0);
  }
 }
 reports.push(...rows);
 console.info(JSON.stringify({g3:'shipped-graph-cost',slug,graphs:rows}));
});
afterAll(()=>{
 const top=reports.filter(row=>row.execution.main!==null).map(row=>({slug:row.slug,graphHash:row.graphHash,aliases:row.aliases,fragment:row.execution.main?.fragment,lighting:{sun:row.execution.main?.sun,ambient:row.execution.main?.ambient,grade:row.execution.main?.grade}}))
  .sort((a,b)=>(b.fragment?.unconditional??0)-(a.fragment?.unconditional??0)).slice(0,10);
 console.info(JSON.stringify({g3:'static-top-ten',products:products.map(row=>row.slug),graphs:reports.length,ranking:'unconditional fragment-main estimates per invocation; not pixel-weighted',pixelCoverage:'not supplied: G1 measured draw coverage is required',top}));
});
