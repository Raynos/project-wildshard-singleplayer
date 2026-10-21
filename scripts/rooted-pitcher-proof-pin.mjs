/** Root-reviewed, isolated engineering-only input pin. This never grants public or model admission. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = resolve(import.meta.dirname, '..');
export const PIN = 'docs/reviews/rooted-pitcher-app/ROOTED-PITCHER-BUILD-PIN1.json';
export const OUTPUT = 'tmp/rooted-pitcher-app1';
export const CANONICAL = 'test/proof/brine-pitcher-native-owner/source';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const INPUTS = [
  'rooted-pitcher-proof.html', 'src/rootedPitcherProof.ts', 'src/rootedPitcherProofBoot.ts',
  'scripts/rooted-pitcher-proof-pin.mjs', 'scripts/rooted-pitcher-proof-composition.ts',
  'scripts/build-rooted-pitcher-proof.mjs', 'scripts/qa-rooted-pitcher-proof.mjs',
  'test/rooted-pitcher-proof-composition.test.ts',
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json',
  'tsconfig.engine.json', 'tsconfig.game.json', 'tsconfig.sdk.json', 'tsconfig.format.json',
  'tsconfig.commons.json', 'tsconfig.shards.json', 'tsconfig.layers.json', 'vite.config.ts',
  'lint/legacy-line-basis.json', 'lint/legacy-shards.json',
  'node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml',
  'public/assets/physics/rapier.wasm', 'public/assets/models/driftwood-fp/fp-arms.glb',
  `${CANONICAL}/core-runtime-study/metadata.json`, `${CANONICAL}/v3/payload.bin`,
  `${CANONICAL}/v3/native-source.json`, `${CANONICAL}/origins.json`,
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
  if (ENV_FILES.some(path => existsSync(resolve(ROOT, path)))) throw new Error('Isolated proof refuses implicit Vite environment files');
  if (process.env.NODE_ENV !== undefined && process.env.NODE_ENV !== 'production') throw new Error('Isolated proof requires unset or production NODE_ENV');
}
function assertCommittedSources(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/u.test(commit)) throw new Error('Missing exact source commit');
  git(['diff', '--exit-code', '--quiet', commit, '--', ...SOURCE_ROOTS, ...INPUTS.filter(path => !path.startsWith('node_modules/'))]);
}
export function verifyPin() {
  assertBuildEnvironment();
  const pin = JSON.parse(read(PIN));
  if (pin.schema !== 'wildshard.rooted-pitcher.isolated-build-pin.v2' || pin.buildAllowed !== true
    || pin.modelAdmission !== false || pin.publicAdmission !== false || pin.synthetic !== false
    || typeof pin.rootGo !== 'string' || !pin.rootGo.trim() || typeof pin.reviewPath !== 'string'
    || !pin.reviewPath.startsWith('docs/reviews/') || pin.reviewSha256 !== hash(read(pin.reviewPath)))
    throw new Error('Missing exact root-reviewed isolated engineering build pin');
  assertCommittedSources(pin.sourceCommit);
  if (pin.sourceTree !== git(['rev-parse', `${pin.sourceCommit}^{tree}`]) || pin.nodeVersion !== process.version
    || JSON.stringify(pin.sourceRoots) !== JSON.stringify(SOURCE_ROOTS)
    || JSON.stringify(pin.sourceFiles) !== JSON.stringify(sourceInventory())) throw new Error('Native proof complete source closure changed');
  for (const path of INPUTS) if (pin.files?.[path] !== hash(read(path))) throw new Error(`Native proof input changed: ${path}`);
  if (pin.files[`${CANONICAL}/core-runtime-study/metadata.json`] !== 'a1badfcd0a4039ca031356b4d5963450e1f3e472ae1ff427f95276da828cfdfa'
    || pin.files[`${CANONICAL}/v3/payload.bin`] !== '70cc84fae55360f410433857685713a2475a0974cf853740f1ccbde725e6957e')
    throw new Error('This proof requires the exact retained seven-bone Pitcher pack');
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
  const pin = { schema: 'wildshard.rooted-pitcher.isolated-build-pin.v2', synthetic: false, buildAllowed: true, browserAllowed: true,
    modelAdmission: false, publicAdmission: false, reviewedAt: new Date().toISOString(), rootGo, reviewPath,
    sourceCommit, sourceTree: git(['rev-parse', `${sourceCommit}^{tree}`]), nodeVersion: process.version,
    sourceRoots: SOURCE_ROOTS, sourceFiles, untrackedSourceFiles: Object.keys(sourceFiles).filter(path => !tracked.has(path)),
    reviewSha256: hash(read(reviewPath)), files: Object.fromEntries(INPUTS.map(path => [path, hash(read(path))])) };
  writeFileSync(resolve(ROOT, PIN), `${JSON.stringify(pin, null, 2)}\n`, { flag: 'wx' });
  verifyPin(); console.info(JSON.stringify({ path: PIN, sha256: hash(read(PIN)), modelAdmission: false, publicAdmission: false }));
}
