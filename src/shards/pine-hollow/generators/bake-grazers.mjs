#!/usr/bin/env node
// Pine's authored species and hull-only skeletons, serialized for the existing
// species/look/model owners. No procedural skeleton construction runs in play.
import { writeFileSync } from 'node:fs';
import { DEER } from './deerRows.ts';
import { ELK } from './elkRows.ts';
import { hullBody } from './grazerBodies.ts';

export function grazerRows() {
  return Object.fromEntries([DEER, ELK].map(row => [row.kind, {
    ...row, id: `pine.creature.${row.kind}`, body: hullBody(row.kind)(),
  }]));
}

if (import.meta.main) writeFileSync(new URL('../data/grazers.generated.json', import.meta.url), `${JSON.stringify(grazerRows())}\n`);
