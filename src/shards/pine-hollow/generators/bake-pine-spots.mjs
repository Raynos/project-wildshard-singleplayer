#!/usr/bin/env node
// DS1.5: run the same native world/quest construction as physics, without a page or a draw.
import process from 'node:process';

process.argv.push('--spots');
await import('./bake-pine-physics.mjs');
