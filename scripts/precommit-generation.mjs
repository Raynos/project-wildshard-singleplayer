// Preparation only: producer order and every final census/policy check stay intact.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Run initial generation beside exact per-file syntax-fact preparation.
 * A fact is never a verdict: the final census discovers and hashes its full
 * post-generation tree, reparses new/changed files and applies current policy.
 * Both children must settle before any dependent producer or index write.
 * @param {string} root @param {string[]} command @returns {Promise<void>} */
export async function prepareCommitGeneration(root, command) {
  const cache = process.env.WS_COMMIT_WITNESS_CACHE;
  const commands = [command];
  if (cache && existsSync(resolve(root, 'lint/debug-flags.mjs'))) {
    commands.push(['--input-type=module', '-e', "import{primeDebugFlagFacts}from'./lint/debug-flags.mjs';primeDebugFlagFacts(process.cwd(),process.env.WS_COMMIT_WITNESS_CACHE);"]);
  }
  const results = await Promise.allSettled(commands.map(async (args, index) => {
    const started = performance.now();
    const child = spawn(process.execPath, args, {cwd:root, stdio:'inherit'});
    const [code] = await once(child, 'close');
    console.log(`precommit-prepare: ${index === 0 ? 'generation' : 'Debug facts'} ${((performance.now()-started)/1000).toFixed(3)}s`);
    if (code !== 0) throw new Error(`Commit preparation failed (${String(code)}): ${index === 0 ? 'generation' : 'Debug facts'}`);
  }));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length > 0) throw new AggregateError(failures.map(result => result.reason), 'Commit generation preparation failed');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const command = JSON.parse(process.argv[2]);
    if (!Array.isArray(command) || command.length === 0 || command.some(arg => typeof arg !== 'string')) throw new Error('Invalid commit generation command');
    await prepareCommitGeneration(process.cwd(), command);
  } catch (error) {console.error(error instanceof Error ? error.message : String(error));process.exitCode=1;}
}
