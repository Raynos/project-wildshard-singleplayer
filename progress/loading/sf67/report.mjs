#!/usr/bin/env node
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadingReport } from './benchmark.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = arg('captures'), analysis = arg('analysis'), pin = arg('pin'), output = arg('output');
if (!directory || !analysis || !pin || !output) throw new Error('Requires --captures, --analysis, --pin and --output');
const captures = readdirSync(directory).filter(name => name.endsWith('.json') && !name.endsWith('.trace.json')).map(name => JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
if (!/^[a-f0-9]{40}$/u.test(pin) || captures.some(capture => capture.pin !== pin)) throw new Error('Captures must match the exact report pin');
const report = loadingReport(pin, 'Desktop Chromium/Metal; iPhone 16 Pro 402x874 portrait emulation, DPR 3, 4x CPU; muted', captures, JSON.parse(readFileSync(analysis, 'utf8')));
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
