// W1-M0: roles attribute existing G291/G294 contributions, never change their size.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSync } from 'vite';

export const W1_SHARDS = ['far-reach', 'sunscar-dunes'];
export const COMPONENTS = {
  C1: 'Static world', C2: 'Looks', C3: 'Effects', C4: 'Creatures',
  C5: 'NPCs and quests', C6: 'Items and combat', C7: 'Movers',
  C8: 'Audio', C9: 'Boot glue',
};
// Ordered semantic roles apply to owner APIs, declarations and imported bindings.
// File roles supply a baseline; explicit owner declarations/calls split mixed code.
const roles = [
  ['C3', /fireFx|gustFx|windFx|wakeRibbon|discLayer|heroStoneDiscs|GUST_FX|RAY_WAKE/iu],
  ['C5', /quest|bindDirectorActions|signalStages|PivotNpc|NpcSurface|NpcLevel|scout|sefa|keeper|turnVanes|vaneFlag|QUEST|LATER_FLAGS|PAID_FLAG|SCOUT_FLAG|COMPLETE_FLAG/iu],
  ['C7', /mover|updraft|SocketLift|isletCalls|IsletCalls|RisingIslet|RISING_ISLETS|winch|commandSocketLift/iu],
  ['C6', /weapon|lash|whip|fan|strike|swings|cracks|worldCommands|heavy|released|bindRuntimeItemContexts|item/iu],
  ['C4', /species|creature|Animal|flock|brain|bossStages|undrawnRig|matriarch|stormRoc|rocBrain|bossOwner|BossView|SkySpecs|SKY_HOMES|GOAT_|\bray\b|skitterer|strider|setHome|bindPlayerPush|homes|encounter/iu],
  ['C8', /audio|cues|voices|score/iu],
  ['C2', /look|Glsl|shader|Material|scarfed|dusk|light|fog|paint|texture|SKY_SUN|SAND|SKIRT|Atmosphere|stormWeather/iu],
  ['C1', /terrain|ground|worldBuild|buildWorld|bakedWorld|BakedTerrain|meadow|mesh|geometry|collider|props|Primitives/iu],
];
function namedRole(name) { return roles.find(([, pattern]) => pattern.test(name))?.[0] ?? null; }
/** Explicit file ownership; an unrecognised file stays visible and cannot close C9. */
function fileRole(path, name = '') {
  if (path === 'src/game/plugin/ui.ts' && ['WorldSceneBoundParts', 'bindWorldSceneParts'].includes(name)) return 'C1';
  if (path === 'src/game/plugin/ui.ts' && ['moverChannelValues', 'moverChannelView', 'moverChannelViews', 'moverChannelPrompts'].includes(name)) return 'C7';
  if (path === 'src/sdk/questGraph.ts' && name === 'parseNpcRow') return 'C5';
  if (path === 'src/sdk/bake/texture.ts') return 'C2';
  if (name && /PivotNpc|NpcSurface|NpcLevel/iu.test(name)) return 'C5';
  if (name && /SocketLift|Updraft/iu.test(name)) return 'C7';
  if (name && /bindRuntimeItemContexts/iu.test(name)) return 'C6';
  if (/fireFx|windFx|wakeRibbon|discLayer|skyCardsLook|cardField/iu.test(path)) return 'C3';
  if (/\/(?:quest|quests)\/|\/runtime\/quest\.ts$/u.test(path)) return 'C5';
  if (/\/(?:species|creatures)\/|brain|flock|\/ai\/|(?:models|combat)\/(?:creatures|matriarch|stormRoc)/iu.test(path)) return 'C4';
  if (/\/(?:weapons|items)\/|\/items\.ts$|lash|fan|\/models\/gear|weaponFamily/iu.test(path)) return 'C6';
  if (/mover|entries\.ts$|islets?\.ts$|risingIslet|isletLift|updraft/iu.test(path)) return 'C7';
  if (/audio|cues|voices/iu.test(path)) return 'C8';
  if (/\/look[s]?\/|Look|Glsl|\/render\/|Atmosphere|materialPreparation/iu.test(path)) return 'C2';
  if (/\/world\/|\/models\/|\/layout\.ts$|\/plugin\/geometry\.ts$/u.test(path)) return 'C1';
  if (/\/(?:boot|explore|thumbs)\/|\/(?:manifest|plugin|roster|budgets|budgetCeilings|shard\.config)\.ts$|\/runtime\/(?:index|headless|signalPlan|standalone|source|persistence)\.ts$|\/runtime\/shardfile\/markedBoss\.ts$|\/plugin\/(?:headless|simulation)\.ts$|\/game\/saves\.ts$/u.test(path)) return 'C9';
  return null;
}
const children = node => Object.values(node).flatMap(value => Array.isArray(value) ? value.filter(item => item?.type) : value?.type ? [value] : []);
const nodeName = node => node?.name ?? (typeof node?.value === 'string' ? node.value : '');
const calledName = node => node?.type === 'MemberExpression' ? nodeName(node.property) : nodeName(node);
function runtimeTags(source, path, fallback) {
  const parsed = parseSync(path, source), starts = [0];
  let blanked = '', cursor = 0;
  for (const comment of parsed.comments) { blanked += source.slice(cursor, comment.start) + source.slice(comment.start, comment.end).replaceAll(/[^\n]/gu, ' '); cursor = comment.end; }
  blanked += source.slice(cursor);
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  const tags = blanked.split('\n').map((line, index) => line.trim() ? { line:index + 1, component:fallback, priority:0, reason:'file owner' } : null);
  const lineOf = offset => { let low=0, high=starts.length-1; while(low<high){const mid=(low+high+1)>>1;if(starts[mid]<=offset)low=mid;else high=mid-1;}return low; };
  const assign = (node, component, priority, reason) => {
    if (!component) return;
    const owner = fallback === 'C3' && (component === 'C1' || component === 'C2') ? 'C3' : component;
    for (let i=lineOf(node.start);i<=lineOf(Math.max(node.start,node.end-1));i++) {
      const row=tags[i]; if(row && priority>row.priority){row.component=owner;row.priority=priority;row.reason=reason;}
    }
  };
  const imports = new Map();
  for (const node of parsed.program.body) if(node.type==='ImportDeclaration') {
    const from=fileRole(node.source.value);
    for(const spec of node.specifiers) imports.set(spec.local.name,namedRole(spec.local.name) ?? from);
    assign(node, node.specifiers.map(spec=>imports.get(spec.local.name)).find(Boolean),1,`import ${node.source.value}`);
  }
  const methods = { arm:'C6',armed:'C6',dress:'C6',enter:'C6',witnessed:'C4',ray:'C4',stage:'C5',build:'C1' };
  const visit=(node,depth)=>{
    let role=null, reason='';
    if(node.type==='VariableDeclarator'||node.type==='FunctionDeclaration') {
      const name=nodeName(node.id);role=(node.init?.type==='CallExpression' ? imports.get(calledName(node.init.callee)) ?? namedRole(calledName(node.init.callee)) : null) ?? namedRole(name);reason=`declaration ${name}`;
    } else if(node.type==='MethodDefinition') { const name=nodeName(node.key);role=(Object.hasOwn(methods,name)?methods[name]:null)??namedRole(name);reason=`method ${name}`;
    } else if(node.type==='Property'||node.type==='PropertyDefinition') {
      const name=nodeName(node.key);role=namedRole(name);reason=`property ${name}`;
    } else if(node.type==='CallExpression'||node.type==='NewExpression') {
      const name=calledName(node.callee);role=imports.get(name)??namedRole(name);reason=`owner API ${name}`;
    }
    assign(node,role,2+depth,reason);
    for(const child of children(node))visit(child,depth+1);
  };
  visit(parsed.program,0);
  return tags.filter(row=>row!==null);
}
/** Attribute each canonical contribution exactly once; ranges retain physical TS lines for auditing.
 * @param {string} root @param {string} shard @param {import('./shard-platform.mjs').CustomSource[]} sources
 * @param {number} canonical @returns {import('./shard-components.mjs').ComponentInventory} */
export function componentInventory(root, shard, sources, canonical) {
  const counts=Object.fromEntries(Object.keys(COMPONENTS).map(key=>[key,0])), unknown=[], spans=[];
  for(const row of sources) {
    const role=fileRole(row.path,row.name);
    if(role===null)unknown.push(`${row.path}${row.name?`#${row.name}`:''}`);
    const owner=role??'C9';
    if(row.kind==='runtime-ts'||row.kind==='sole-module') {
      const tags=runtimeTags(readFileSync(resolve(root,row.path),'utf8'),row.path,owner);
      if(tags.length!==row.lines)throw new Error(`Component line mismatch: ${row.path} ${tags.length}/${row.lines}`);
      for(const tag of tags) {
        counts[tag.component]++;
        const last=spans.at(-1);
        if(last && last.path===row.path && last.kind===row.kind && last.component===tag.component && last.end===tag.line-1 && last.reason===tag.reason){last.end=tag.line;last.lines++;}
        else spans.push({path:row.path,kind:row.kind,component:tag.component,start:tag.line,end:tag.line,lines:1,reason:tag.reason});
      }
    } else {
      // Additional GLSL is the canonical shader unit; sole exports already have deduplicated declaration spans.
      const component=row.kind==='additional-glsl'?(owner==='C3'?'C3':'C2'):namedRole(row.name??'')??owner;
      counts[component]+=row.lines;
      spans.push({path:row.path,kind:row.kind,component,lines:row.lines,reason:row.name?`G294 declaration ${row.name}`:'additional GLSL owner'});
    }
  }
  const total=Object.values(counts).reduce((sum,n)=>sum+n,0);
  if(total!==canonical)throw new Error(`${shard}: component total ${total} differs from canonical ${canonical}`);
  return {shard,counts,total,unknown,spans};
}
/** A wave component closes only when both known canonical inventories have zero left. */
export function componentWave(rows) {
  const shards=W1_SHARDS.map(shard=>rows[shard]?.components);
  const complete=shards.every(row=>row!==undefined && row.unknown.length===0);
  const components=Object.fromEntries(Object.keys(COMPONENTS).map(key=>[key,{closed:complete && shards.every(row=>row.counts[key]===0),lines:Object.fromEntries(W1_SHARDS.map((slug,i)=>[slug,shards[i]?.counts[key]??null]))}]));
  return {shards:W1_SHARDS,closed:Object.values(components).filter(row=>row.closed).length,total:9,components};
}
/** @param {Record<string,{components?:import('./shard-components.mjs').ComponentInventory}>} rows */
export function componentMarkdown(rows) {
  const wave=componentWave(rows);
  const lines=['','## W1 component checklist','',`Components closed ${wave.closed} of ${wave.total}. Unknown ownership never counts closed.`,
    'Nine disjoint totals reconcile exactly to G291/G294 custom lines. Mixed TS uses AST declarations and owner calls;',
    'each code line has one owner (the deepest explicit owner span wins; ties retain the first span).',
    'Extra GLSL belongs to its look/effect owner. G294 sole declarations retain their canonical charged line counts.','',
    '| Component | Sky lines | Signal lines | Closed across both |','|---|---:|---:|---|',
    ...Object.entries(wave.components).map(([key,row])=>`| ${key} ${COMPONENTS[key]} | ${row.lines['far-reach']??'unavailable'} | ${row.lines['sunscar-dunes']??'unavailable'} | ${row.closed?'yes':'no'} |`),
    `| Total | ${W1_SHARDS.map(slug=>rows[slug]?.components?.total??'unavailable').join(' | ')} | |`,'','### Custom contribution owners','',
    '| Shard | Source | Unit / span | Component | Lines | Owner rule |','|---|---|---|---|---:|---|'];
  for(const slug of W1_SHARDS){const report=rows[slug]?.components;if(!report)continue;
    for(const span of report.spans)lines.push(`| ${slug} | ${span.path} | ${span.kind}${span.start===undefined?'':`:${span.start}-${span.end}`} | ${span.component} | ${span.lines} | ${span.reason} |`);
    for(const path of report.unknown)lines.push(`Unknown owner: ${path}`);
  }
  return lines;
}
