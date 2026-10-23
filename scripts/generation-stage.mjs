// Copy and verify a cold producer's source stage off the scheduler event loop.
import { createHash } from 'node:crypto';
import { constants, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import * as v from 'valibot';

const path = v.pipe(v.string(), v.check(file => file.length > 0 && !isAbsolute(file) && !file.includes('\\')
  && file.split('/').every(part => part !== '' && part !== '.' && part !== '..')));
const Request = v.strictObject({ root: v.string(), job: v.string(), inputs: v.pipe(v.array(v.strictObject({
  file: path, source: v.string(), hash: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
})), v.minLength(1)) });

/** @param {unknown} value */
function copyStage(value) {
  const request = v.parse(Request, value), root = realpathSync(request.root), scratch = resolve(root, 'tmp');
  mkdirSync(scratch, { recursive: true });
  if (lstatSync(scratch).isSymbolicLink() || !realpathSync(scratch).startsWith(root + sep)) {
    throw new Error('Generation staging scratch escaped its source tree');
  }
  const tree = realpathSync(mkdtempSync(resolve(scratch, 'generation-stage-')));
  try {
    for (const { file, source, hash } of request.inputs) {
      if (!lstatSync(source).isFile()) throw new Error(`Generation stage source is not regular: ${file}`);
      const target = resolve(tree, file);
      mkdirSync(dirname(target), { recursive: true });
      // COPYFILE_FICLONE requests a COW clone and transparently falls back on
      // filesystems without clone support. The stage never aliases source writes.
      copyFileSync(source, target, constants.COPYFILE_FICLONE);
      const copied = createHash('sha256').update(readFileSync(target)).digest('hex');
      if (copied !== hash) throw new Error(`Generation inputs changed while copying ${request.job}: ${file} (expected ${hash}, copied ${copied})`);
    }
    return tree;
  } catch (error) { rmSync(tree, { recursive: true, force: true }); throw error; }
}

/** Return an owned stage only after every declared input's exact hash matches.
 * The caller removes it after the producer and retains all upstream cache pins.
 * @param {import('./generation-stage.mjs').StageRequest} request @returns {Promise<string>} */
export function stageGenerationInputs(request) {
  return new Promise((_resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: request, execArgv: [] });
    worker.once('error', reject);
    worker.once('message', (/** @type {unknown} */ message) => {
      const reply = v.safeParse(v.variant('ok', [v.strictObject({ ok: v.literal(true), tree: v.string() }),
        v.strictObject({ ok: v.literal(false), error: v.string() })]), message);
      if (!reply.success) { reject(new Error('Invalid generation staging worker reply')); return; }
      if (reply.output.ok) _resolve(reply.output.tree);
      else reject(new Error(reply.output.error));
    });
    worker.once('exit', code => { reject(new Error(`Generation staging worker exited without a stage (${String(code)})`)); });
  });
}

if (!isMainThread && process.argv[1] === import.meta.filename) {
  if (parentPort === null) throw new Error('Generation staging worker has no parent');
  /** @type {{ok:true,tree:string}|{ok:false,error:string}} */
  let reply;
  try { reply = { ok: true, tree: copyStage(workerData) }; }
  catch (error) { reply = { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Node MessagePort has no browser targetOrigin argument.
  parentPort.postMessage(reply);
}
