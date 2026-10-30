// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual CI artifact pack/restore commands.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the workflow transport boundary as well as real archives.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('exact per-leg archives preserve bytes and refuse corrupt, missing, mixed or unsafe transfers without retry', () => {
  const result = spawnSync('python3', ['test/test_boot_dist.py'], { encoding: 'utf8', timeout: 10_000 });
  expect(result.status, result.stderr + result.stdout).toBe(0);
  expect(result.stderr).toContain('Ran 13 tests');
});

test('smoke downloads each exact source-run leg directly without a full-dist relay or retry', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const central = workflow.split('\n  journeys:\n')[1]?.split('\n  boot-verdict:\n')[0];
  if(central===undefined)throw new Error('Missing prepared browser wave');
  expect(central).toContain('name: boot-dist-manifest');
  expect(central).not.toContain('boot-dist.tar');
  expect(central).not.toContain('run watch');
  expect(workflow).toMatch(/run-id: \$\{\{ github\.run_id \}\}/u);
  expect(workflow).toContain('python3 scripts/boot-dist.py restore');
  const phone=workflow.split('\n  phone-route:\n')[1]?.split('\n  journeys:\n')[0];
  if(phone===undefined)throw new Error('Missing early phone job');
  expect(phone).toContain('continue-on-error: true');
  expect(phone).not.toContain('needs: prepare');
  expect(central).toContain('timeout-minutes: 20');
  const parts=/part: \[([^\]]+)\]/u.exec(central)?.[1]?.split(',').map(part=>part.trim());
  const core=['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer'];
  expect(parts).toHaveLength(core.length);expect(new Set(parts)).toEqual(new Set(core));
  expect(phone).toContain('SMOKE_PART: phone-route');
  expect(phone).toContain('name: boot-dist-phone-route');
  expect(workflow).toMatch(/SMOKE_PART: \$\{\{ matrix\.part \}\}/u);
  expect(workflow).not.toContain('title-quarantine');
  const runner = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
  expect(runner).not.toContain('quarantinedTitle');
  expect(runner).not.toContain('titleOnly');
  expect(runner).toMatch(/^ {4}await observeTitleCapture\(page, join\(out, `\$\{receipt\}-title`\), \(\) => captureBootFrame\(page, 'title', deadline, frames\)\);$/mu);
});


test('native phone inventory and admission use the matching selected Xcode', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const phone=workflow.split('\n  phone-route:\n')[1]?.split('\n  journeys:\n')[0];
  if(phone===undefined)throw new Error('Missing early phone job');
  const selection = phone.indexOf('- name: Select the phone Simulator toolchain');
  const inventory = phone.indexOf('- name: Prepare isolated Safari while the build runs');
  expect(selection).toBeGreaterThan(-1);
  expect(inventory).toBeGreaterThan(selection);
  const step = phone.slice(selection, inventory);
  expect(step).toContain('DEVELOPER_DIR: /Applications/Xcode_26.2.app/Contents/Developer');
  expect(step).toContain('test -d "$DEVELOPER_DIR"');
  expect(step).toContain('xcodebuild -version');
  expect(step).toContain('xcrun --find simctl');
  expect(step).toContain('test "$(xcrun --sdk iphonesimulator --show-sdk-version)" = 26.2');
  expect(step).toContain('>> "$GITHUB_ENV"');
  expect(workflow).toContain('PHONE_ROUTE_MODE: report-only');
  const preparation=inventory;
  const transfer=phone.indexOf('- name: Start exact-leg transfer clock');
  const prepared=phone.indexOf('--wait-for-prepare');
  // First native launch has no install or artifact IO on its own Mac.
  for(const installer of ['brew install ios-webkit-debug-proxy','pnpm install --frozen-lockfile','pnpm exec playwright install chromium webkit']) {
    const install=phone.indexOf(installer==='pnpm exec playwright install chromium webkit'?'pnpm exec playwright install webkit':installer);
    expect(install).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(preparation);
    expect(install).toBeLessThan(prepared);
  }
  expect(prepared).toBeGreaterThan(preparation);expect(transfer).toBeGreaterThan(prepared);
  expect(phone).not.toContain('--select-engine');
  expect(phone).not.toMatch(/--prepare-simulator[^\n]*&\s*$/mu);
  expect(phone).toContain("if: steps.phone.outputs.engine == 'webkit'");
  expect(phone).toContain('scripts/sim-lane.sh release wildshard-iphone');
  expect(workflow).toContain('PHONE_SIMULATOR_PREPARATION=$receipt');
  expect(workflow).toContain('--prepare-simulator');expect(workflow).toContain('--route=entry');
  expect(workflow).toContain("HOMEBREW_NO_AUTO_UPDATE: '1'");
  expect(workflow).toContain('ios_webkit_debug_proxy --version');
});
