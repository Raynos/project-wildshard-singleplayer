// Every promotion path checks production ancestry and monotonic save epoch.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { productionFloor } from './deploy-pin.mjs';
const [candidate = 'dist/version.json'] = process.argv.slice(2);
const version = JSON.parse(readFileSync(candidate, 'utf8'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const response = await fetch('https://wildshard-singleplayer.vercel.app/version.json', { cache: 'no-store' });
if (!response.ok) throw new Error('Production version unavailable');
const live = await response.json();
if (!Number.isSafeInteger(version.saveEpoch) || version.saveEpoch < 1 || version.saveEpoch < (live.saveEpoch ?? 0)) throw new Error('Release would downgrade save epoch');
if (!version.build.startsWith(sha.slice(0, 7) + '-')) throw new Error('Artifact does not match source SHA');
productionFloor(live.build, sha);
console.log(`Release floor passed: ${live.build} epoch ${live.saveEpoch ?? 0} -> ${version.build} epoch ${version.saveEpoch}`);
