// G694: custom-section count and byte ceilings only shrink. No override path.
import * as v from 'valibot';

export const CUSTOM_SECTION_POLICY='lint/custom-sections.json';
const natural=v.pipe(v.number(),v.integer(),v.minValue(0));
const pair=v.strictObject({count:natural,bytes:natural});
const revision=v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u));
const fields={version:v.literal(1),baselineAt:revision,baseline:v.record(v.string(),pair),freeze:v.optional(v.strictObject({at:revision,names:v.record(v.string(),v.array(v.string()))}))};
const schema=v.strictObject(fields), predecessor=v.object(fields);
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

/** Ratchet budgets may hold or shrink; policy metadata grants no exception.
 * The initial baseline remains immutable history, with old override fields
 * accepted only when reading the predecessor during the G694 migration.
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
  for(const [slug,to]of Object.entries(after)) {
    const from=before[slug]??{count:0,bytes:0};
    if(to.count>from.count||to.bytes>from.bytes)failures.push(`${slug}: custom-section ceilings are shrink-only`);
  }
  if(afterPolicy===undefined) {
    if(beforePolicy!==undefined)failures.push('custom-section policy cannot be removed');
    return failures;
  }
  const next=v.safeParse(schema,afterPolicy);
  if(!next.success)return [...failures,'custom-section policy is malformed'];
  if(beforePolicy===undefined) {
    if(!same(next.output.baseline,after))failures.push('custom-section initial baseline must match committed ceilings');
    return failures;
  }
  const previous=v.safeParse(predecessor,beforePolicy);
  if(!previous.success)return [...failures,'custom-section predecessor policy is malformed'];
  if(next.output.baselineAt!==previous.output.baselineAt||!same(next.output.baseline,previous.output.baseline))failures.push('custom-section initial baseline is immutable');
  const frozen = previous.output.freeze, updated = next.output.freeze;
  if (frozen !== undefined) {
    if (updated === undefined || updated.at !== frozen.at) failures.push('custom-section name freeze cannot be removed or re-based');
    else for (const [slug, names] of Object.entries(updated.names)) {
      if (names.some(name => !frozen.names[slug]?.includes(name))) failures.push(`${slug}: frozen custom-section identities only shrink`);
    }
  }
  if (updated !== undefined) for (const [slug, names] of Object.entries(updated.names)) {
    if (new Set(names).size !== names.length || names.some(name => name.length === 0)) failures.push(`${slug}: invalid frozen custom-section identities`);
  }
  return failures;
}

const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]));
}

/** New identities cannot borrow retired capacity for private schemas. Format provenance is verified against
 * the independently generated defining-schema catalogue, not trusted because of its label.
 * @param {unknown} policy
 * @param {Record<string,{customSections:{name:string;bytes:number;jsonSchema?:unknown}[]}>} measures
 * @param {Record<string,unknown>} formats
 * @returns {string[]} */
export function customSectionIdentityFailures(policy, measures, formats) {
  const parsed = v.parse(schema, policy), frozen = parsed.freeze;
  if (frozen === undefined) return [];
  const failures = [];
  for (const [slug, row] of Object.entries(measures)) for (const section of row.customSections) {
    if (frozen.names[slug]?.includes(section.name)) continue;
    if (section.name.startsWith('custom/')) { failures.push(`${slug}: new custom section ${section.name} is frozen`); continue; }
    const document = section.jsonSchema;
    const source = document !== null && typeof document === 'object' ? Reflect.get(document, '$comment') : undefined;
    if (typeof source !== 'string' || !Object.hasOwn(formats, source) || canonical(document) !== canonical(formats[source]))
      failures.push(`${slug}: new named JSON ${section.name} needs verified shared-format schema provenance`);
  }
  return failures;
}
