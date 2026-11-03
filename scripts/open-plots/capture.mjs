#!/usr/bin/env node
// One browser-lane command captures all eight domes and makes sheets for any registered plot list.
// scripts/browser-lane.sh --max 45 node scripts/open-plots/capture.mjs --base=URL --pin=FULL_SHA --plots=slug,slug,slug --out=tmp/plot-domes
import { capturePlotDomes } from '../capture-plot-domes.mjs';
import { readCaptureRegistry } from './capture-inputs.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const slugs = argument('plots')?.split(',');
if (slugs === undefined) throw new Error('Requires --plots=slug[,slug...]');
const pin = argument('pin') ?? '';
const targets = readCaptureRegistry(pin, slugs);
const domes = argument('domes')?.split(',');
const junctionWords = argument('junction')?.split(',').map(Number);
if (junctionWords !== undefined && (junctionWords.length !== 2 || junctionWords.some(word => !Number.isFinite(word)))) throw new Error('Junction requires --junction=latticeX,latticeZ');
const junction = junctionWords === undefined ? undefined : {x:junctionWords[0], z:junctionWords[1]};
const result = await capturePlotDomes({ base: argument('base') ?? '', pin, out: argument('out') ?? '', targets, ...(domes === undefined ? {} : {domes}), ...(junction === undefined ? {} : {junction}) });
console.info(JSON.stringify({source:result.source,complete:result.complete,requestedDomes:result.requestedDomes,plots:result.plots,junctionComplete:result.junction?.complete ?? null}));
