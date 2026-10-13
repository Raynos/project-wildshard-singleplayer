// G366: retry a red only when its immutable observed inputs change.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inputKey } from './commit-inputs.mjs';
import { treeEntries } from './gate-cache.mjs';

const git = (root,args) => execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const hash = text => createHash('sha256').update(text).digest('hex');
const common = root => git(root,['rev-parse','--path-format=absolute','--git-common-dir']);
const approval = root => { const file=resolve(common(root),'generated-approval.json');return existsSync(file) ? hash(readFileSync(file)) : 'absent'; };
/** Read the requested commit and its verified generation recipe, never shared WIP. */
function identities(root, sha) {
  const files = new Map();
  for (const row of git(root,['ls-tree','-rz',sha]).split('\0').filter(Boolean)) {
    const [header,path] = row.split('\t');
    files.set(path,header);
  }
  const key = inputKey(root,sha), receipt = resolve(common(root),'commit-inputs',`${key}.json`);
  if (existsSync(receipt)) {
    const outputs = JSON.parse(readFileSync(receipt,'utf8'));
    for (const [file,digest] of Object.entries(outputs)) if (!files.has(file)) files.set(file,`generated:${digest}`);
  }
  return {files,key,recipe:existsSync(receipt) ? hash(readFileSync(receipt)) : 'absent'};
}
function value(identity, entry) {
  const kind = entry[0], path = entry.slice(2).split('\t')[0];
  if (kind === 'F') return identity.files.get(path) ?? 'absent';
  const prefix = path === '.' ? '' : `${path}/`;
  const children = [...identity.files].filter(([file]) => file.startsWith(prefix));
  // Globs conservatively include all descendants, including additions/deletions.
  return hash(children.map(([file,blob]) => kind === 'D' ? file.slice(prefix.length).split('/')[0] : `${file}\0${blob}`).sort((a,b)=>a.localeCompare(b)).join('\0'));
}
const ALWAYS = ['F package.json','F pnpm-lock.yaml','F pnpm-workspace.yaml','F tsconfig.json','F vitest.config.ts','F .oxlintrc.json',
  'F scripts/local-gate.py','F scripts/local-gate-checks.mjs','F scripts/push-refusal.mjs','F scripts/gate-trace.mjs'];
/** @param {string} root @param {string} sha @param {string} tree @param {string[]} traces */
export function recordPushRefusal(root,sha,tree,traces) {
  const entries = new Set(ALWAYS);
  let complete = traces.length > 0;
  for (const directory of traces) {
    const logs = existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith('.trace')) : [];
    if (logs.length === 0) complete = false;
    for (const file of logs) for (const entry of treeEntries(tree,readFileSync(resolve(directory,file),'utf8').split('\n'))) entries.add(entry);
  }
  const identity = identities(root,sha), inputs = Object.fromEntries([...entries].map(entry => [entry,value(identity,entry)]));
  const file = resolve(common(root),'push-refusals',`${sha}.json`);
  mkdirSync(resolve(file,'..'),{recursive:true});
  writeFileSync(file,JSON.stringify({sha,node:process.version,platform:process.platform,arch:process.arch,complete,approval:approval(root),key:identity.key,recipe:identity.recipe,inputs}));
}
/** Missing, torn or unsupported receipts never suppress a gate. @param {string} root @param {string} red @param {string} tip */
export function unchangedPushRefusal(root,red,tip) {
  try {
    const saved = JSON.parse(readFileSync(resolve(common(root),'push-refusals',`${red}.json`),'utf8'));
    if (saved.sha !== red || saved.node !== process.version || saved.platform !== process.platform || saved.arch !== process.arch || saved.approval !== approval(root)) return false;
    const identity = identities(root,tip);
    if (saved.complete !== true) return saved.key === identity.key && saved.recipe === identity.recipe;
    return Object.keys(saved.inputs).length >= ALWAYS.length && Object.entries(saved.inputs).every(([entry,expected]) => value(identity,entry) === expected);
  } catch { return false; }
}
if (process.argv[2] === '--record') {
  try { recordPushRefusal(process.argv[3],process.argv[4],process.argv[5],JSON.parse(process.argv[6])); }
  catch (error) { console.error(`push-refusal: receipt unavailable: ${String(error)}`);process.exitCode=1; }
} else if (process.argv[2] === '--unchanged') {
  process.exitCode = unchangedPushRefusal(process.argv[3],process.argv[4],process.argv[5]) ? 0 : 1;
}
