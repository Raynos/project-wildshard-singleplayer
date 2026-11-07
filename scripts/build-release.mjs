// One engine build, followed by the complete final-artifact size gate.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePin } from './engine-pin.mjs';
if (existsSync('.vercel/.env.production.local')) process.loadEnvFile('.vercel/.env.production.local');
const pin = validatePin(JSON.parse(readFileSync('engine.pin.json', 'utf8')));
const engine = resolve(process.env.WS_ENGINE_SOURCE ?? 'engine-source');
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: engine, encoding: 'utf8' }).trim();
if (actual !== pin.engine.commit) throw new Error('Build engine does not match immutable release pin');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = resolve(process.env.WS_RELEASE_OUT ?? 'dist');
if (existsSync(out)) throw new Error('Release output already exists: choose a fresh owned output path');
const run = args => execFileSync(args[0], args.slice(1), { cwd: engine, stdio: 'inherit', env: { ...process.env, VERCEL_GIT_COMMIT_SHA: sha, WS_PREVIOUS_DEPLOY_ORIGIN: 'https://wildshard-singleplayer.vercel.app', WILDSHARD_CATALOGUE: 'test/pins/catalogue.json' } });
// build:game owns pins, generated inputs, layers and the web artifact. No
// sharddev, build-shardfiles or author generators run on this release path.
run(['pnpm', 'build:game']);
run(['node', 'scripts/shard-size-gate.mjs', 'dist']);
run(['node', 'scripts/check-devserver.mjs', 'dist']);
const version = JSON.parse(readFileSync(resolve(engine, 'dist/version.json'), 'utf8'));
if (!version.build.startsWith(sha.slice(0, 7) + '-') || version.saveEpoch !== pin.saveEpoch) throw new Error('Built version or save epoch differs from release pin');
cpSync(resolve(engine, 'dist'), out, { recursive: true, errorOnExist: true });
console.log(`Release artifact ${version.build}, epoch ${version.saveEpoch}, engine ${actual}`);
