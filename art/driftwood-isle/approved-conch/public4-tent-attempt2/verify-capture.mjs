#!/usr/bin/env node
/** Read-only independent recomputation; no browser, build, pin refresh or output repair. */
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT, hash, same } from './admission.mjs';
import { EVIDENCE, verifyHost, budget } from './build.mjs';
import { checkLiveEvidence, emptyStores, cycleChecks, compareCurrentControl, stationaryRest, interruptionEvidence, reloadChecks } from './checks.mjs';
if(process.argv.length!==2||resolve('.')!==ROOT)throw new Error('Run fixed capture verifier from repository root');
const out=resolve(ROOT,EVIDENCE),read=path=>JSON.parse(readFileSync(join(out,path))),report=read('report.json');
if(report.schema!=='wildshard.conch.public4-tent.complete-cycle.v2'||!report.completed||report.acceptance!==false||report.errors.length)throw new Error('Capture incomplete or failed; retain it without promotion');
same(report.identityBefore,report.identityAfter);same(report.identityAfter,verifyHost());
const data={};
for(const variant of ['control','tent']){
 const run=report.runs[variant];data[variant]={};
 for(const [kind,file]of Object.entries(run.evidence)){
  if(file.path.startsWith('/')||file.path.split('/').includes('..'))throw new Error('Unsafe evidence path');
  const bytes=readFileSync(join(out,file.path));if(bytes.length!==file.bytes||hash(bytes)!==file.sha256)throw new Error('Changed raw evidence');data[variant][kind]=JSON.parse(bytes);
 }
 same(checkLiveEvidence(data[variant],variant),run.cadence);
 if(!emptyStores(run.stores)||run.errors.length)throw new Error('Invalid runtime/storage record');
 for(const screen of run.screens)if(hash(readFileSync(join(out,screen.path)))!==screen.sha256)throw new Error('Changed portrait frame');
 if(!run.video||hash(readFileSync(join(out,run.video.path)))!==run.video.sha256||hash(readFileSync(join(out,variant,'video-framemd5.txt')))!==run.video.frameDigestSha256)throw new Error('Changed/missing full movie evidence');
 if(!run.weightedDamageGeometry?.allFourWeightsAndNativeOrderVerified||hash(readFileSync(join(out,run.weightedDamageGeometry.path)))!==run.weightedDamageGeometry.sha256)throw new Error('Missing exact native weighted geometry audit');
}
same(report.runs.control.stationaryRest,stationaryRest(data.control.trace));if(!report.runs.control.stationaryRest.verified)throw new Error('Control stationary rest missing');
same(report.comparison,compareCurrentControl(data.control,data.tent));
same(report.runs.tent.stationaryRest,stationaryRest(data.tent.trace));same(report.runs.tent.interruptionBoundaries,interruptionEvidence(data.tent.events));
if(report.limitations?.sustainedDisengagedIdle!=='Unsupported/unproven under unchanged AI; not a completed idle requirement')throw new Error('Missing idle limitation');
same(report.limitations.interruptionBoundaries,interruptionEvidence(data.tent.events).filter(r=>!r.actualBoundaryHit).map(r=>r.intended));
const checks=cycleChecks(data.tent,report.runs.tent);
for(const [key,value]of Object.entries(checks))if(value!==true||report.runs.tent.checks[key]!==true)throw new Error(`Failed cycle: ${key}`);
const reload={};for(const[kind,file]of Object.entries(report.runs.tent.reloadEvidence)){
 const bytes=readFileSync(join(out,file.path));if(hash(bytes)!==file.sha256||bytes.length!==file.bytes)throw new Error('Changed reload stream');reload[kind]=JSON.parse(bytes);
}
same(checkLiveEvidence(reload,'tent'),report.runs.tent.reloadCadence);
for(const[key,value]of Object.entries(reloadChecks(reload,report.runs.tent)))if(value!==true||report.runs.tent.checks[key]!==true)throw new Error('Reload proof failed: '+key);
if(!report.runs.tent.checks.reentry||!report.runs.tent.checks.stores||report.totalMovieSeconds>600.5)throw new Error('Reload or movie cap failed');
budget();console.log(JSON.stringify({verified:true,acceptance:false,hostSha256:report.identityAfter.hostSha256,checks:Object.keys(checks).length,scope:'Supported combat/lifecycle and filter parity evidence only. Sustained disengaged idle remains unsupported/unproven; missed interruption boundaries remain explicit. Actual full-motion independent visual review remains required.'}));
