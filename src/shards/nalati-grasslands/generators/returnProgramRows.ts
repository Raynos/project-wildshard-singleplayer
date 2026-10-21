import { SCRIPT_V1_REFERENCE_KINDS } from '@wildshard/format/decisionScripts';
/** Omit only schema-defined defaults; the existing parser restores them.
 * No module bytes, alias identities or decoding rules change. Build-only. */
interface ProgramWire {readonly script:Readonly<Record<string,unknown>>;readonly bytes:string}
export function wireProgram(row:ProgramWire):ProgramWire {
  const empty=new Set([...SCRIPT_V1_REFERENCE_KINDS,'timers']);
  const script=Object.fromEntries(Object.entries(row.script).filter(([key,value])=>
    !(empty.has(key)&&value!==null&&typeof value==='object'&&Object.keys(value).length===0
      ||key==='tick'&&value===null)));
  return {...row,script};
}
