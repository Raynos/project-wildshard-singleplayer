#!/usr/bin/env node
// Same ordinary rules and custom plugin as the staged fast-lint worker.
import { resolve } from 'node:path';
import { fastLint } from './precommit-checks.mjs';

const files = process.argv.slice(2);
if (files.some(file => file.startsWith('-'))) {
  console.error('lint:fast: expected file paths, not linter options');
  process.exitCode = 2;
} else {
  try { fastLint(files, resolve('node_modules/.bin/oxlint')); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
