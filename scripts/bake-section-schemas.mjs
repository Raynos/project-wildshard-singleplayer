// Build-only registries produce validators, wire schemas and standalone types.
// Runtime readers import only the generated declarations; schemas never ship.
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseSync} from 'vite';
import {sectionType} from './section-types.mjs';
import {formatJsonSchema} from '../src/sdk/formatJsonSchema.ts';

/** @param {unknown} input @returns {input is import('valibot').GenericSchema} */
function syncSchema(input) {
  return typeof input==='object'&&input!==null&&'kind' in input&&input.kind==='schema'
    &&'type' in input&&typeof input.type==='string'&&'reference' in input&&typeof input.reference==='function'
    &&'expects' in input&&typeof input.expects==='string'&&'async' in input&&input.async===false
    &&'~run' in input&&typeof input['~run']==='function';
}
/** Remove only documented structural annotations. Defining checks still run in
 * the copied producer validator and client. Unknown checks/transforms refuse.
 * @param {unknown} value @returns {unknown} */
function structural(value) {
  if(Array.isArray(value))return value.map(structural);
  if(typeof value!=='object'||value===null)return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='x-wildshard-checks'&&key!=='x-wildshard-string-length')
    .map(([key,child])=>[key,structural(child)]));
}
/** Copy only schema-registry source with closed public schema imports. Runtime
 * entry modules and services cannot enter this build bridge.
 * @param {string} root @param {string} slug */
export async function writeSectionSchemaBridge(root,slug) {
  if(!/^[a-z0-9_-]+$/u.test(slug))throw new Error('Invalid section schema shard');
  const sourcePath=resolve(root,'src/shards',slug,'generators/sections.ts');
  const source=readFileSync(sourcePath,'utf8'),tree=parseSync(sourcePath,source).program;
  const published=JSON.parse(readFileSync(resolve(root,'src/format/package.json'),'utf8')).exports;
  const visit=node=>{
    if(node===null||typeof node!=='object')return;
    if(node.type==='ImportExpression'||node.type==='TSImportEqualsDeclaration')throw new Error('Schema registry cannot dynamically import code');
    if((node.type==='ExportNamedDeclaration'||node.type==='ExportAllDeclaration')&&node.source!==null&&node.source!==undefined)throw new Error('Schema registry cannot re-export dependencies');
    if(node.type==='ImportDeclaration') {
      const spec=node.source.value;
      if(typeof spec!=='string'||spec!=='valibot'&&!(spec.startsWith('@wildshard/format/')&&Object.hasOwn(published,`./${spec.slice('@wildshard/format/'.length)}`)))throw new Error('Schema registry imports only valibot and public format schemas');
    }
    for(const child of Object.values(node)) {
      if(Array.isArray(child))for(const item of child)visit(item);
      else if(typeof child==='object')visit(child);
    }
  };
  visit(tree);
  const hash=createHash('sha256').update(source).digest('hex');
  const destination=resolve(root,'src/shards',slug,'generators/sectionSchemas.generated.ts');
  const header=`// DO NOT EDIT: scripts/bake-section-schemas.mjs; generators/sections.ts sha256:${hash}\n`;
  mkdirSync(dirname(destination),{recursive:true});
  writeFileSync(destination,header+source);
  // Evaluate the copied validator, not a runtime/ import. The generation backend
  // publishes nothing until all schemas convert and every output is verified.
  const namespace=await import(`${pathToFileURL(destination).href}?source=${hash}`);
  const registry=namespace.SECTIONS;
  if(typeof registry!=='object'||registry===null||Array.isArray(registry))throw new Error('Schema registry requires SECTIONS');
  const schemas={};
  for(const [name,schema] of Object.entries(registry)) {
    if(!/^custom\/[a-zA-Z][a-zA-Z0-9_-]{0,63}$/u.test(name)||!syncSchema(schema))throw new Error(`Invalid custom section schema: ${name}`);
    schemas[name]=structural(formatJsonSchema(schema,'draft-07'));
  }
  const generated=`${header}${source}\nimport type {DefinedSection} from '@wildshard/sdk/sections';\nexport const WIRE_SCHEMAS: Readonly<Record<string,DefinedSection['jsonSchema']>> = ${JSON.stringify(schemas)};\n`;
  writeFileSync(destination,generated);
  const typesPath=resolve(root,'src/shards',slug,'runtime/productSections.generated.d.ts');
  const declarations=Object.entries(namespace).filter(([name,schema])=>name.endsWith('Schema')&&syncSchema(schema))
    .map(([name,schema])=>`export type ${name.slice(0,-6)} = ${sectionType(structural(formatJsonSchema(schema,'draft-07')))};`);
  mkdirSync(dirname(typesPath),{recursive:true});
  writeFileSync(typesPath,`${header}export interface CustomSections {\n${Object.entries(schemas).map(([name,schema])=>`  ${JSON.stringify(name)}: ${sectionType(schema)};`).join('\n')}\n}\n${declarations.join('\n')}\n`);
  return {path:destination,sourceHash:hash,schemas:Object.keys(schemas).length,bytes:Buffer.byteLength(generated)};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) {
  const slug=process.argv.at(2);if(slug===undefined)throw new Error('Expected one shard slug');
  console.log(JSON.stringify(await writeSectionSchemaBridge(resolve(import.meta.dirname,'..'),slug)));
}
