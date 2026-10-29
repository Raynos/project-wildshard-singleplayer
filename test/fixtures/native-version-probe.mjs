// oxlint-disable-next-line import/no-nodejs-modules -- One explicitly requested cold native-binary discrimination, not a browser retry.
import {spawn} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare actual fixture and runner filesystems without moving any profile bytes.
import {statSync, statfsSync, realpathSync, readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Report the actual profile parent and mount boundaries.
import {dirname, resolve} from 'node:path';
import {drainNativeBrowser} from './native-browser-drain.mjs';

/** @param {string} executable @returns {Promise<import('./native-version-probe.mjs').VersionProbe>} */
export async function measureNativeVersion(executable) {
  const started = performance.now();
  const child = spawn(executable, ['--version'], {detached: true, stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '', timedOut = false;
  /** @type {string | null} */
  let error = null;
  /** @type {number | null} */
  let firstStdoutAtMs = null;
  /** @type {number | null} */
  let versionLineAtMs = null;
  child.stdout.on('data', data => {
    firstStdoutAtMs ??= performance.now() - started;
    stdout = (stdout + String(data)).slice(-2048);
    if (stdout.includes('\n')) versionLineAtMs ??= performance.now() - started;
  });
  child.stderr.on('data', data => {stderr = (stderr + String(data)).slice(-2048);});
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  let elapsedMs, cleanupError = null;
  try {
    elapsedMs = await new Promise(resolve => {
      const done = () => {resolve(performance.now() - started);};
      child.once('error', reason => {error = reason.message;});
      child.once('close', done);
      timer = setTimeout(() => {timedOut = true; child.kill('SIGKILL'); done();}, Math.max(0, 10_000 - (performance.now() - started)));
    });
  } finally {
    clearTimeout(timer);
    try {await drainNativeBrowser(child, undefined, () => Promise.resolve());}
    catch (error) {cleanupError = String(error);}
  }
  return {executable, realExecutable: realpathSync(executable), pid: child.pid ?? null, elapsedMs,
    cleanupMs: performance.now() - started - elapsedMs, cleanupError, code: child.exitCode,
    signal: child.signalCode, timedOut, error, stdout, stderr, firstStdoutAtMs, versionLineAtMs, deadlineMs: 10_000};
}

/** @param {string} path @returns {import('./native-version-probe.mjs').FilesystemIdentity} */
export function nativeFilesystem(path) {
  const location = resolve(path);
  try {
    const device = statSync(location).dev, filesystem = `0x${statfsSync(location).type.toString(16)}`;
    /** @type {import('./native-version-probe.mjs').FilesystemIdentity['mount']} */
    let mount = null;
    if (process.platform === 'linux') {
      try {
        for (const line of readFileSync('/proc/self/mountinfo', 'utf8').split('\n')) {
          const [before, after] = line.split(' - '), point = before?.split(' ')[4]?.replaceAll('\\040', ' ');
          const [type, source] = after?.split(' ') ?? [];
          if (point === undefined || type === undefined || source === undefined
            || location !== point && !location.startsWith(point.endsWith('/') ? point : `${point}/`)
            || mount !== null && point.length <= mount.point.length) continue;
          // Keep device nodes/filesystem kinds, never remote mount credentials.
          mount = {point, type, source: source.startsWith('/dev/') ? source : type};
        }
      } catch { /* Non-Linux/unavailable mount metadata remains explicitly null. */ }
    }
    return {path: location, device, filesystem, mount, error: null};
  } catch (error) {
    return {path: location, device: null, filesystem: null, mount: null,
      error: error instanceof Error && 'code' in error ? String(error.code) : String(error)};
  }
}

/** Identity is not an I/O-speed benchmark. No profile or mount is changed.
 * @param {string} profile @param {string | undefined} runnerTemp */
export function nativeStorageState(profile, runnerTemp) {
  const actual = nativeFilesystem(profile), repositoryTmp = nativeFilesystem(dirname(profile));
  const runnerTmp = runnerTemp === undefined ? null : nativeFilesystem(runnerTemp), systemTmp = nativeFilesystem('/tmp');
  const same = (/** @type {import('./native-version-probe.mjs').FilesystemIdentity} */ a,
    /** @type {import('./native-version-probe.mjs').FilesystemIdentity | null} */ b) =>
    a.device === null || b === null || b.device === null ? null : a.device === b.device;
  return {profile: actual, repositoryTmp, runnerTmp, systemTmp,
    profileAndRunnerSameDevice: same(actual, runnerTmp), profileAndSystemTmpSameDevice: same(actual, systemTmp)};
}
