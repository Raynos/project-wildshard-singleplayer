// REVIEW5: JSON is data, but private section inventories have explicit retirement debt.
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Numeric ceilings stay in ratchet.json's existing policy-only budgets namespace.
 * Custom-section names need a documented exit row. Named JSON shares the same
 * totals: changing its transport cannot escape the count or byte ceiling.
 * @param {string} root
 * @param {Record<string,{customSections:{name:string;bytes:number}[]}>} measures */
export function customSectionFailures(root,measures) {
  const policy=JSON.parse(readFileSync(resolve(root,'lint/ratchet.json'),'utf8'));
  const failures=[];
  for(const [slug,row]of Object.entries(measures)) {
    const count=row.customSections.length,bytes=row.customSections.reduce((sum,section)=>sum+section.bytes,0);
    for(const [unit,value]of [['count',count],['bytes',bytes]]) {
      const ceiling=policy.budgets?.[`custom-sections/${slug}/${unit}`];
      if(!Number.isSafeInteger(ceiling)||ceiling<0)failures.push(`${slug}: missing custom-section ${unit} ceiling`);
      else if(value>ceiling)failures.push(`${slug}: custom-section ${unit} ${value} exceeds ${ceiling}`);
    }
    for(const section of row.customSections) {
      if(!section.name.startsWith('custom/'))continue;
      const exit=policy.allow?.['shardfile/custom-sections']?.[`${slug}/${section.name}`];
      const parts=typeof exit==='string'?exit.split('#'):[];
      const file=parts[0],name=parts[1];
      if(parts.length!==2||!file.startsWith('docs/plans/')||file.split('/').some(part=>part==='..')||!name
        ||!existsSync(resolve(root,file))||!readFileSync(resolve(root,file),'utf8').split('\n').some(line=>line.split('|')[1]?.trim()===name))
        failures.push(`${slug}: ${section.name} needs a recorded plan exit row`);
    }
  }
  return failures;
}
