/** Read-only proposed identity. Root alone may write an execution pin after independent review. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const ROOT = resolve(import.meta.dirname, '..');
export const OUTPUT = 'tmp/actual-conch-native-proof';
export const PIN = 'docs/reviews/conch-authoritative-motion-contract/PRIVATE-ACTUAL-CONCH-BROWSER-PIN1.json';
export const SOURCE = 'art/driftwood-isle/approved-conch/articulated-source-candidate1';
export const MOTION = 'art/driftwood-isle/approved-conch/articulated-complete-motion1/motion.json';
export const ACTUAL_SHA256 = Object.freeze({
  [`${SOURCE}/model.json`]: '560abb099f474ddb86733f143e39652874298bba67f15fd1da7a63f1c4e91b3e',
  [`${SOURCE}/metadata.json`]: '6905f20ced953176fb0e316a8d18287735eef0fb996cd58af43ae918b8f87989',
  [`${SOURCE}/payload.bin`]: '9a1176e701ec58b6470d9898c11677512344e455c84da3bde84e1b5cee5364ed',
  [`${SOURCE}/contract.json`]: '37e10f67124db7c7e43eb5670643036ed8153a074314789cd030ca66553d6952',
  'test/proof/conch-grounded-source/model.json': '560abb099f474ddb86733f143e39652874298bba67f15fd1da7a63f1c4e91b3e',
  'test/proof/conch-grounded-source/metadata.json': '6905f20ced953176fb0e316a8d18287735eef0fb996cd58af43ae918b8f87989',
  'test/proof/conch-grounded-source/payload.bin': '9a1176e701ec58b6470d9898c11677512344e455c84da3bde84e1b5cee5364ed',
  'test/proof/conch-grounded-source/recipe.json': '2dc438caca6a3396e48f9ae51a600c83a7cbf97ebd5ffd4a7654e7b8b14e5ed0',
  'test/proof/conch-articulated-complete-motion/motion.json': '494d35c49765df3623a6943b9834ecc7d244ae6ba0ba3b53a9ffe6f4e09d9596',
  [`${SOURCE}/recipe.json`]: '2dc438caca6a3396e48f9ae51a600c83a7cbf97ebd5ffd4a7654e7b8b14e5ed0',
  [MOTION]: '494d35c49765df3623a6943b9834ecc7d244ae6ba0ba3b53a9ffe6f4e09d9596',
  'test/proof/conch-articulated-complete-motion/decision.wasm': '2393ffa90be5023cc70b69978b4328579091e171481b06b2ad25c5e63affae02',
});
export const COMPOSITION_INPUTS = [
  'actual-conch-native-proof.html', 'src/actualConchProof.ts', 'src/actualConchProofBoot.ts',
  'src/shards/driftwood-isle/generators/actualConchProof.ts',
  'scripts/actual-conch-native-proof-composition.ts', 'scripts/actual-conch-native-proof-inputs.mjs',
  'test/actual-conch-native-proof-composition.test.ts',
  'src/practiceContent.ts', 'src/practiceLevel.ts', 'src/practicePresentation.ts', 'src/practiceLighting.ts',
  'src/practiceCanvas.ts', 'src/game/practiceDemo/startPracticeDemo.ts', 'src/engine/practice/TrainingArena.ts',
  'src/game/practice/PracticeCreature.ts', 'src/game/practice/PracticeNativeActor.ts',
  'src/engine/entities/nativeCorpseOwner.ts', 'src/engine/physics/nativeRigidCorpse.ts',
  'src/game/plugin/animation.ts', 'src/game/plugin/channelPrograms.ts', 'src/game/plugin/practicePoseContract.ts',
  'src/game/plugin/practiceFootContact.ts', 'src/game/plugin/geometry.ts',
  'src/shards/driftwood-isle/generators/driftwoodRegularCombat.ts',
  'src/shards/driftwood-isle/behaviour/conchDuelist.as',
  'art/driftwood-isle/approved-conch/articulated-complete-motion1/RESULT.md',
  'art/driftwood-isle/approved-conch/articulated-complete-motion1/integration.json',
  'art/driftwood-isle/approved-conch/articulated-complete-motion1/checkpoint-manifest.json',
  'test/proof/conch-articulated-complete-motion/inputs.json',
  'test/proof/conch-articulated-complete-motion/decision-inputs.json',
  'test/proof/conch-articulated-complete-motion/decision.json',
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json',
  'tsconfig.engine.json', 'tsconfig.game.json', 'tsconfig.sdk.json', 'tsconfig.format.json',
  'tsconfig.commons.json', 'tsconfig.shards.json', 'tsconfig.layers.json', 'vite.config.ts',
  'lint/legacy-line-basis.json', 'lint/legacy-shards.json',
  'node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml', 'public/assets/physics/rapier.wasm',
  'public/assets/models/driftwood-fp/fp-arms.glb',
  ...Object.keys(ACTUAL_SHA256),
];
export const PROPOSED_POLICY = Object.freeze({
  schema: 'wildshard.actual-conch.private-build-proposal.v1', buildAllowed: false, browserAllowed: false,
  synthetic: false, modelAdmission: false, publicAdmission: false, physicalGate: 'FAILED',
  output: OUTPUT, entry: 'actual-conch-native-proof.html', rootGo: null,
  requiredPin: PIN, sourceRoots: ['src', 'scripts', 'vite'],
  requirements: ['root source checkpoint', 'independent exact-source review', 'explicit root GO',
    'complete source inventory including untracked source', 'exact node version and both dependency locks',
    'no implicit Vite environment files', 'exact built Conch decision guest hash',
    'pre/post input verification and resolved-source/host/product receipts'],
});
export function verifyActualConchSources() {
  for (const [path, expected] of Object.entries(ACTUAL_SHA256)) {
    const actual = createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex');
    if (actual !== expected) throw new Error(`Actual Conch source changed: ${path}`);
  }
  return PROPOSED_POLICY;
}
