// G453 adoption window: explicit immutable rises, sealed at the W1 spike end.
import * as v from 'valibot';

export const CUSTOM_SECTION_POLICY='lint/custom-sections.json';
const natural=v.pipe(v.number(),v.integer(),v.minValue(0));
const pair=v.strictObject({count:natural,bytes:natural});
const raise=v.pipe(v.strictObject({slug:v.string(),from:pair,to:pair,why:v.pipe(v.string(),v.check(text=>text.trim().length>0))}),
  v.check(row=>row.to.count>row.from.count||row.to.bytes>row.from.bytes));
const schema=v.strictObject({version:v.literal(1),baselineAt:v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u)),
  baseline:v.record(v.string(),pair),risesCloseAt:v.nullable(v.literal('W1 spike end')),raises:v.array(raise)});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const entries=budgets=>Object.fromEntries([...new Set(Object.keys(budgets).filter(key=>/^custom-sections\/[^/]+\/(?:count|bytes)$/u.test(key)).map(key=>key.split('/')[1]))].map(slug=>
  [slug,{count:budgets[`custom-sections/${slug}/count`],bytes:budgets[`custom-sections/${slug}/bytes`]}]));

/** Ratchet budgets stay in ratchet.json; this small policy owns only rise history.
 * An initial baseline adopts the reviewed committed ceilings once. Later rises
 * need newly appended exact pairs; a sealed window cannot reopen or grow.
 * @param {Record<string,unknown>} beforeBudgets @param {Record<string,unknown>} afterBudgets
 * @param {unknown} beforePolicy @param {unknown} afterPolicy @returns {string[]} */
export function compareCustomSections(beforeBudgets,afterBudgets,beforePolicy,afterPolicy) {
  const before=entries(beforeBudgets),after=entries(afterBudgets),failures=[];
  for(const key of new Set([...Object.keys(beforeBudgets),...Object.keys(afterBudgets)])) {
    if(!/^custom-sections\/[^/]+\/(?:count|bytes)$/u.test(key))continue;
    const value=afterBudgets[key];
    if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)failures.push(`${key}: missing or invalid ceiling`);
  }
  for(const [slug,limits]of Object.entries(after))if(!Number.isSafeInteger(limits.count)||!Number.isSafeInteger(limits.bytes))failures.push(`${slug}: count and byte ceilings must both exist`);
  if(failures.length>0)return failures;
  if(afterPolicy===undefined) {
    if(beforePolicy!==undefined)return ['custom-section rise policy cannot be removed'];
    for(const [slug,to]of Object.entries(after)) {
      const from=before[slug]??{count:0,bytes:0};
      if(to.count>from.count||to.bytes>from.bytes)failures.push(`${slug}: custom-section ceiling rises without a raises line`);
    }
    return failures;
  }
  const next=v.safeParse(schema,afterPolicy);
  if(!next.success)return ['custom-section rise policy is malformed'];
  if(beforePolicy===undefined) {
    if(next.output.raises.length>0||!same(next.output.baseline,after))return ['custom-section initial baseline must match committed ceilings with no raises'];
    return [];
  }
  const previous=v.safeParse(schema,beforePolicy);
  if(!previous.success)return ['custom-section predecessor policy is malformed'];
  if(next.output.baselineAt!==previous.output.baselineAt||!same(next.output.baseline,previous.output.baseline))failures.push('custom-section initial baseline is immutable');
  if(previous.output.risesCloseAt!==null&&next.output.risesCloseAt!==previous.output.risesCloseAt)failures.push('custom-section rise window cannot reopen');
  if(next.output.raises.length<previous.output.raises.length||previous.output.raises.some((row,i)=>!same(row,next.output.raises[i])))failures.push('custom-section raises must remain an immutable append-only history');
  const fresh=next.output.raises.slice(previous.output.raises.length),used=new Set();
  for(const [slug,to]of Object.entries(after)) {
    const from=before[slug]??{count:0,bytes:0};
    if(!(to.count>from.count||to.bytes>from.bytes))continue;
    if(previous.output.risesCloseAt!==null||next.output.risesCloseAt!==null){failures.push(`${slug}: custom-section rises closed at W1 spike end`);continue;}
    const row=fresh.find(item=>item.slug===slug&&same(item.from,from)&&same(item.to,to));
    if(row===undefined)failures.push(`${slug}: custom-section ceiling rises without an appended exact {slug, from, to, why} line`);
    else used.add(row);
  }
  for(const row of fresh)if(!used.has(row))failures.push(`${row.slug}: custom-section raises line matches no ceiling change`);
  return failures;
}
