// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual shell port fence without compiling the app.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns only its isolated registry and build directories.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- An actual listener proves a successful HTTP endpoint cannot be mistaken for ownership.
import { createServer, type Server } from 'node:http';
// oxlint-disable-next-line import/no-nodejs-modules -- Place fixture files outside the checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the fixture directories and real launcher.
import { join, resolve as resolvePath } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Read this fixture process identity for the real process-group ownership check.
import process from 'node:process';
import { expect, it } from 'vitest';

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Missing fixture listener');
  return address.port;
}
async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(); }); });
}

it('refuses an explicitly occupied unregistered port before allocating or building', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-port-'));
  const server = createServer((_request, response) => { response.end('old preview'); });
  try {
    const port = await listen(server);
    const result = spawnSync('bash', [resolvePath('scripts/serve-build.sh'), '--port', String(port)], {
      cwd: dir, encoding: 'utf8', timeout: 5000,
      env: { ...process.env, SERVE_REG_DIR: join(dir, 'registry'), SERVE_BUILD_DIR: join(dir, 'builds') },
    });
    expect(result.status).toBe(64);
    expect(result.stderr).toContain(`port ${port} is reserved or already listening`);
    expect(result.stdout).not.toContain('http://');
    expect(readdirSync(join(dir, 'builds'))).toEqual([]);
    expect(readdirSync(join(dir, 'registry'))).toEqual([]);
    expect(server.listening).toBe(true);
  } finally { await close(server); rmSync(dir, { recursive: true, force: true }); }
});

it('accepts only a listener in the detached preview process group', async () => {
  const server = createServer((_request, response) => { response.end('ready'); });
  try {
    const port = await listen(server);
    const shell = readFileSync('scripts/serve-build.sh', 'utf8');
    const start = shell.indexOf('preview_owns_port() {'), end = shell.indexOf('\nready=0', start);
    if (start === -1 || end === -1) throw new Error('Missing real readiness ownership check');
    const group = Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8' }).trim());
    const check = (owner: number) => spawnSync('bash', ['-c', `PORT="$1"; pid="$2";\n${shell.slice(start, end)}\npreview_owns_port`, 'fixture', String(port), String(owner)]);
    expect(check(group).status).toBe(0);
    expect(check(group + 1).status).toBe(1);
    expect(server.listening).toBe(true);
  } finally { await close(server); }
});
