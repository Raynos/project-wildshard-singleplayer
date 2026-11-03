#!/usr/bin/env node
// Historical RM2/RM3/END CLI; the shared capture retains its exact camera and entry protocol.
import { capturePlotDomes } from './capture-plot-domes.mjs';

const argument = (name, fallback = '') => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const milestone = argument('milestone', 'RM2');
if (milestone !== 'RM2' && milestone !== 'RM3' && milestone !== 'END') throw new Error('Invalid dome milestone');
const out = argument('out');
if (!out) throw new Error('Requires --out');
await capturePlotDomes({
  base: argument('base'), pin: argument('pin'), out,
  targets: [{ slug: 'open-plot-night-market', instance: argument('instance', 'open-plot-nw'), cameras: 'art/grid/round-63-night-market-domes' }],
  milestone, flatOutput: true, domes: argument('domes', 'A1,A2,D1,D2').split(','), clip: Number(argument('clip', '0')),
});
