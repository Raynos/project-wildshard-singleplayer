// G391: inventory the declarations read by Model/Set/World explorers without booting a world or renderer.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';
import { componentMarkdown } from './shard-components.mjs';
import { auditAuthoringInputs } from './authoring-inputs.mjs';
import { discoverGeneration } from './generate.mjs';

export const GENERATOR_INVENTORY = 'docs/plans/shard-platform/generator-inventory.md';
const OWNERS = { 'driftwood-isle':'sp-x1','pine-hollow':'sp-x4','nalati-grasslands':'sp-x5','nine-dragon-stack':'sp-x8' };
const UNKNOWN = Symbol('unresolved source value');
const unwrap = node => ['TSAsExpression','TSSatisfiesExpression','TSNonNullExpression','ParenthesizedExpression'].includes(node?.type) ? unwrap(node.expression) : node;
const children = node => Object.values(node).flatMap(value => Array.isArray(value) ? value.filter(item => item?.type) : value?.type ? [value] : []);
function walk(node, visit) { if (!node?.type) return; visit(node); for (const child of children(node)) walk(child, visit); }
const key = node => node?.name ?? node?.value;
const text = value => typeof value === 'string' ? value : null;

/** Only literal row operations are interpreted. Builders, imports and module side effects never execute. */
function reader(root) {
  const modules = new Map(), evaluating = new Set();
  const load = file => {
    if (modules.has(file)) return modules.get(file);
    if (!existsSync(resolve(root,file))) return null;
    const code=readFileSync(resolve(root,file),'utf8');
    if (file.endsWith('.json')) { const mod={file,code,values:new Map([['default',JSON.parse(code)]]),bindings:new Map(),imports:new Map(),program:null};modules.set(file,mod);return mod; }
    const parsed=parseSync(file,code), mod={file,code,values:new Map(),bindings:new Map(),imports:new Map(),program:parsed.program,comments:parsed.comments};modules.set(file,mod);
    for (const statement of parsed.program.body) {
      const body=statement.declaration ?? statement;
      if(body.type==='VariableDeclaration')for(const row of body.declarations)if(row.id.type==='Identifier')mod.bindings.set(row.id.name,row.init);
      if(body.type==='FunctionDeclaration' && body.id)mod.bindings.set(body.id.name,body);
      if(statement.type==='ExportDefaultDeclaration')mod.bindings.set('default',statement.declaration);
      if(statement.type==='ImportDeclaration' && statement.source.value.startsWith('.')) {
        const stem=relative(root,resolve(root,dirname(file),statement.source.value));
        const target=[stem,`${stem}.ts`,`${stem}.json`,`${stem}/index.ts`].find(path=>existsSync(resolve(root,path)) && !readdirSafe(root,path));
        if(target)for(const specifier of statement.specifiers)mod.imports.set(specifier.local.name,{file:target,name:specifier.type==='ImportDefaultSpecifier'?'default':key(specifier.imported)});
      }
    }
    return mod;
  };
  function binding(name,mod,env){
    if(Object.hasOwn(env,name))return env[name];
    if(mod.values.has(name))return mod.values.get(name);
    const token=`${mod.file}:${name}`;if(evaluating.has(token))return UNKNOWN;evaluating.add(token);
    let value=UNKNOWN;
    try { const imported=mod.imports.get(name); if(imported){const target=load(imported.file);if(target)value=binding(imported.name,target,{});}
      else if(mod.bindings.has(name))value=valueOf(mod.bindings.get(name),mod,env);
      mod.values.set(name,value);return value;
    } finally {evaluating.delete(token);}
  };
  function valueOf(input,mod,env={}){
    const node=unwrap(input);if(!node)return UNKNOWN;
    if(node.type==='Literal')return node.value;
    if(node.type==='Identifier')return node.name==='undefined'?undefined:binding(node.name,mod,env);
    if(['ArrowFunctionExpression','FunctionExpression','FunctionDeclaration'].includes(node.type))return {fn:node,mod,env};
    if(node.type==='ObjectExpression'){
      const row={};for(const p of node.properties){if(p.type==='SpreadElement'){const extra=valueOf(p.argument,mod,env);if(extra!==UNKNOWN && extra!==null && typeof extra==='object')Object.assign(row,extra);}else row[key(p.key)]=valueOf(p.value,mod,env);}return row;
    }
    if(node.type==='ArrayExpression')return node.elements.flatMap(p=>{if(p?.type==='SpreadElement'){const extra=valueOf(p.argument,mod,env);return Array.isArray(extra)?extra:[];}return [valueOf(p,mod,env)];});
    if(node.type==='MemberExpression'){
      const object=valueOf(node.object,mod,env), name=node.computed?valueOf(node.property,mod,env):key(node.property);
      if(object===UNKNOWN || object===null)return UNKNOWN;return object[name] ?? UNKNOWN;
    }
    if(node.type==='TemplateLiteral'){let out='';for(let i=0;i<node.quasis.length;i++){out+=node.quasis[i].value.cooked;const expression=node.expressions[i];if(expression){const part=valueOf(expression,mod,env);if(part===UNKNOWN)return UNKNOWN;out+=String(part);}}return out;}
    if(node.type==='UnaryExpression' && node.operator==='-'){const arg=valueOf(node.argument,mod,env);return typeof arg==='number'?-arg:UNKNOWN;}
    if(node.type==='ConditionalExpression'){const test=valueOf(node.test,mod,env);return test===UNKNOWN?UNKNOWN:valueOf(test?node.consequent:node.alternate,mod,env);}
    if(node.type==='BinaryExpression' && ['===','!=='].includes(node.operator)){const a=valueOf(node.left,mod,env),b=valueOf(node.right,mod,env);return a===UNKNOWN||b===UNKNOWN?UNKNOWN:node.operator==='==='?a===b:a!==b;}
    if(node.type==='BinaryExpression' && node.operator==='+'){const a=valueOf(node.left,mod,env),b=valueOf(node.right,mod,env);return a===UNKNOWN||b===UNKNOWN?UNKNOWN:a+b;}
    if(node.type==='CallExpression'){
      const args=node.arguments.map(arg=>valueOf(arg,mod,env)),callee=unwrap(node.callee);
      if(callee?.type==='Identifier' && callee.name==='defineModel')return args[0];
      if(callee?.type==='Identifier' && callee.name==='String')return args[0]===UNKNOWN?UNKNOWN:String(args[0]);
      if(callee?.type==='MemberExpression') {
        const object=valueOf(callee.object,mod,env), name=key(callee.property);
        if(Array.isArray(object) && ['map','flatMap'].includes(name) && args[0]?.fn) {const out=object.map((row,index)=>invoke(args[0],[row,index]));return name==='flatMap'?out.flat():out;}
        if(typeof object==='string' && !args.includes(UNKNOWN)) {
          if(name==='toLowerCase')return object.toLowerCase();if(name==='toUpperCase')return object.toUpperCase();
          if(name==='charAt')return object.charAt(args[0]);if(name==='slice')return object.slice(...args);if(name==='replaceAll')return object.replaceAll(...args);
        }
      }
      const fn=valueOf(callee,mod,env);if(fn?.fn)return invoke(fn,args);
      // Wrappers such as bakedPainted keep the registry declaration as their first argument.
      if(args[0]!==UNKNOWN && args[0]!==null && typeof args[0]==='object' && !Array.isArray(args[0]) && text(args[0].id))return args[0];
    }
    return UNKNOWN;
  };
  function invoke(call,args){
    const env={...call.env};call.fn.params.forEach((param,i)=>{if(param.type==='Identifier')env[param.name]=args[i];else if(param.type==='ObjectPattern')for(const p of param.properties)if(p.value?.name)env[p.value.name]=args[i]?.[key(p.key)];});
    if(call.fn.body.type!=='BlockStatement')return valueOf(call.fn.body,call.mod,env);
    for(const statement of call.fn.body.body){if(statement.type==='VariableDeclaration')for(const row of statement.declarations)if(row.id.type==='Identifier')env[row.id.name]=valueOf(row.init,call.mod,env);if(statement.type==='ReturnStatement')return valueOf(statement.argument,call.mod,env);}return UNKNOWN;
  };
  return {load,valueOf};
}
function readdirSafe(root,file){try{return readdirSync(resolve(root,file)).length>=0;}catch{return false;}}
function sourceFiles(root,folder) {
  if(!existsSync(resolve(root,folder)))return [];
  return readdirSync(resolve(root,folder),{withFileTypes:true}).flatMap(entry=>entry.isDirectory() && entry.name!=='node_modules'?sourceFiles(root,`${folder}/${entry.name}`):entry.isFile()&&entry.name.endsWith('.ts')&&!entry.name.endsWith('.d.ts')?[`${folder}/${entry.name}`]:[]).sort((a,b)=>a<b?-1:a>b?1:0);
}
function sourceLines(mod) {
  if(!mod || mod.file.endsWith('.json'))return 0;
  let value='',at=0;for(const comment of mod.comments){value+=mod.code.slice(at,comment.start)+mod.code.slice(comment.start,comment.end).replaceAll(/[^\n]/gu,' ');at=comment.end;}
  return (value+mod.code.slice(at)).split('\n').filter(line=>line.trim()).length;
}

/** Registry definitions are entry families, not the number of placed copies. No frozen registry supplies primary entries.
 * @param {string} root @returns {import('./generator-inventory.mjs').GeneratorInventory} */
export function generatorInventory(root) {
  const read=reader(root), jobs=discoverGeneration(root).jobs, rows=[], gaps=[];
  const slugs=readdirSync(resolve(root,'src/shards'),{withFileTypes:true}).filter(row=>row.isDirectory()&&!row.name.endsWith('-legacy')).map(row=>row.name).sort((a,b)=>a<b?-1:a>b?1:0);
  const audits=new Map();
  const add=(slug,explorer,id,name,declaredSource,registry)=>{
    let source=declaredSource;
    if(!id || !source)return;
    const sourceModule=read.load(source);if(!sourceModule){gaps.push(`${slug}/${explorer}/${id}: missing declared source ${source}`);source=registry;}
    let status='legacy three.js builder';
    const candidates=jobs.filter(job=>job.shard===slug && job.inputRoots.some(path=>source===path||source.startsWith(`${path}/`)));
    for(const job of candidates){
      if(!audits.has(job.id))audits.set(job.id,auditAuthoringInputs(root,slug,job.entry));
      const audit=audits.get(job.id);
      if(audit.issues.length===0 && source.startsWith(`src/shards/${slug}/generators/`)){status='generator in shard folder';break;}
      if(audit.files.includes(source) && audit.issues.length>0)status='runtime-in-Node bake';
    }
    const row={shard:slug,explorer,id,name:name ?? id,source,lines:sourceLines(read.load(source)),status,owner:OWNERS[slug]??'',registry};
    if(!rows.some(previous=>previous.shard===slug&&previous.explorer===explorer&&previous.id===id))rows.push(row);
  };
  for(const slug of slugs)for(const file of sourceFiles(root,`src/shards/${slug}`)){
    const mod=read.load(file);if(!mod?.program)continue;
    walk(mod.program,node=>{
      if(node.type==='CallExpression' && file.includes('/models/')){
        const value=read.valueOf(node,mod), entries=Array.isArray(value)?value.flat():[value];
        for(const row of entries)if(text(row?.id)?.startsWith(`${slug}/`))add(slug,'Model',row.id,text(row.name),text(row.file)??file,file);
      }
      // Set rows are the very place literals consumed by placeSet and its loop tables.
      if(node.type==='ObjectExpression'){
        const place=node.properties.find(p=>key(p.key)==='place');
        if(place){const row=read.valueOf(node,mod);if(text(row.place)?.startsWith(`${slug}/`))add(slug,'Set',text(row.id)??row.place,text(row.name),text(row.file)??file,file);}
      }
      if(node.type==='Property' && key(node.key)==='pois' && file.endsWith('/manifest.ts')) {
        const list=read.valueOf(node.value,mod);if(Array.isArray(list)){for(const row of list)if(text(row?.id))add(slug,'World',row.id,text(row.name)??text(row.label),file,file);}
        else gaps.push(`${slug}/World: unresolved manifest pois in ${file}`);
      }
      // Data-owned world pieces are the world registry's named static entry list.
      if(node.type==='VariableDeclarator' && /(?:^|_)PIECES$/u.test(node.id?.name??'')){
        const list=read.valueOf(node.init,mod);if(Array.isArray(list))for(const row of list)if(text(row?.id))add(slug,'World',row.id,text(row.name),text(row.file)??file,file);
      }
    });
  }
  rows.sort((a,b)=>[a.shard,a.explorer,a.id].join('\0').localeCompare([b.shard,b.explorer,b.id].join('\0')));
  const totals=slugs.map(shard=>{
    const entries=rows.filter(row=>row.shard===shard),ported=entries.filter(row=>row.status==='generator in shard folder'),left=entries.filter(row=>row.status!=='generator in shard folder');
    const uniqueLines=list=>[...new Map(list.map(row=>[row.source,row.lines])).values()].reduce((sum,n)=>sum+n,0);
    return {shard,ported:ported.length,left:left.length,portedLines:uniqueLines(ported),leftLines:uniqueLines(left),explorers:Object.fromEntries(['Model','Set','World'].map(explorer=>[explorer,entries.filter(row=>row.explorer===explorer).length]))};
  });
  return {rows,totals,gaps:[...new Set(gaps)].sort((a,b)=>a<b?-1:a>b?1:0)};
}
const cell=value=>String(value).replaceAll('|',String.raw`\|`).replaceAll('\n',' ');
/** @param {string} root @param {Record<string,import('./shard-platform.mjs').ShardLines>} [measures] */
export function writeGeneratorInventory(root, measures = {}) {
  const inventory=generatorInventory(root);
  const lines=['# Explorer generator inventory','','Generated at commit time from the Model definitions, Set place-registration rows,','manifest World POIs and named World-piece registries. Rows count entry families,','not their placed copies. Registry and declared source paths remain auditable.','Only an author-only registered job reading the declared shard generator counts as','ported. Trusted imports in a Node producer remain `runtime-in-Node bake`; moving','a runtime builder or changing a display label never grants a port.','','Lines strip parser-identified comments. Totals count each source file once per','status; entry rows retain that file’s full line count. Frozen registries never','supply primary entries. Unresolved registry expressions are reported below.','','## Totals','','| Shard | Model | Set | World | Ported entries | Left entries | Ported lines | Left lines |','|---|---:|---:|---:|---:|---:|---:|---:|',...inventory.totals.map(row=>`| ${row.shard} | ${row.explorers.Model} | ${row.explorers.Set} | ${row.explorers.World} | ${row.ported} | ${row.left} | ${row.portedLines} | ${row.leftLines} |`),'','## Entries','','| Shard | Explorer | Entry name | Source file | Lines | Status | Owner lane |','|---|---|---|---|---:|---|---|',...inventory.rows.map(row=>`| ${[row.shard,row.explorer,`${row.name} (${row.id})`,row.source,row.lines,row.status,row.owner].map(cell).join(' | ')} |`),'','## Unresolved declarations','',...(inventory.gaps.length > 0?inventory.gaps.map(gap=>`- ${gap}`):['None.']),''];
  lines.push(...componentMarkdown(measures), '');
  const path=resolve(root,GENERATOR_INVENTORY);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,lines.join('\n'));return inventory;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const root=resolve(import.meta.dirname,'..');const measures=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',"import{shardLines}from './scripts/shard-platform.mjs';console.log(JSON.stringify(shardLines()));"],{cwd:root,encoding:'utf8'}));const report=writeGeneratorInventory(root,measures);console.log(JSON.stringify(report.totals));}
