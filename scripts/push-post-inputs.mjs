// A completed ordinary generation publishes its small post-generation tables.
// The push gate only reads this evidence; it never invokes a producer.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** @param {Uint8Array | string} bytes */
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** @param {string} file */
export const postInputSource = file => /\.(?:[cm]?[jt]sx?|jsonc?|yaml|yml|as|py|sh|html|css|wgsl|glsl)$/u.test(file) && !file.includes('.generated.');

/** Capture committed source before generation, then seal completed tables.
 * No evidence is created for loose working-tree generation.
 * @param {string} inputRoot @param {{revision: string, files: string[]}} [fixture]
 * @returns {()=>void} */
export function beginPushInputs(inputRoot, fixture) {
  const root = resolve(inputRoot);
  const inventory = process.env.WS_GENERATION_TREE_FILES;
  if (fixture === undefined && (inventory === undefined || process.env.WS_GENERATION_TREE_ROOT !== root)) return () => { /* Loose working-tree generation does not publish evidence. */ };
  /** @type {{files: string[]}} */
  const tracked = fixture ?? JSON.parse(readFileSync(inventory ?? '', 'utf8'));
  const revision = fixture?.revision ?? readFileSync(resolve(root, '../HEAD'), 'utf8').trim().split(' ')[0];
  const inputs = Object.fromEntries(tracked.files.filter(postInputSource).map(file => [file, hash(readFileSync(resolve(root, file)))]));
  return () => {
    for (const [file, expected] of Object.entries(inputs)) if (hash(readFileSync(resolve(root, file))) !== expected) throw new Error(`Push input source moved during generation: ${file}`);
    const phaseFile = resolve(root, '.cache/generation-phase.json');
    if (!existsSync(phaseFile)) return;
    /** @type {{seal: string}} */
    const phase = JSON.parse(readFileSync(phaseFile, 'utf8'));
    /** @type {Record<string,string>} */
    const outputs = {};
    for (const folder of ['src', 'lint']) {
      if (!existsSync(resolve(root, folder))) continue;
      for (const file of readdirSync(resolve(root, folder), { recursive: true })) {
        if (!file.split('/').includes('node_modules') && /\.generated\.(?:ts|mts|json)$/u.test(file)) {
          const name = `${folder}/${file}`;
          if (!tracked.files.includes(name)) outputs[name] = hash(readFileSync(resolve(root, name)));
        }
      }
    }
    const saved = { schema: 'push-post-inputs/1', root, revision, phase: phase.seal, inputs, outputs };
    const sealed = { ...saved, seal: hash(JSON.stringify(saved)) };
    mkdirSync(resolve(root, '.cache'), { recursive: true });
    const path = resolve(root, '.cache/push-post-inputs.json'), temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(sealed)); renameSync(temporary, path);
  };
}
