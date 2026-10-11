#!/usr/bin/env node
// DS1.5: quest placement uses the same real native construction as the physics producer, without a page.
import process from 'node:process';

process.argv.push('--spots');
await import('./bake-driftwood-physics.mjs');
