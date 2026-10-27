import * as v from 'valibot';

const bytes=v.object({resident:v.number(),wire:v.number(),files:v.number()});
const processBytes=v.object({renderer:v.number(),gpu:v.number(),browser:v.number()});
const row=v.looseObject({shard:v.string(),ring:v.string(),failures:v.array(v.string()),
  observedTapToControlsMs:v.optional(v.number()),
  declared:v.optional(v.object({resident:bytes,wholeFine:bytes,rowResident:v.number()})),
  state:v.optional(v.looseObject({render:v.array(v.number()),colliders:v.array(v.number())})),
  frames:v.optional(v.looseObject({maxMs:v.number(),p95Ms:v.nullable(v.number())})),
  process:v.optional(processBytes),
  overlay:v.optional(v.object({rects:v.array(v.unknown()),labels:v.array(v.string())})),
  share:v.optional(v.looseObject({total:v.number(),ramCapacity:v.number(),
    gpu:v.object({engine:v.number(),shardGlobal:v.number(),tileCandidate:v.number(),shared:v.number(),unknown:v.number()}),
    sceneCpu:v.nullable(v.looseObject({totalBytes:v.number(),boundedNodes:v.number(),nodes:v.number()}))}))});
const timing=v.looseObject({from:v.nullable(v.string()),to:v.nullable(v.string()),requestedAt:v.number(),readyAt:v.number(),end:v.number()});
const crossing=v.looseObject({round:v.number(),frames:v.looseObject({maxMs:v.number()}),failures:v.array(v.string()),timings:v.array(timing)});
const claim=v.pipe(v.looseObject({owner:v.string(),bytes:v.optional(v.number()),accountedBytes:v.optional(v.number())}),
  v.check(c=>c.bytes!==undefined||c.accountedBytes!==undefined,'Claim byte counter unavailable'));
const state=v.looseObject({grid:v.nullable(v.looseObject({claims:v.array(claim),roadTiles:v.unknown()}))});
const sample=v.looseObject({process:processBytes,state});
const grid=v.looseObject({road:v.string(),error:v.optional(v.string()),errors:v.array(v.string()),
  failurePhase:v.optional(v.string()),phaseMs:v.optional(v.number()),elapsedMs:v.optional(v.number()),
  returns:v.optional(v.array(v.looseObject({round:v.number(),deltaBytes:v.number(),failures:v.array(v.string())}))),
  crossings:v.optional(v.array(crossing)),before:v.optional(sample),after:v.optional(sample)});
const reading=v.looseObject({protocol:v.literal('tile-plan-chromium/1'),pin:v.string(),complete:v.boolean(),
  errors:v.array(v.string()),rows:v.array(row),grid:v.array(grid)});

/** Pure offline rendering; absent observations stay unavailable. Raw failures remain verbatim.
 * @param {unknown} input */
export function tilePlanMarkdown(input){
  const data=v.parse(reading,input);
  /** @param {number|undefined|null} n */
  const mib=n=>n===undefined||n===null?'unavailable':(n/1048576).toFixed(2);
  /** @param {number|undefined|null} n */
  const ms=n=>n===undefined||n===null?'unavailable':n.toFixed(1);
  const lines=[`Source: ${data.pin}. Cohort complete: ${data.complete}. Chromium iPhone16Pro / phone / 4xCPU / 2x render.`,
    'Capacities, declared costs, claims and private process footprints are separate; no forced GC, causal gain or Safari RAM claim.',
    '', '| Shard | Ring | Owned render/collider tiles | Declared resident closure MiB / whole-fine MiB | Observed GPU MiB | Scene CPU backing MiB | Renderer+GPU footprint MiB | Worst / p95 frame ms | T5 rect records / unique MB strings | First-observed controls ms | Raw failures |',
    '|---|---|---|---|---|---|---|---|---|---|---|'];
  for(const r of data.rows)lines.push(`| ${r.shard} | ${r.ring} | ${r.state===undefined?'unavailable':`${r.state.render.length}/${r.state.colliders.length}`} | ${mib(r.declared?.resident.resident)} / ${mib(r.declared?.wholeFine.resident)} | ${mib(r.share?.total)} | ${mib(r.share?.sceneCpu?.totalBytes)} | ${mib(r.process===undefined?undefined:r.process.renderer+r.process.gpu)} | ${ms(r.frames?.maxMs)} / ${ms(r.frames?.p95Ms)} | ${r.overlay===undefined?'unavailable':`${r.overlay.rects.length}/${r.overlay.labels.length}`} | ${ms(r.observedTapToControlsMs)} | ${r.failures.length} |`);
  lines.push('', 'T0 observed GPU classification, MiB. These are current spawn shares, not removable bytes or historical savings.',
    '', '| Shard / ring | Engine | Known global | Single-node buffer candidate | Shared | Unknown | RAM ledger capacity | Bounded scene nodes / all |',
    '|---|---|---|---|---|---|---|---|');
  for(const r of data.rows){const s=r.share;lines.push(`| ${r.shard} / ${r.ring} | ${mib(s?.gpu.engine)} | ${mib(s?.gpu.shardGlobal)} | ${mib(s?.gpu.tileCandidate)} | ${mib(s?.gpu.shared)} | ${mib(s?.gpu.unknown)} | ${mib(s?.ramCapacity)} | ${s?.sceneCpu===undefined||s.sceneCpu===null?'unavailable':`${s.sceneCpu.boundedNodes}/${s.sceneCpu.nodes}`} |`);}
  lines.push('', 'T7 actual held-input crossings. First round uses the cold 8s limit; later rounds use warm 5s; every leg keeps the 100ms bar.',
    '', '| Round | From → to | Preparation ms | Request → end ms | Worst frame ms | Failures |','|---|---|---|---|---|---|');
  for(const g of data.grid)for(const c of g.crossings??[])for(const t of c.timings)lines.push(`| ${c.round} | ${t.from??'road'} → ${t.to??'road'} | ${ms(t.readyAt-t.requestedAt)} | ${ms(t.end-t.requestedAt)} | ${ms(c.frames.maxMs)} | ${c.failures.length} |`);
  lines.push('', 'T7 return footprint deltas, MiB; unchanged absolute20MB bar. These process totals do not isolate per-shard physical content.',
    '', '| Road | Round | Renderer+GPU delta MiB | Failures |','|---|---|---|---|');
  for(const g of data.grid)for(const r of g.returns??[])lines.push(`| ${g.road} | ${r.round} | ${mib(r.deltaBytes)} | ${r.failures.join('; ')} |`);
  lines.push('', 'S3.7 platform claims and process footprint. Claims include platform assets/working reservations and are not physical road RAM.',
    '', '| Road choice | Platform claims before / after MiB | Renderer+GPU before / after MiB | Stream state | Errors |','|---|---|---|---|---|');
  /** @param {v.InferOutput<typeof sample>|undefined} s */
  const platform=s=>s?.state.grid===undefined||s.state.grid===null?undefined:s.state.grid.claims.filter(c=>c.owner==='platform').reduce((n,c)=>n+(c.accountedBytes??c.bytes??0),0);
  /** @param {v.InferOutput<typeof sample>|undefined} s */
  const total=s=>s===undefined?undefined:s.process.renderer+s.process.gpu;
  for(const g of data.grid)lines.push(`| ${g.road} | ${mib(platform(g.before))} / ${mib(platform(g.after))} | ${mib(total(g.before))} / ${mib(total(g.after))} | ${JSON.stringify(g.after?.state.grid?.roadTiles??null)} | ${g.error??g.errors.join('; ')} |`);
  lines.push('', 'Raw refusals (including reader diagnostics; none silently removed):');
  for(const r of data.rows)for(const failure of r.failures)lines.push(`- ${r.shard}/${r.ring}: ${failure.replaceAll('\n',' ')}`);
  for(const g of data.grid){if(g.error!==undefined)lines.push(`- road/${g.road}: phase=${g.failurePhase??'unavailable'}, phaseMs=${ms(g.phaseMs)}, elapsedMs=${ms(g.elapsedMs)}: ${g.error.replaceAll('\n',' ')}`);for(const c of g.crossings??[])for(const failure of c.failures)lines.push(`- crossing round${c.round}: ${failure}`);for(const r of g.returns??[])for(const failure of r.failures)lines.push(`- return round${r.round}: ${failure}`);}
  for(const error of data.errors)lines.push(`- ${error.replaceAll('\n',' ')}`);
  lines.push('', 'The original run used levelDebugRows to check a global choice: an absent tileResidency row is a reader diagnostic, not proof of a wrong effective setting. Original failures remain retained. Corrected code labels it unavailable; authorized repair visits keep their own source pin. T5 counts are deduplicated rectangle records and unique MB strings, not a count of all labelled or visible tiles.', '');
  return lines.join('\n');
}
