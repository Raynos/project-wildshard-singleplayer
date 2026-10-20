/** Root-reviewed, private engineering-only input pin. This never grants public or model admission. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = resolve(import.meta.dirname, '..');
export const PIN = 'docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-BROWSER-PIN.json';
export const OUTPUT = 'tmp/native-owner-browser-proof';
export const CANONICAL = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const INPUTS = [
  'scripts/native-owner-proof-pin.mjs', 'scripts/build-native-owner-proof.mjs',
  'scripts/qa-native-owner-proof.mjs', 'scripts/qa-native-owner-observation.mjs',
  'scripts/qa-native-owner-observation.d.mts',
  'src/nativeOwnerProofBoot.ts', 'src/practice.ts', 'src/practiceContent.ts', 'src/practiceLevel.ts',
  'src/shards/driftwood-isle/generators/nativeOwnerProof.ts', 'src/shards/driftwood-isle/data/nativeOwnerProof.json',
  'src/shards/driftwood-isle/generators/driftwoodRegularCombat.ts',
  'src/game/practice/PracticeNativeActor.ts', 'src/game/practice/PracticeCreature.ts',
  'src/game/practice/PracticePlayer.ts', 'src/game/practice/PracticeLoot.ts',
  'src/game/practiceDemo/startPracticeDemo.ts', 'src/game/plugin/animation.ts',
  'src/game/plugin/channelPrograms.ts', 'src/game/plugin/practicePoseContract.ts',
  'src/game/plugin/geometry.ts', 'src/engine/entities/AnimalView.ts',
  'src/engine/entities/animalRig.ts', 'src/engine/entities/AnimalSim.ts',
  'src/engine/entities/nativeCorpseOwner.ts', 'src/engine/physics/nativeRigidCorpse.ts',
  'src/engine/physics/rigidCorpse.ts', 'src/engine/physics/ragdoll.ts',
  'src/engine/physics/CharacterMotor.ts', 'src/engine/sim.ts', 'src/engine/core/Game.ts',
  'src/game/weapons/Sword.ts', 'src/game/weapons/starterMeleeProfile.ts',
  'practice.html', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json',
  'tsconfig.engine.json', 'tsconfig.game.json', 'tsconfig.sdk.json', 'tsconfig.format.json',
  'tsconfig.commons.json', 'tsconfig.shards.json', 'tsconfig.layers.json', 'vite.config.ts',
  'lint/legacy-line-basis.json', 'lint/legacy-shards.json',
  'node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml', 'public/assets/physics/rapier.wasm',
  'public/assets/models/driftwood-fp/fp-arms.glb', `${CANONICAL}/metadata.json`, `${CANONICAL}/payload.bin`,
];
const SOURCE_ROOTS = ['src', 'scripts', 'vite'];
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const read = path => {
  if (path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..')) throw new Error('Unsafe native proof pin path');
  return readFileSync(resolve(ROOT, path));
};
export function inventory(directory, sourceTree = false) {
  const files = {};
  const visit = (at, prefix = '') => {
    if (lstatSync(at).isSymbolicLink()) throw new Error('Symlink in native proof inventory');
    for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (sourceTree && entry.name === 'node_modules') continue;
      const name = `${prefix}${entry.name}`, path = join(at, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink in native proof inventory');
      if (entry.isDirectory()) visit(path, `${name}/`);
      else if (entry.isFile()) files[name] = hash(readFileSync(path));
      else throw new Error('Unsupported native proof inventory entry');
    }
  };
  visit(directory); return files;
}
/** Complete pre-build source closure, including generated/untracked source bytes; dependencies use both locks. */
export function sourceInventory() {
  return Object.fromEntries(SOURCE_ROOTS.flatMap(root => Object.entries(inventory(resolve(ROOT, root), true)).map(([path, digest]) => [`${root}/${path}`, digest])));
}
function assertBuildEnvironment() {
  // Vite would otherwise load these implicitly. Never read or publish environment/credential contents.
  if (ENV_FILES.some(path => existsSync(resolve(ROOT, path)))) throw new Error('Private proof refuses implicit Vite environment files');
  if (process.env.NODE_ENV !== undefined && process.env.NODE_ENV !== 'production') throw new Error('Private proof requires unset or production NODE_ENV');
}
function assertCommittedSources(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/u.test(commit)) throw new Error('Missing exact source commit');
  git(['diff', '--exit-code', '--quiet', commit, '--', ...SOURCE_ROOTS, ...INPUTS.filter(path => !path.startsWith('node_modules/'))]);
}
export function verifyPin() {
  assertBuildEnvironment();
  const pin = JSON.parse(read(PIN));
  if (pin.schema !== 'wildshard.native-owner.private-build-pin.v2' || pin.buildAllowed !== true
    || pin.modelAdmission !== false || pin.publicAdmission !== false || pin.synthetic !== true
    || typeof pin.rootGo !== 'string' || !pin.rootGo.trim() || typeof pin.reviewPath !== 'string'
    || !pin.reviewPath.startsWith('docs/reviews/') || pin.reviewSha256 !== hash(read(pin.reviewPath)))
    throw new Error('Missing exact root-reviewed private engineering build pin');
  assertCommittedSources(pin.sourceCommit);
  if (pin.sourceTree !== git(['rev-parse', `${pin.sourceCommit}^{tree}`]) || pin.nodeVersion !== process.version
    || JSON.stringify(pin.sourceRoots) !== JSON.stringify(SOURCE_ROOTS)
    || JSON.stringify(pin.sourceFiles) !== JSON.stringify(sourceInventory())) throw new Error('Native proof complete source closure changed');
  for (const path of INPUTS) if (pin.files?.[path] !== hash(read(path))) throw new Error(`Native proof input changed: ${path}`);
  if (pin.files[`${CANONICAL}/metadata.json`] !== 'c6e7f3853181da1101ea771acd5f99e32c53dacbcbb842e5e2bdb93d41b85e9d'
    || pin.files[`${CANONICAL}/payload.bin`] !== 'a820f64e2252058c7a02fe3ce551e704e4262990c59b6d28a9b323ee1356d610')
    throw new Error('This proof requires the exact canonical test pack');
  return pin;
}
const command = process.argv.at(1);
if (command !== undefined && import.meta.url === pathToFileURL(resolve(command)).href) {
  const args = process.argv.slice(2);
  if (args.length !== 3) throw new Error('Expected mode, review path and explicit root GO');
  const [mode, reviewPath, rootGo] = args;
  if (mode !== '--pin-reviewed' || !reviewPath.startsWith('docs/reviews/') || !rootGo.trim())
    throw new Error('Root only: --pin-reviewed docs/reviews/<exact-review> "explicit root GO"');
  if (existsSync(resolve(ROOT, PIN))) throw new Error('Preserve the existing proof pin');
  assertBuildEnvironment();
  const sourceCommit = git(['rev-parse', 'HEAD']); assertCommittedSources(sourceCommit);
  const sourceFiles = sourceInventory(), tracked = new Set(git(['ls-tree', '-r', '--name-only', sourceCommit, '--', ...SOURCE_ROOTS]).split('\n'));
  const pin = { schema: 'wildshard.native-owner.private-build-pin.v2', synthetic: true, buildAllowed: true,
    modelAdmission: false, publicAdmission: false, reviewedAt: new Date().toISOString(), rootGo, reviewPath,
    sourceCommit, sourceTree: git(['rev-parse', `${sourceCommit}^{tree}`]), nodeVersion: process.version,
    sourceRoots: SOURCE_ROOTS, sourceFiles, untrackedSourceFiles: Object.keys(sourceFiles).filter(path => !tracked.has(path)),
    reviewSha256: hash(read(reviewPath)), files: Object.fromEntries(INPUTS.map(path => [path, hash(read(path))])) };
  writeFileSync(resolve(ROOT, PIN), `${JSON.stringify(pin, null, 2)}\n`, { flag: 'wx' });
  verifyPin(); console.info(JSON.stringify({ path: PIN, sha256: hash(read(PIN)), modelAdmission: false, publicAdmission: false }));
}
