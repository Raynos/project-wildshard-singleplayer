import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Keep Vitest's module cache out of $TMPDIR (docs/process/MACHINE.md "Disk and boot").
 *
 * Vitest 5.0.1 writes every SSR-transformed module to `join(os.tmpdir(), nanoid())`: once for the run (`Vitest._tmpDir`,
 * never removed) and once per project (`TestProject.tmpDir`, removed only on a clean close). That leaked ~2,700 files
 * into $TMPDIR per run, and macOS empties $TMPDIR at boot before login. Vitest 5 resolves this config before it
 * constructs either object, so pointing TMPDIR at `./tmp/vitest/<pid>` here roots both dirs there. The plugin puts the
 * caller's TMPDIR back once the projects exist, so tests and the processes they spawn see the real temp dir. The whole
 * `<pid>` dir is removed on exit; `scripts/boot-temp-warn.sh` sweeps the ones a killed run leaves.
 */
export function vitestTmpRoot(env: NodeJS.ProcessEnv = process.env): Plugin {
  const original = env.TMPDIR;
  const root = env.VITEST_TMP_ROOT ?? fileURLToPath(new URL('../tmp/vitest', import.meta.url));
  const dir = join(root, String(process.pid));
  mkdirSync(dir, { recursive: true });
  env.TMPDIR = dir;
  // Workers import those cache files by their per-run path, so a compile cache would gain an entry per module per run:
  // keep it inside the run's dir too (an inherited NODE_COMPILE_CACHE pointed at $TMPDIR filled it with 284k files).
  env.NODE_COMPILE_CACHE = join(dir, 'node-compile-cache');
  if (env.WS_VITEST_TMP_DIR !== dir) {
    env.WS_VITEST_TMP_DIR = dir;
    process.once('exit', () => { rmSync(dir, { recursive: true, force: true }); });
  }
  return {
    name: 'wildshard:vitest-tmp-root',
    configureVitest() {
      if (original === undefined) Reflect.deleteProperty(env, 'TMPDIR');
      else env.TMPDIR = original;
    },
  };
}
