// gate-trace.mjs — record which files a push-gate step reads, so scripts/gate-cache.mjs can skip the step next push
// when none of them changed (process audit 2026-10-09: bake-check cost 111–164 s of every push with no bake input
// touched). Preloaded through NODE_OPTIONS="--import <this>", so every node child of the step inherits it.
//
// It records, under GATE_TRACE_ROOT only: every module loaded (registerHooks), every path passed to the fs read, stat,
// existence and listing calls, and every glob pattern with its cwd. On exit each process writes its records to
// GATE_TRACE_DIR/<pid>-<ms>.trace (one "F <path>", "D <path>" or "G <cwd>\t<pattern>" per line). A process killed by
// a signal writes nothing, so only steps whose node children all exit normally are cached (bake-check --node-only,
// the audits), gate-cache records only a passing step, and the periodic full gate (gate-cache.mjs FULL_EVERY) re-runs
// everything regardless.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.GATE_TRACE_ROOT, dir = process.env.GATE_TRACE_DIR;
if (root !== undefined && dir !== undefined) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @param {string} kind @param {unknown} target */
  const note = (kind, target) => {
    let path;
    if (typeof target === 'string') path = target;
    else if (target instanceof URL && target.protocol === 'file:') path = fileURLToPath(target);
    else if (target instanceof Uint8Array) path = new TextDecoder().decode(target);
    else return;
    seen.add(`${kind} ${resolve(path)}`);
  };
  registerHooks({
    load(url, context, next) {
      if (url.startsWith('file:')) seen.add(`F ${fileURLToPath(url)}`);
      return next(url, context);
    },
  });
  /** @param {Record<string, unknown>} target @param {string[]} names @param {string} kind */
  const wrap = (target, names, kind) => {
    for (const name of names) {
      const original = target[name];
      if (typeof original !== 'function') continue;
      /** @this {unknown} @param {...unknown} args */
      const traced = function traced(...args) { note(kind, args[0]); return Reflect.apply(original, this, args); };
      target[name] = traced;
    }
  };
  const files = ['readFileSync', 'readFile', 'existsSync', 'statSync', 'stat', 'lstatSync', 'lstat', 'openSync', 'open', 'createReadStream', 'accessSync', 'access', 'realpathSync'];
  /** @type {Record<string, unknown>} */
  const fsTable = fs;
  /** @type {Record<string, unknown>} */
  const fspTable = fsp;
  wrap(fsTable, files, 'F');
  wrap(fsTable, ['readdirSync', 'readdir', 'opendirSync', 'opendir'], 'D');
  wrap(fspTable, ['readFile', 'stat', 'lstat', 'open', 'access', 'realpath'], 'F');
  wrap(fspTable, ['readdir', 'opendir'], 'D');
  /** @type {[Record<string, unknown>, string][]} */
  const globs = [[fsTable, 'globSync'], [fsTable, 'glob'], [fspTable, 'glob']];
  for (const [table, name] of globs) {
    const original = table[name];
    if (typeof original !== 'function') continue;
    /** @this {unknown} @param {...unknown} args */
    const traced = function traced(...args) {
      const options = args[1];
      const cwd = options !== null && typeof options === 'object' && 'cwd' in options && typeof options.cwd === 'string' ? options.cwd : process.cwd();
      for (const pattern of Array.isArray(args[0]) ? args[0] : [args[0]]) if (typeof pattern === 'string') seen.add(`G ${resolve(cwd)}\t${pattern}`);
      return Reflect.apply(original, this, args);
    };
    table[name] = traced;
  }
  syncBuiltinESMExports();
  process.on('exit', () => {
    try { fs.writeFileSync(resolve(dir, `${process.pid}-${Date.now()}.trace`), [...seen].join('\n')); } catch { /* the step's verdict stands; gate-cache records nothing */ }
  });
}
