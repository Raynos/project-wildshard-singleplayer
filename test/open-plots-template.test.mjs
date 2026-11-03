import {beforeEach,afterEach,expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise this source generator in owned temporary fixtures.
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,copyFileSync,rmSync,existsSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the source generator's owned temporary fixtures.
import {dirname,resolve} from 'node:path';
import {plotTemplate,writeTemplate,DOME_NAMES} from '../scripts/open-plots/template.mjs';
import {parseDomeCameras} from '../scripts/dome-cameras.mjs';
import {plotForLayout,plotBuilders} from '../src/shards/open-plots/generators/tiledPlot.mjs';

let root,recipe;
const read=file=>JSON.parse(readFileSync(resolve(root,file),'utf8'));
const write=(file,value)=>{const path=resolve(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,`${JSON.stringify(value,null,2)}\n`);};
beforeEach(()=>{
 mkdirSync('tmp',{recursive:true});root=mkdtempSync(resolve('tmp/open-plot-template-test-'));
 const reference='art/test/template-reference.svg';
 for(const file of ['.gitignore','src/shards/open-plots/outputs.json','src/game/grid/singleplayer.json','src/shards/open-plots/data/map.json','src/shards/open-plots/data/source.json','src/shards/open-plots/data/layouts/night-market.json','scripts/source-generation-outputs.json','scripts/test-products.json','lint/tile-bake-debt.json','lint/custom-sections.json']){
  const target=resolve(root,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(file,target);
 }
 // CI intentionally excludes repository art. Own a real reference image and use the maintained exact camera fixtures.
 const image=resolve(root,reference);mkdirSync(dirname(image),{recursive:true});
 writeFileSync(image,'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="#987" d="M0 0h2v2H0z"/></svg>');
 for(const dome of DOME_NAMES){
  const target=resolve(root,`art/grid/round-63-night-market-domes/${dome}/cameras.json`);
  mkdirSync(dirname(target),{recursive:true});copyFileSync(`test/fixtures/night-market-domes/${dome}.json`,target);
 }
 const grid=read('src/game/grid/singleplayer.json');for(const row of grid.grid.cells)if(row.slug==='open-plot-showcase-template')row.slug='open-plot-test-template';
 for(const row of grid.placements)if(row.slug==='open-plot-showcase-template')row.slug='open-plot-test-template';write('src/game/grid/singleplayer.json',grid);
 const declared=read('src/shards/open-plots/outputs.json'),row=declared.outputs.find(value=>value.slug==='open-plot-showcase-template');if(row===undefined)throw new Error('Missing fixture seed');
 row.slug='open-plot-test-template';row.idea='test-template';delete row.layout;delete row.scaffold;write('src/shards/open-plots/outputs.json',declared);
 recipe={slug:row.slug,name:'Test Template',accent:'tangerine',plot:'scaffold',reference,palette:read('src/shards/open-plots/data/layouts/night-market.json').palette,kit:['trees','props','lanterns']};
});
afterEach(()=>{rmSync(root,{recursive:true,force:true});});

test('creates deterministic building data and all8x9 admitted cameras without activating an existing product',()=>{
 const old=readFileSync(resolve(root,'src/shards/open-plots/outputs.json'),'utf8'),a=plotTemplate(root,recipe),b=plotTemplate(root,recipe);
 expect([...a.paths]).toEqual([...b.paths]);expect(a.activated).toBe(false);expect(a.paths.has('src/shards/open-plots/outputs.json')).toBe(false);
 expect(JSON.parse(a.paths.get(a.layout)).landmark).toBeNull();expect(JSON.parse(a.paths.get(a.layout)).posters).toBeNull();
 const cameras=[...a.paths].filter(([name])=>name.endsWith('/cameras.json'));expect(cameras).toHaveLength(8);
 for(const [path,text]of cameras){
  const row=parseDomeCameras(JSON.parse(text)),dome=path.split('/').at(-2),source=read(`art/grid/round-63-night-market-domes/${dome}/cameras.json`);
  expect(row.views).toHaveLength(9);expect(row.convention).toMatch(/^TEMPLATE/);
  for(const key of ['views','anchor','type','pair','dome'])expect(row[key]).toEqual(source[key]);
 }
 writeTemplate(root,a.paths,a.before);expect(readFileSync(resolve(root,'src/shards/open-plots/outputs.json'),'utf8')).toBe(old);
 expect([...plotTemplate(root,recipe).paths]).toEqual([...a.paths]);
});

test('an explicit activation selects only the requested declared output',()=>{
 const before=read('src/shards/open-plots/outputs.json'),proposal=plotTemplate(root,recipe,{activateExisting:true});
 const after=JSON.parse(proposal.paths.get('src/shards/open-plots/outputs.json'));
 expect(after.outputs.filter(row=>row.slug!==recipe.slug)).toEqual(before.outputs.filter(row=>row.slug!==recipe.slug));
 expect(after.outputs.find(row=>row.slug===recipe.slug)).toMatchObject({layout:'test-template',scaffold:true});expect(proposal.activated).toBe(true);
});

test('refuses to overwrite a hand-edited generated layout',()=>{
 const a=plotTemplate(root,recipe);writeTemplate(root,a.paths,a.before);const changed=read(a.layout);changed.rows[0]='E0 E0 E0 E0 E0 E0 E0 E0';write(a.layout,changed);
 expect(()=>plotTemplate(root,recipe)).toThrow('edited template layout');expect(read(a.layout)).toEqual(changed);
});

test('refuses hand-authored layouts before writing',()=>{
 write('src/shards/open-plots/data/layouts/test-template.json',{rows:[],palette:{}});
 expect(()=>plotTemplate(root,recipe)).toThrow('hand-authored layout');
});

test('a concurrent source edit refuses all publication and retains the edit',()=>{
 const a=plotTemplate(root,recipe),path='src/shards/open-plots/outputs.json',changed={...read(path),why:'foreign edit'};write(path,changed);
 expect(()=>writeTemplate(root,a.paths,a.before)).toThrow('source changed');expect(read(path)).toEqual(changed);expect(existsSync(resolve(root,a.layout))).toBe(false);
});

for(const [name,edit]of [
 ['unknown accent',r=>({...r,accent:'cyan'})],['bad palette',r=>({...r,palette:{...r.palette,paving:'bad'}})],
 ['missing palette',r=>({...r,palette:{}})],['unknown builder',r=>({...r,plot:'unknown'})],
 ['bad rows',r=>({...r,rows:Array.from({length:8},()=> 'Z0 Z0 Z0 Z0 Z0 Z0 Z0 Z0')})],
 ['another cell',r=>({...r,cell:[0,0]})],['reference escape',r=>({...r,reference:'art/../../package.json'})],
 ['missing reference',r=>({...r,reference:'art/test/absent.svg'})],
])test(`refuses ${name} without writing any source`,()=>{
 expect(()=>plotTemplate(root,edit(recipe))).toThrow();expect(existsSync(resolve(root,'src/shards/open-plots/data/layouts/test-template.json'))).toBe(false);
});

test('a new idea cannot silently replace an already unique plot',()=>{
 expect(()=>plotTemplate(root,{...recipe,slug:'open-plot-new-idea',cell:[0,2]})).toThrow('planned repeated cell');
});

test('an explicitly named new-idea swap writes complete declarations and keeps 25 unique cells',()=>{
 const grid=read('src/game/grid/singleplayer.json'),cell=grid.grid.cells.find(row=>row.slug.startsWith('open-plot-'));
 if(cell===undefined)throw new Error('Missing plot fixture');
 const proposal=plotTemplate(root,{...recipe,slug:'open-plot-new-idea',cell:cell.cell,replaces:cell.slug});
 expect(proposal.activated).toBe(true);
 const after=JSON.parse(proposal.paths.get('src/game/grid/singleplayer.json'));
 expect(new Set(after.grid.cells.map(row=>row.slug)).size).toBe(25);
 expect(after.grid.cells.find(row=>row.instance===cell.instance).slug).toBe('open-plot-new-idea');
 expect(proposal.paths.has('scripts/source-generation-outputs.json')).toBe(true);
 const declared=JSON.parse(proposal.paths.get('scripts/source-generation-outputs.json')).producers['scripts/gen-shards.mjs'];
 expect(declared).toContain('out/.app/discovery.open-plots.open-plot-new-idea.generated.ts');
 expect(declared).not.toContain('src/shards/open-plots/discovery.open-plot-new-idea.generated.ts');
 expect(proposal.paths.has('.gitignore')).toBe(false);
 expect(proposal.paths.has('lint/tile-bake-debt.json')).toBe(true);
 expect(proposal.paths.has('lint/custom-sections.json')).toBe(true);
 expect(()=>plotTemplate(root,{...recipe,slug:'open-plot-new-idea',cell:cell.cell,replaces:'open-plot-wrong'})).toThrow('replacement does not match');
});

test('dispatch preserves the old default and refuses unknown or incomplete production layouts',()=>{
 expect(plotForLayout({})).toBe(plotBuilders['night-market']);
 expect(plotForLayout({plot:'lantern-bayou'})).toBe(plotBuilders['lantern-bayou']);
 expect(()=>plotForLayout({plot:'toString'})).toThrow('unknown');
 expect(()=>plotForLayout({plot:'missing'})).toThrow('unknown');
 expect(()=>plotForLayout({posters:null})).toThrow('only scaffolds');
 expect(plotForLayout({plot:'scaffold',landmark:null,posters:null},true)).toBe(plotBuilders.scaffold);
});

test('Frostline accepts three-coordinate towers and explicit positive sheave heights only',()=>{
 const layout=towers=>({plot:'frostline-peaks',landmark:{lift:{stations:[[0,0,-80],[0,60,0]],towers,chairs:12}}});
 expect(plotForLayout(layout([[0,20,-50],[21,38.8,0,22]]))).toBe(plotBuilders['frostline-peaks']);
 for(const towers of [[[1,2]],[[1,2,3,4,5]],[[1,2,3,0]],[[1,2,3,-1]],[[1,2,Number.NaN]]])expect(()=>plotForLayout(layout(towers))).toThrow('invalid lift');
});
