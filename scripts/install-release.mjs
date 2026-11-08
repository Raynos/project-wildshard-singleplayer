// Install the public engine only. Private shard revisions remain provenance
// pins checked by the operator bump; the build reads engine product tarballs.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePin, verify } from './engine-pin.mjs';
const pin = validatePin(JSON.parse(readFileSync('engine.pin.json', 'utf8')));
const [mode = 'verify'] = process.argv.slice(2);
verify(pin);
const packages = [{ ...pin.engine, directory: 'engine-source' }];
for (const pkg of packages) {
  const directory = resolve(pkg.directory);
  if (mode === 'install' && !existsSync(directory)) {
    if (process.env.CI !== 'true') throw new Error('Source checkout installation runs on CI; local work uses the existing repo checkouts');
    execFileSync('git', ['init', '--quiet', directory], { stdio: 'inherit' });
    execFileSync('git', ['remote', 'add', 'origin', `https://github.com/project-wildshard/${pkg.repo}.git`], { cwd: directory, stdio: 'inherit' });
    execFileSync('git', ['fetch', '--depth=1', 'origin', pkg.commit], { cwd: directory, stdio: 'inherit' });
    execFileSync('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: directory, stdio: 'inherit' });
  }
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
  if (actual !== pkg.commit) throw new Error(`Installed ${pkg.repo} differs from pin`);

}
console.log(`Installed exact public engine ${pin.engine.commit}; private shard sources are not build inputs`);
