// Build-only registries produce validators, wire schemas and standalone types.
// Runtime readers import only plain committed declarations; schemas never ship.
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseSync} from 'vite';
import {parse as parseValue} from 'valibot';
import {sectionType} from './section-types.mjs';
import {formatJsonSchema} from '../src/sdk/formatJsonSchema.ts';

/** @param {unknown} input @returns {input is import('valibot').GenericSchema} */
function syncSchema(input) {
  return typeof input==='object'&&input!==null&&'kind' in input&&input.kind==='schema'
    &&'type' in input&&typeof input.type==='string'&&'reference' in input&&typeof input.reference==='function'
    &&'expects' in input&&typeof input.expects==='string'&&'async' in input&&input.async===false
    &&'~run' in input&&typeof input['~run']==='function';
}
/** @overload @param {import('../src/sdk/formatJsonSchema').FormatJsonSchema} value @returns {import('../src/sdk/formatJsonSchema').FormatJsonSchema} */
/** @overload @param {unknown} value @returns {unknown} */
/** Remove only documented structural annotations. Defining checks still run in
 * the copied producer validator. Unknown checks/transforms refuse.
 * @param {unknown} value @returns {unknown} */
function structural(value) {
  if(Array.isArray(value))return value.map(structural);
  if(typeof value!=='object'||value===null)return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='x-wildshard-checks'&&key!=='x-wildshard-string-length')
    .map(([key,child])=>[key,structural(child)]));
}
/** Emit ordinary JSON values as lint-clean TypeScript without changing their values.
 * @param {unknown} value @returns {string} */
function schemaLiteral(value) {
  if(typeof value==='string'){
    if(!value.includes(String.fromCodePoint(92)))return JSON.stringify(value);
    if(value.includes('`')||value.includes('${')||value.endsWith(String.fromCodePoint(92)))return `String.fromCodePoint(${Array.from(value,letter=>letter.codePointAt(0)).join(',')})`;
    return `String.raw\`${value}\``;
  }
  if(Array.isArray(value))return `[${value.map(schemaLiteral).join(',')}]`;
  if(typeof value==='object'&&value!==null)return `{${Object.entries(value).filter(([,child])=>child!==undefined).map(([key,child])=>`${key.includes(String.fromCodePoint(92))?`[${schemaLiteral(key)}]`:JSON.stringify(key)}:${schemaLiteral(child)}`).join(',')}}`;
  if(value===null||typeof value==='boolean'||typeof value==='number')return JSON.stringify(value);
  throw new Error('Unsupported schema table literal');
}
/** Copy only schema-registry source with closed public schema imports. Runtime
 * entry modules and services cannot enter this build bridge.
 * @param {string} root @param {string} slug */
export async function sectionSchemaTables(root,slug) {
  if(!/^[a-z0-9_-]+$/u.test(slug))throw new Error('Invalid section schema shard');
  const sourcePath=resolve(root,'src/shards',slug,'generators/sections.ts');
  const source=readFileSync(sourcePath,'utf8'),tree=parseSync(sourcePath,source).program;
  const published=JSON.parse(readFileSync(resolve(root,'src/format/package.json'),'utf8')).exports;
  /** @param {unknown} node */
  const visit=node=>{
    if(node===null||typeof node!=='object')return;
    if(!('type' in node))return;
    if(node.type==='ImportExpression'||node.type==='TSImportEqualsDeclaration')throw new Error('Schema registry cannot dynamically import code');
    if((node.type==='ExportNamedDeclaration'||node.type==='ExportAllDeclaration')&&'source' in node&&node.source!==null&&node.source!==undefined)throw new Error('Schema registry cannot re-export dependencies');
    if(node.type==='ImportDeclaration') {
      if(!('source' in node)||typeof node.source!=='object'||node.source===null||!('value' in node.source))throw new Error('Invalid schema import');
      const spec=node.source.value;
      const authorSelector=spec==='@wildshard/sdk/formatJsonSchema'&&'specifiers' in node&&Array.isArray(node.specifiers)
        &&node.specifiers.length===1&&node.specifiers.every(binding=>binding.type==='ImportSpecifier'&&binding.imported.type==='Identifier'&&binding.imported.name==='authorFormatSchema');
      if(typeof spec!=='string'||spec!=='valibot'&&!authorSelector&&!(spec.startsWith('@wildshard/format/')&&Object.hasOwn(published,`./${spec.slice('@wildshard/format/'.length)}`)))throw new Error('Schema registry imports only valibot and public format schemas or the finite author selector');
    }
    for(const child of Object.values(node)) {
      if(Array.isArray(child))for(const item of child)visit(item);
      else if(typeof child==='object')visit(child);
    }
  };
  visit(tree);
  const hash=createHash('sha256').update(source).digest('hex');
  const destination=resolve(root,'src/shards',slug,'generators/sectionSchemas.ts');
  const header=`// Section schema tables: scripts/bake-section-schemas.mjs; generators/sections.ts sha256:${hash}\n`;
  // The closed registry is the defining source. Compute every table before
  // publication; --check never writes an intermediate validator to disk.
  const namespace=await import(`${pathToFileURL(sourcePath).href}?source=${hash}`);
  const registry=namespace.SECTIONS;
  if(typeof registry!=='object'||registry===null||Array.isArray(registry))throw new Error('Schema registry requires SECTIONS');
  /** @type {Record<string,import('../src/sdk/formatJsonSchema').FormatJsonSchema>} */
  const schemas={};
  for(const [name,schema] of Object.entries(registry)) {
    if(!/^custom\/[a-zA-Z][a-zA-Z0-9_-]{0,63}$/u.test(name)||!syncSchema(schema))throw new Error(`Invalid custom section schema: ${name}`);
    schemas[name]=structural(formatJsonSchema(schema,'draft-07'));
  }
  const generated=`${header}import type {DefinedSection} from '@wildshard/sdk/sections';\n\nexport const WIRE_SCHEMAS: Readonly<Record<string,DefinedSection['jsonSchema']>> = ${schemaLiteral(schemas)};\n`;
  /** @type {Record<string,string>} */
  const tables={[relative(root,destination)]:generated};
  const typesPath=resolve(root,'src/shards',slug,'runtime/productSections.d.ts');
  const typeOptions={records:true};
  const declarations=Object.entries(namespace).filter(([name,schema])=>name.endsWith('Schema')&&syncSchema(schema))
    .map(([name,schema])=>{
      const type=sectionType(structural(formatJsonSchema(schema,'draft-07')),typeOptions),id=name.slice(0,-6);
      return type.startsWith('{ ')&&type.endsWith(' }')?`export interface ${id} ${type}`:`export type ${id} = ${type};`;
    });
  tables[relative(root,typesPath)]=`${header}export interface CustomSections {\n${Object.entries(schemas).map(([name,schema])=>`  ${JSON.stringify(name)}: ${sectionType(schema,typeOptions)};`).join('\n')}\n}\n${declarations.join('\n')}\n`;
  // Validate imported authored JSON without creating companion declarations.
  // Tuple contracts live in the explicit standalone product interfaces.
  const files=namespace.FILE_SCHEMAS;
  if(files!==undefined&&(typeof files!=='object'||files===null||Array.isArray(files)))throw new Error('Typed JSON registry requires FILE_SCHEMAS object');
  for(const [name,schema] of Object.entries(files??{})) {
    if(!/^(?:data|boot)\/[a-zA-Z0-9_-]+(?:\.generated)?\.json$/u.test(name)||!syncSchema(schema))throw new Error(`Invalid typed JSON source: ${name}`);
    const path=resolve(root,'src/shards',slug,name);
    parseValue(schema,JSON.parse(readFileSync(path,'utf8')));
    sectionType(structural(formatJsonSchema(schema,'draft-07')),typeOptions);
  }
  return {tables,report:{path:destination,sourceHash:hash,schemas:Object.keys(schemas).length,bytes:Buffer.byteLength(generated)}};
}
/** Plain committed-table publication; a check compares the complete candidate without any write.
 * @param {string} root @param {string} slug @param {{check?:boolean}} [options] */
export async function writeSectionSchemaTables(root,slug,options={}) {
  const {tables,report}=await sectionSchemaTables(root,slug);
  const changed=Object.entries(tables).filter(([path,text])=>!existsSync(resolve(root,path))||readFileSync(resolve(root,path),'utf8')!==text);
  if(options.check&&changed.length>0)throw new Error(`Stale section schema tables: ${changed.map(([path])=>path).join(', ')}`);
  for(const [path,text]of changed){const file=resolve(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text);}
  return report;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) {
  const slug=process.argv.at(2),args=process.argv.slice(3);
  if(slug===undefined||args.some(arg=>!['--check','--print'].includes(arg))||args.length!==new Set(args).size||args.includes('--check')&&args.includes('--print'))throw new Error('Expected shard slug, optional --check or --print');
  const root=resolve(import.meta.dirname,'..');
  console.log(JSON.stringify(args.includes('--print')?(await sectionSchemaTables(root,slug)).tables:await writeSectionSchemaTables(root,slug,{check:args.includes('--check')})));
}
