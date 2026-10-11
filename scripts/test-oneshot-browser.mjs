#!/usr/bin/env node
// Milestone proof only. The caller supplies an installed seat, its built Mesa product and the unchanged read-deny profile.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { createInterface } from 'node:readline';

const [seat, product, profile] = process.argv.slice(2);
assert.ok(seat && product && profile, 'Supply installed SEAT, built PRODUCT and original PROFILE');
assert.ok(!existsSync('.git/quiet'), 'Wait for quiet release');
const helper = resolvePath(seat, 'tools', `browser-proof-${process.pid}`), channel = resolvePath(seat, `browser-channel-${process.pid}`);
mkdirSync(helper, { recursive: true });
for (const file of ['seat-browser.mjs', 'seat-browser.d.mts', 'browser-channel.mjs', 'browser-channel.d.mts']) cpSync(resolvePath('scripts/oneshot', file), resolvePath(helper, file));
const index = resolvePath(product, 'index.html'), original = readFileSync(index);
// A forbidden renderer request must be blocked by the browser route before it reaches the network.
writeFileSync(index, Buffer.concat([original, Buffer.from('\n<img hidden src="https://example.com/seat-network-probe.png" alt="">\n')]));
const broker = spawn(process.execPath, ['scripts/oneshot/browser-broker.mjs', seat, product, channel, `sp-x5-os-g7-${process.pid}`], { stdio: ['ignore', 'pipe', 'inherit'] });
const exited = new Promise(resolve => { broker.once('exit', (code, signal) => { resolve({ code, signal }); }); });
const lines = createInterface({ input: broker.stdout });
const sandbox = (...args) => spawnSync('/usr/bin/sandbox-exec', ['-f', profile, ...args], { cwd: seat, encoding: 'utf8', timeout: 60_000 });
const command = (...args) => execFileSync('/usr/bin/sandbox-exec', ['-f', profile, process.execPath, resolvePath(helper, 'seat-browser.mjs'), channel, ...args], { cwd: seat, encoding: 'utf8', timeout: 60_000 });
try {
  let ready = false;
  const timer = setTimeout(() => { broker.kill('SIGTERM'); }, 120_000);
  try { for await (const line of lines) if (line.startsWith('Browser relay ready:')) { ready = true; break; } }
  finally { clearTimeout(timer); }
  assert.ok(ready, 'Broker never became ready');
  const text = JSON.parse(command('text')); assert.ok(text.deniedNetwork > 0, 'Forbidden renderer request was not observed');
  const scene = JSON.parse(command('scene')), equipped = JSON.parse(command('equipment'));
  assert.equal(scene.creatures.length, 4);
  assert.ok(scene.creatures.every(row => row.bound && row.attached && row.visible && row.finitePose && row.matchesNative));
  assert.ok(equipped.mounted && equipped.visible && equipped.sameAsset && equipped.meshes > 0);
  const authorProof = `import {seatProofPage} from ${JSON.stringify(resolvePath(helper, 'seat-browser.mjs'))};
import {proveSceneClient,proveEquippedItemClient} from '@wildshard/sdk/headless';
const page=seatProofPage(${JSON.stringify(channel)});
console.info(JSON.stringify({scene:await proveSceneClient(page,{creatures:['goat.0','goat.1','goat.2','hawk.0'],selectedInteraction:null}),equipped:await proveEquippedItemClient(page,${JSON.stringify(equipped.id)},${JSON.stringify(equipped.asset)})}));`;
  const sdk = sandbox(process.execPath, '--input-type=module', '-e', authorProof);
  assert.equal(sdk.status, 0, sdk.stderr); assert.equal(JSON.parse(sdk.stdout).scene.creatures.length, 4);
  const deniedRead = sandbox('/bin/cat', resolvePath('src/engine/package.json'));
  assert.notEqual(deniedRead.status, 0); assert.equal(deniedRead.stdout, ''); assert.match(deniedRead.stderr, /Operation not permitted/u);
  const deniedNetwork = sandbox('/usr/bin/curl', '--max-time', '5', '--noproxy', '*', '-I', 'https://github.com');
  assert.notEqual(deniedNetwork.status, 0);
  const deniedLocalNetwork = sandbox('/usr/bin/curl', '--max-time', '5', '--noproxy', '*', text.url);
  assert.notEqual(deniedLocalNetwork.status, 0);
  const refused = sandbox(process.execPath, '--input-type=module', '-e', `import {browserRequest} from ${JSON.stringify(resolvePath(helper, 'browser-channel.mjs'))}; await browserRequest(${JSON.stringify(channel)}, {op:'evaluate',code:'() => fetch("https://github.com")'});`);
  assert.notEqual(refused.status, 0); assert.match(refused.stderr, /Only installed SDK read-only proof callbacks/u);
  assert.equal(JSON.parse(command('key', 'ArrowUp', '50')).inputDelivered, true);
  command('close'); assert.deepEqual(await exited, { code: 0, signal: null });
  assert.equal(existsSync(resolvePath(channel, 'ready.json')), false);
  console.info(JSON.stringify({ pass: true, actualViews: 4, equipped: equipped.id, sdkProofInsideSeat: true,
    sourceReadDenied: true, directNetworkDenied: true, localNetworkDenied: true, rendererNetworkDenied: text.deniedNetwork,
    arbitraryEvaluationDenied: true, realKeyDelivered: true, browserClosed: true }));
} finally {
  lines.close(); if (broker.exitCode === null && broker.signalCode === null) { broker.kill('SIGTERM'); await exited; }
  writeFileSync(index, original);
}
