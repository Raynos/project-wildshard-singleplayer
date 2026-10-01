#!/usr/bin/env node
// E357 F5: measured coverage can rise, never fall. CI checks; --update explicitly records an increase.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const METRICS = ['lines', 'statements', 'functions', 'branches'];
const ROOT = fileURLToPath(new URL('../', import.meta.url));

function percent(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${name} must be a finite percentage in [0, 100]`);
  return Math.round(value * 100) / 100;
}

function record(value, name) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}

function measured(summary) {
  const total = record(record(summary, 'summary').total, 'summary.total');
  return Object.fromEntries(METRICS.map((key) => [key, percent(record(total[key], `summary.total.${key}`).pct, key)]));
}

function baseline(value) {
  const data = record(value, 'baseline');
  return Object.fromEntries(METRICS.map((key) => [key, percent(data[key], `baseline.${key}`)]));
}

export function main(args = process.argv.slice(2)) {
  let summaryFile = resolve(ROOT, 'coverage/coverage-summary.json');
  let baselineFile = resolve(ROOT, 'test/coverage-ratchet.json');
  let update = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--update') { update = true; continue; }
    if (arg !== '--summary' && arg !== '--baseline') throw new Error(`unknown argument: ${arg}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing path after ${arg}`);
    if (arg === '--summary') summaryFile = resolve(value);
    else baselineFile = resolve(value);
  }
  const current = measured(JSON.parse(readFileSync(summaryFile, 'utf8')));
  if (!existsSync(baselineFile)) {
    if (!update) throw new Error(`missing coverage baseline: ${baselineFile}; measure coverage and run --update`);
    writeFileSync(baselineFile, `${JSON.stringify(current, null, 2)}\n`);
    console.info('Coverage baseline initialized:', current);
    return 0;
  }
  const previous = baseline(JSON.parse(readFileSync(baselineFile, 'utf8')));
  const drops = METRICS.filter((key) => current[key] < previous[key]);
  if (drops.length > 0) {
    for (const key of drops) console.error(`Coverage dropped: ${key} ${current[key].toFixed(2)}% < ${previous[key].toFixed(2)}%`);
    return 1; // --update never forgives a regression, including a mixed rise/drop.
  }
  if (update && METRICS.some((key) => current[key] > previous[key])) {
    writeFileSync(baselineFile, `${JSON.stringify(current, null, 2)}\n`);
    console.info('Coverage baseline raised:', current);
  } else console.info('Coverage ratchet passed:', current);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(); } catch (error) {
    console.error(`Coverage ratchet: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
