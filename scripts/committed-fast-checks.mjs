// G675: fast checks read exact Git blobs; typed checks and tests belong to CI.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, matchesGlob, relative, resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { pathToFileURL } from 'node:url';
import { gitSourceView, installGitSourceView, deriveGitVocabulary, deriveGitStarterTables, deriveGitDiscovery } from './git-source-view.mjs';
import { gitRuleCount } from './git-rule-counts.mjs';
import * as v from 'valibot';

/** @param {string} root @param {string} base @param {string} tip @param {string} phase @param {string[]} paths */
export async function committedFastChecks(root,base,tip,phase,paths) {
  process.chdir(root);
  const view=gitSourceView(root,tip);
  const json=(/** @type {ReturnType<typeof gitSourceView>} */ source,/** @type {string} */ path,/** @type {object} */ fallback={})=>source.files.has(path)?JSON.parse(source.read(path).toString('utf8')):fallback;
  installGitSourceView(view);
  /** @param {string} path @returns {Promise<unknown>} */
  const module=path=>import(pathToFileURL(resolve(root,path)).href);
  const failures=[];
  mkdirSync(resolve(root,'tmp'),{recursive:true});
  const temporary=mkdtempSync(resolve(root,'tmp/push-config-'));
  try {
    if(phase==='storage') {
      const {createChecker}=/** @type {typeof import('./repo-size.mjs')} */(await module('scripts/repo-size.mjs'));
      const result=createChecker({cwd:root}).checkPush(`refs/heads/main ${tip} refs/heads/main ${base}\n`,{rangeOnly:true});
      console.log(`repo-size: ${result.commits} exact outgoing commits passed`);
    } else if(phase==='fast-lint'||phase==='ratchet'||phase==='ratchet-counts') {
      const {readLintConfig,hardRules}=/** @type {typeof import('./guard-counts.mjs')} */(await module('scripts/guard-counts.mjs'));
      const hard=hardRules(resolve(root,'.oxlintrc.json'));
      const {fastCommitLintConfig}=/** @type {typeof import('./precommit-checks.mjs')} */(await module('scripts/precommit-checks.mjs'));
      const policy=json(view,'lint/ratchet.json');
      const config=resolve(root,`.${basename(temporary)}.json`),allowance=resolve(temporary,'ratchet.json');
      process.env.WS_GIT_CHECK_CONFIG=config;process.env.WILDSHARD_RATCHET_FILE=allowance;
      writeFileSync(allowance,JSON.stringify(policy));
      const roots=paths.filter(path=>/\.[cm]?[jt]sx?$/u.test(path)&&view.files.has(path));
      if(phase==='fast-lint') {
        await deriveGitStarterTables(view);
        const settings=fastCommitLintConfig(readLintConfig(resolve(root,'.oxlintrc.json')));
        settings.jsPlugins=(settings.jsPlugins??[]).map(/** @param {string|{specifier:string}} item */ item=>{
          if(typeof item==='string')return resolve(root,item);
          item.specifier=resolve(root,item.specifier);return item;
        });
        writeFileSync(config,JSON.stringify(settings));
        // Rust's source/import resolution needs matching native inputs. JS
        // plugins and their lint/ policy reads already use the immutable Git
        // view in both processes; loose policy bytes are never authoritative.
        const shared=[...view.files.keys()].filter(path=>/^\.oxlint|^(?:src\/[^/]+\/)?(?:package|tsconfig[^/]*)\.json$|^pnpm-lock\.yaml$/u.test(path));
        const mismatchedShared=shared.filter(path=>!view.matches(path));
        if(mismatchedShared.length>0) {
          for(const file of roots)console.log(`DEFERRED TO CI fast-lint ${file}: unverified configuration ${mismatchedShared.join(', ')}`);
          return;
        }
        const closure=(/** @type {string} */ selected)=>{
          const seen=new Set(shared),missing=new Set(),mismatched=new Set();
          const visit=(/** @type {string} */ file)=>{
            if(missing.size>0||mismatched.size>0||seen.has(file))return;seen.add(file);
            if(!view.matches(file)){mismatched.add(file);return;}
            if(!/\.[cm]?[jt]sx?$/u.test(file))return;
            for(const imported of ts.preProcessFile(view.read(file).toString('utf8'),true,true).importedFiles) {
              const source=imported.fileName.split(/[?#]/u)[0]??'';
              let target=source.startsWith('.')?relative(root,resolve(root,dirname(file),source)):null;
              const packageName=/^@wildshard\/([^/]+)(?:\/(.+))?$/u.exec(source);
              if(packageName!==null) {
                const entry=json(view,`src/${packageName[1]}/package.json`).exports?.[packageName[2]===undefined?'.':`./${packageName[2]}`];
                if(typeof entry!=='string'||!entry.startsWith('./')){missing.add(source);continue;}
                target=`src/${packageName[1]}/${entry.slice(2)}`;
              }
              if(target===null)continue;
              let resolved;
              for(const path of [target,`${target}.ts`,`${target}.tsx`,`${target}.mts`,`${target}.mjs`,`${target}.js`,`${target}/index.ts`]){
                if(view.files.has(path)||view.derived.has(path)||view.admitGenerated(path)||deriveGitDiscovery(view,path)){resolved=path;break;}
              }
              if(resolved===undefined)missing.add(target);else visit(resolved);
            }
          };visit(selected);return {inputs:[...seen],missing:[...missing],mismatched:[...mismatched]};
        };
        const eligible=[],inputs=new Set();
        for(const file of roots) {
          const current=closure(file),mismatched=current.mismatched;
          if(mismatched.length>0||current.missing.length>0)console.log(`DEFERRED TO CI fast-lint ${file}: unverified inputs ${[...mismatched,...current.missing].join(', ')}`);
          else {eligible.push(file);for(const input of current.inputs)inputs.add(input);}
        }
        if(eligible.length>0) {
          const child=spawnSync(process.execPath,[resolve(root,'node_modules/oxlint/bin/oxlint'),'--threads=2','--disable-nested-config','-c',config,...eligible],{
            cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,WS_GIT_CHECK_ROOT:root,WS_GIT_CHECK_REV:tip,
              NODE_OPTIONS:[process.env.NODE_OPTIONS??'',`--import=${pathToFileURL(resolve(import.meta.dirname,'git-source-view.mjs')).href}`].join(' ')},
          });
          if(child.error!==undefined)throw child.error;
          if(child.status!==0)failures.push(child.stdout+child.stderr);
          const replaced=[...inputs].filter(path=>!view.matches(path));
          if(replaced.length>0)console.log(`DEFERRED TO CI fast-lint: inputs changed during checking: ${replaced.join(', ')}`);
          else console.log(`Fast lint passed on ${eligible.length} exact changed files`);
        }
      } else {
        await deriveGitVocabulary(view);
        const debt=v.parse(v.object({rules:v.record(v.string(),v.unknown()),ignorePatterns:v.optional(v.array(v.string()),[]),jsPlugins:v.array(v.union([v.string(),v.object({name:v.string(),specifier:v.string()})]))}),json(view,'.oxlintrc.ratchet.json'));
        const {legacyInventory,registeredLegacyFile}=/** @type {typeof import('./legacy-shards.mjs')} */(await module('scripts/legacy-shards.mjs'));
        const frozen=legacyInventory(root);
        /** @type {Record<string,Record<string,number>>} */
        const counts={};
        for(const spec of debt.jsPlugins) {
          const path=typeof spec==='string'?spec:spec.specifier;
          const imported=v.parse(v.object({default:v.object({meta:v.optional(v.object({name:v.string()})),rules:v.record(v.string(),v.unknown())})}),await module(path));
          const prefix=typeof spec==='string'?imported.default.meta?.name:spec.name;
          if(prefix===undefined)throw new Error('Explicit JS rule namespace required');
          for(const [name,rule]of Object.entries(imported.default.rules)) {
            const key=`${prefix}/${name}`,setting=debt.rules[key];
            if(setting===undefined||setting==='off'||setting===0||['no-authored-html','no-shard-host-callback'].includes(name))continue;
            const options=Array.isArray(setting)?setting.slice(1):[];
            v.parse(v.looseObject({create:v.function()}),rule);
            const selected=roots.filter(file=>file.startsWith('src/')&&!debt.ignorePatterns.some(pattern=>matchesGlob(file,pattern))&&(hard.has(key)||!registeredLegacyFile(frozen,file)));
            for(const file of selected) {
              const current=gitRuleCount(/** @type {Parameters<typeof gitRuleCount>[0]} */(rule),resolve(root,file),view.read(file).toString('utf8'),options,root);
              (counts[key]??={})[file]=current;
            }
          }
        }
        if(phase==='ratchet-counts') {console.log(JSON.stringify(counts));return;}
        // A separate reader pins predecessor metadata too; current modules never
        // borrow dirty policy or confuse changed dependency data with old debt.
        const missing=roots.filter(file=>Object.entries(counts).some(([key,rows])=>!hard.has(key)&&rows[file]>0&&!Object.hasOwn(policy[key]??{},file)));
        /** @type {Record<string,Record<string,number>>} */
        let previous={};
        if(missing.length>0) {
          const child=spawnSync(process.execPath,[resolve(import.meta.filename),root,base,base,'ratchet-counts',JSON.stringify(missing)],{
            cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,
          });
          if(child.error!==undefined)throw child.error;
          if(child.status!==0)throw new Error(`Predecessor ratchet failed: ${child.stderr}`);
          previous=JSON.parse(child.stdout);
        }
        for(const [key,rows]of Object.entries(counts))for(const [file,current]of Object.entries(rows)) {
          const limit=policy[key]?.[file]??(hard.has(key)?0:previous[key]?.[file]??0);
          if(current>limit)failures.push(`${file}: ${key} was ${limit}, now ${current}`);
        }
      }
    } else if(phase==='deleted-paths') {
      view.prime([...view.files.keys()].filter(path=>/^(?:src|scripts|test|lint|admin|api|drafts|vite)\/.*\.(?:json|[cm]?[jt]sx?|py|sh)$/u.test(path)
        &&!/^src\/shards\/[^/]+-legacy\//u.test(path)&&!path.startsWith('test/fixtures/')));
      const {deletedReferences}=/** @type {typeof import('./push-checks.mjs')} */(await module('scripts/push-checks.mjs'));
      failures.push(...deletedReferences(root,paths));
    } else if(phase==='guards') {
      const {closedComponentSources}=/** @type {typeof import('./check-closed-components.mjs')} */(await module('scripts/check-closed-components.mjs'));
      const {comparePlatformList,PLATFORM_LISTS}=/** @type {typeof import('./check-platform-ratchets.mjs')} */(await module('scripts/check-platform-ratchets.mjs'));
      const {ratchetApprovalFailures}=/** @type {typeof import('./ratchet-approval.mjs')} */(await module('scripts/ratchet-approval.mjs'));
      const policy=json(view,'lint/ratchet.json');
      failures.push(...closedComponentSources(root,policy.closedComponents));
      const commits=execFileSync('git',['rev-list','--reverse',`${base}..${tip}`],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
      for(const commit of commits) {
        const before=gitSourceView(root,`${commit}^`),after=gitSourceView(root,commit);
        const message=execFileSync('git',['show','-s','--format=%B',commit],{cwd:root,encoding:'utf8'});
        const oldPolicy=json(before,'lint/ratchet.json'),newPolicy=json(after,'lint/ratchet.json');
        failures.push(...ratchetApprovalFailures(oldPolicy,newPolicy,message));
        for(const path of PLATFORM_LISTS)if(before.files.get(path)!==after.files.get(path)) {
          const a=resolve(temporary,'before.json'),b=resolve(temporary,'after.json');
          if(before.files.has(path))writeFileSync(a,before.read(path));
          if(after.files.has(path))writeFileSync(b,after.read(path));
          failures.push(...comparePlatformList(path,a,b,undefined,{before:json(before,'lint/custom-sections.json'),after:json(after,'lint/custom-sections.json')},{
            before:file=>before.files.has(file)?before.read(file).toString('utf8'):undefined,
            after:file=>after.files.has(file)?after.read(file).toString('utf8'):undefined,
          }));
          rmSync(a,{force:true});rmSync(b,{force:true});
        }
      }
    } else throw new Error('Unknown committed fast-check phase');
    if(failures.length>0)throw new Error(failures.join('\n'));
    if(phase!=='fast-lint')console.log(`${phase}: exact committed inputs passed`);
  } finally {rmSync(resolve(root,`.${basename(temporary)}.json`),{force:true});rmSync(temporary,{recursive:true,force:true});}
}

if(process.argv[1]!==undefined&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [root,base,tip,phase,listing]=process.argv.slice(2);
  if(root===undefined||base===undefined||tip===undefined||phase===undefined||listing===undefined)throw new Error('Expected root, base, tip, phase and JSON paths');
  await committedFastChecks(resolve(root),base,tip,phase,JSON.parse(listing));
}
