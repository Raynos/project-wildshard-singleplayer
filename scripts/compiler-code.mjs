// Compiler execution identity: parse emitted JavaScript, never strip source
// comments with a regular expression. Raw source/content reads use other keys.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
/** @type {typeof import('@typescript/typescript6')|undefined} */
let compiler;
/** Pure content normalization, never an input-validity or admission verdict.
 * @type {Map<string,string>} */
const normalized=new Map();
/** @param {Uint8Array|string} bytes */
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Every caller first validates the current raw digest. The read callback is
 * used only on a normalization miss and must still return those exact bytes.
 * @param {string} file @param {string} rawHash @param {()=>Uint8Array} read */
export function compilerCodeHash(file,rawHash,read) {
  const key=`${file}\0${rawHash}`,cached=normalized.get(key);
  if(cached!==undefined)return cached;
  const bytes=read();
  if(digest(bytes)!==rawHash)throw new Error(`Compiler input changed while normalizing: ${file}`);
  const ts=compiler ??= require('@typescript/typescript6');
  const emitted=ts.transpileModule(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{
    fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,allowJs:true,removeComments:true,
      sourceMap:false,inlineSourceMap:false},
  });
  // Invalid compiler source must never acquire a reusable semantic identity.
  if(emitted.diagnostics?.some(row=>row.category===ts.DiagnosticCategory.Error))throw new Error(`Invalid compiler module: ${file}`);
  const source=ts.createSourceFile('compiler.mjs',emitted.outputText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  /** @type {Array<[number,string]>} */
  const tokens=[];
  /** The parser knows regex/template/string boundaries, including their
   * meaningful internal whitespace; a trivia-skipping scanner alone does not.
   * @param {import('@typescript/typescript6').Node} node */
  const visit=node=>{
    const children=node.getChildren(source);
    if(children.length>0)for(const child of children)visit(child);
    else if(node.kind!==ts.SyntaxKind.EndOfFileToken)tokens.push([node.kind,node.getText(source)]);
  };
  visit(source);
  const result=digest(JSON.stringify({schema:'compiler-code/1',typescript:ts.version,tokens}));
  normalized.set(key,result);return result;
}
