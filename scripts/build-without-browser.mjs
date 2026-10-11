#!/usr/bin/env node
// DS1.5: run a build command with a fail-closed browser preloader inherited by every Node child.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [separator, command, ...args] = process.argv.slice(2);
if (separator !== '--' || command === undefined) throw new Error('Usage: build-without-browser.mjs -- <command> [args]');
const preload = fileURLToPath(new URL('deny-browser.mjs', import.meta.url));
const result = spawnSync(command, args, { stdio: 'inherit', env: {
  ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${JSON.stringify(preload)}`,
} });
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
