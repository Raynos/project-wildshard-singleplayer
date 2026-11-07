// CI-only checkouts are the installed source packages. Builds never read this
// repository's retired runtime or any shard author project.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePin, verify } from './engine-pin.mjs';
const pin = validatePin(JSON.parse(readFileSync('engine.pin.json', 'utf8')));
const [mode = 'verify'] = process.argv.slice(2);
verify(pin);
const packages = [{ ...pin.engine, directory: 'engine-source' }, ...pin.shards.map(row => ({ ...row, directory: `shard-sources/${row.repo}` }))];
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
  if (pkg.repo !== 'engine') {
    const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
    if (manifest.name !== `@wildshard/${pkg.repo}`) throw new Error(`Invalid installed shard ${pkg.repo}`);
  }
}
console.log(`Installed exact engine ${pin.engine.commit} and seven immutable shard source packages; author compilation disabled`);
