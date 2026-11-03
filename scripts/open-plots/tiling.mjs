#!/usr/bin/env node
// G950: one verified report per selected plot, or the registered batch. No generation.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/tiling.mjs --plot=all --out=tmp/plot-tiles
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {plotTilingReport} from './ob2.mjs';

const ideas=['frostline-peaks','lantern-bayou','ember-forge','mosslight-ruins','coral-drift','fossil-badlands','desert-ruin','sky-harbor','starfall-observatory','thin-ice','clockwork-canyon','alien-plain','sky-race','showcase-template'];
const {values}=parseArgs({options:{plot:{type:'string'},out:{type:'string'}}});
const idea=values.plot?.replace(/^open-plot-/u,'');
if(idea===undefined||values.out===undefined||idea!=='all'&&!ideas.includes(idea))throw new Error('Requires --plot=<registered idea|all> --out=NEW_DIR');
const selected=idea==='all'?ideas:[idea],reports=[];
// Admit the full selection before publishing any output. Missing CURRENT refuses.
for(const plot of selected)reports.push(await plotTilingReport(plot));
const out=resolve(values.out);mkdirSync(out,{recursive:true});
for(const {report,markdown}of reports){
  writeFileSync(join(out,`${report.slug}.json`),`${JSON.stringify(report,null,2)}\n`);
  writeFileSync(join(out,`${report.slug}.md`),`${markdown}\n`);
}
const rows=reports.map(({report})=>({slug:report.slug,tiles:report.tiles.length,ring:report.ring,
  indexHash:report.provenance?.indexHash,l0:report.l0,l1:report.l1,tallest:report.tallest,overCaps:report.overCaps}));
writeFileSync(join(out,'index.json'),`${JSON.stringify({protocol:'open-plot-g950/1',scope:'Verified declarations, not live memory',plots:rows},null,2)}\n`);
console.info('| plot | tiles | L0 GPU MB | L0 triangles | L0 draws | tallest m |\n|---|---:|---:|---:|---:|---:|');
for(const row of rows)console.info(`| ${row.slug} | ${row.tiles} | ${(row.l0.gpu/1e6).toFixed(3)} | ${row.l0.triangles} | ${row.l0.draws} | ${row.tallest.toFixed(2)} |`);
console.info(`G950 verified declarations: ${reports.length} plot(s) → ${out}`);
