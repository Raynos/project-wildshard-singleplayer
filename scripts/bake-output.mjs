// Shared byte comparisons for the E357 bakers. Checks never mutate the output tree.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

export const outputHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value, indent = 2) => Buffer.from(`${JSON.stringify(value, null, indent)}\n`);
export function toolVersion(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0]; }
  catch { return null; }
}
export function byteWriter(check, label) {
  let changed = 0;
  const mismatch = (path) => {
    changed++;
    console.log(`${label}: ${check ? 'STALE' : 'changed'} ${relative(process.cwd(), path)}`);
  };
  return {
    put(path, bytes) {
      const buf = Buffer.from(bytes);
      if (existsSync(path) && readFileSync(path).equals(buf)) return;
      mismatch(path);
      if (!check) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf); }
    },
    remove(path) {
      if (!existsSync(path)) return;
      mismatch(path);
      if (!check) rmSync(path);
    },
    finish() {
      if (changed > 0) {
        console.log(`${label}: tools node ${process.version}; ${['magick', 'cwebp', 'basisu'].map((cmd) => `${cmd} ${toolVersion(cmd, [cmd === 'magick' ? '-version' : '-version']) ?? 'unavailable'}`).join('; ')}`);
        if (check) process.exitCode = 1;
      }
      return changed;
    },
  };
}
