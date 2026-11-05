// LAYER-PURITY LP6 (E405): the labelled set for the `layer-purity` decision set, built from git — each engine file
// before its E405 move (content in the engine: label 1) and after it, plus untouched generic engine files (label 0).
//   node scripts/decide/layer-purity-pilot.mjs <out.jsonl>            write the items ({ state, label, id } per line)
//   scripts/decide/decide.sh batch layer-purity --images <out.jsonl> --out <results.jsonl>
//   node scripts/decide/layer-purity-pilot.mjs --score <out.jsonl> <results.jsonl>
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CONTENT = [   // [the commit that moved it out, the engine path before]
  ['0802b3d00', 'src/engine/client/audio/gen.ts'], ['dd2e42a12', 'src/engine/client/ui/icons.ts'], ['4c50424b9', 'src/engine/entities/species/elk.ts'],
  ['4c50424b9', 'src/engine/entities/species/deer.ts'], ['d47cbc07b', 'src/engine/ai/NightBrain.ts'], ['fab438d4a', 'src/engine/client/world/blenderArea.ts'],
  ['49ffd9fd4', 'src/engine/client/ui/HurtArc.ts'], ['668484797', 'src/engine/client/world/forest/treeSpecies.ts'], ['b804b4395', 'src/engine/models/creatures.ts'],
  ['bd2e547d2', 'src/engine/audio/score/wildshard-theme.ts'], ['4c42cca55', 'src/engine/world/interact/models.ts'], ['2c2e229f9', 'src/engine/server/entities/AnimalManager.ts'],
];
const GENERIC = [   // at HEAD: the cleaned files, and engine files E405 never touched
  'src/engine/client/audio/gen.ts', 'src/engine/client/ui/icons.ts', 'src/engine/client/world/blenderArea.ts', 'src/engine/client/ui/HurtArc.ts',
  'src/engine/client/world/forest/treeSpecies.ts', 'src/engine/client/audio/score/score.ts', 'src/engine/shared/world/interact/types.ts', 'src/engine/server/entities/AnimalManager.ts',
  'src/engine/shared/physics/query.ts', 'src/engine/shared/core/rng.ts', 'src/engine/client/world/lowpolyKit.ts', 'src/engine/client/input/InputService.ts',
];
const show = (rev, path) => execFileSync('git', ['show', `${rev}:${path}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const state = (path, code) => `Layer: engine. File: ${path}\n\n${code.slice(0, 13000)}`;

if (process.argv[2] === '--score') {
  const items = readFileSync(process.argv[3], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const results = readFileSync(process.argv[4], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  let tp = 0, fp = 0, fn = 0, tn = 0;
  results.forEach((r, i) => {
    const p = r.answers?.content?.noul ?? Number.NaN, label = items[i].label;
    const flagged = p >= 0.5;
    if (flagged && label) tp++; else if (flagged) fp++; else if (label) fn++; else tn++;
    console.log(`${label ? 'content' : 'generic'}  p=${Number(p).toFixed(3)}  ${items[i].id}`);
  });
  console.log(`caught ${tp}/${tp + fn} content files, false alarms ${fp}/${fp + tn} generic files`);
} else {
  const out = [
    ...CONTENT.map(([commit, path]) => ({ id: `${path}@${commit}^`, label: 1, state: state(path, show(`${commit}^`, path)) })),
    ...GENERIC.map((path) => ({ id: `${path}@HEAD`, label: 0, state: state(path, show('HEAD', path)) })),
  ];
  writeFileSync(process.argv[2], `${out.map((o) => JSON.stringify({ images: [], state: o.state, id: o.id, label: o.label })).join('\n')}\n`);
  console.log(`${out.length} items → ${process.argv[2]}`);
}
