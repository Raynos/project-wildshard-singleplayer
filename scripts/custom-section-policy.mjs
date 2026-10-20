// G453 adoption window, sealed at W1; G514 permits one immutable measured reset,
// then appended measured remeasures for code-to-data growth (wildshard-new, 10-20).
import * as v from 'valibot';

export const CUSTOM_SECTION_POLICY='lint/custom-sections.json';
const natural=v.pipe(v.number(),v.integer(),v.minValue(0));
const pair=v.strictObject({count:natural,bytes:natural});
const why=v.pipe(v.string(),v.check(text=>text.trim().length>0));
const raise=v.pipe(v.strictObject({slug:v.string(),from:pair,to:pair,why}),
  v.check(row=>row.to.count>row.from.count||row.to.bytes>row.from.bytes));
const revision=v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u));
const schema=v.strictObject({version:v.literal(1),baselineAt:revision,
  baseline:v.record(v.string(),pair),risesCloseAt:v.nullable(v.literal('W1 spike end')),raises:v.array(raise),
  g514Reset:v.optional(v.strictObject({revision,ceilings:v.record(v.string(),pair)})),
  remeasures:v.optional(v.array(v.strictObject({revision,ceilings:v.record(v.string(),pair),why})))});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const entries=budgets=>Object.fromEntries([...new Set(Object.keys(budgets).filter(key=>/^custom-sections\/[^/]+\/(?:count|bytes)$/u.test(key)).map(key=>key.split('/')[1]))].map(slug=>
  [slug,{count:budgets[`custom-sections/${slug}/count`],bytes:budgets[`custom-sections/${slug}/bytes`]}]));

/** G518: an existing excess may hold or shrink; growth must fit the budget.
 * @param {Record<string,unknown>} budgets
 * @param {Record<string,{count:number;bytes:number;bounds?:string[]}>} before
 * @param {Record<string,{count:number;bytes:number}>} after
 * @returns {string[]} */
export function customSectionGrowthFailures(budgets,before,after) {
  const failures=[];
  for(const [slug,measured]of Object.entries(after))for(const unit of ['count','bytes']) {
    const budget=budgets[`custom-sections/${slug}/${unit}`],value=measured[unit],base=before[slug]?.[unit]??0;
    const bounded=before[slug]?.bounds?.includes(unit)??false;
    if(typeof budget!=='number'||!Number.isSafeInteger(budget)||budget<0)failures.push(`${slug}: missing or invalid custom-section ${unit} budget`);
    else if(value>budget&&bounded&&value<=base)failures.push(`${slug}: custom-section ${unit} ${value} exceeds budget ${budget}; exact pushed base needed (known only to be at most ${base})`);
    else if(value>budget&&value>base)failures.push(`${slug}: custom-section ${unit} ${value} exceeds budget ${budget} and pushed base ${bounded?'at most ':''}${base}`);
  }
  return failures;
}

/** Ratchet budgets stay in ratchet.json; this small policy owns only rise history.
 * An initial baseline adopts the reviewed committed ceilings once. Later rises
 * need newly appended exact pairs; only the one-use G514 reset can grow a seal.
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
  // G514 authorizes one measured reset after today's code-to-data moves.
  // Its complete inventory is immutable; later changes remain shrink-only.
  const g514=previous.output.g514Reset===undefined&&next.output.g514Reset!==undefined;
  // A later measured reset appends one remeasure row per commit; the history is immutable.
  const before514=previous.output.remeasures??[],after514=next.output.remeasures??[],remeasured=after514.slice(before514.length);
  if(after514.length<before514.length||before514.some((row,i)=>!same(row,after514[i])))failures.push('custom-section remeasures must remain an immutable append-only history');
  if(remeasured.length>1)failures.push('custom-section remeasures append one row per commit');
  if(remeasured.some(row=>!same(row.ceilings,after)))failures.push('custom-section remeasure must match all committed ceilings');
  const reset=g514||remeasured.length===1;
  if(previous.output.g514Reset!==undefined&&!same(previous.output.g514Reset,next.output.g514Reset))failures.push('G514 custom-section reset is immutable');
  if(g514&&!same(next.output.g514Reset.ceilings,after))failures.push('G514 custom-section reset must match all committed ceilings');
  if(next.output.raises.length<previous.output.raises.length||previous.output.raises.some((row,i)=>!same(row,next.output.raises[i])))failures.push('custom-section raises must remain an immutable append-only history');
  const fresh=next.output.raises.slice(previous.output.raises.length),used=new Set();
  for(const [slug,to]of Object.entries(after)) {
    const from=before[slug]??{count:0,bytes:0};
    if(!(to.count>from.count||to.bytes>from.bytes))continue;
    // G496 sealed the named-JSON inventory. G514's one-time exception still
    // requires the original exact append-only raise record for every increase.
    if(previous.output.risesCloseAt!==null&&!reset){failures.push(`${slug}: custom-section rises closed at W1 spike end`);continue;}
    const row=fresh.find(item=>item.slug===slug&&same(item.from,from)&&same(item.to,to));
    if(row===undefined)failures.push(`${slug}: custom-section ceiling rises without an appended exact {slug, from, to, why} line`);
    else used.add(row);
  }
  for(const row of fresh)if(!used.has(row))failures.push(`${row.slug}: custom-section raises line matches no ceiling change`);
  return failures;
}
