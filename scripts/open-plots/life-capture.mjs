#!/usr/bin/env node
// scripts/browser-lane.sh node scripts/open-plots/life-capture.mjs --plot=ember-forge --base=URL --pin=SHA --sources=regions.json --out=NEW_DIR
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {captureLifeClip,lifeSummary} from './ob2.mjs';
import {withPlotPage,setHeroCamera,readHeroCamera,HERO_VIEWS} from './hero-page.mjs';

const {values}=parseArgs({options:Object.fromEntries(['plot','base','pin','sources','out'].map(key=>[key,{type:'string'}]))});
for(const key of ['plot','base','pin','sources','out'])if(!values[key])throw new Error(`Requires --${key}`);
const sources=JSON.parse(readFileSync(values.sources,'utf8'));
const reading=await withPlotPage({base:values.base,pin:values.pin,slug:`open-plot-${values.plot}`},async page=>{
  await setHeroCamera(page,HERO_VIEWS[1]);
  return captureLifeClip(page,()=>readHeroCamera(page),{pin:values.pin,view:'road-entry',device:'iPhone 16 Pro',sources},values.out);
});
console.info(lifeSummary(reading));
if(!reading.passesPixelCheck)process.exitCode=2;
