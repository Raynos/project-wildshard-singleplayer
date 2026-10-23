// Scheduling hints never grant input, output or cache evidence.
import { availableParallelism } from 'node:os';

/** Reserve four logical CPUs and never launch over four producers.
 * @param {number} [cores] */
export function defaultGenerationConcurrency(cores = availableParallelism()) {
  if (!Number.isSafeInteger(cores) || cores < 1) throw new Error('Generation CPU count must be a positive integer');
  return Math.max(1, Math.min(4, cores - 4));
}

/** Explicit parallel requests override the default, including legacy --parallel.
 * @param {readonly string[]} [args] @param {number} [cores] */
export function generationConcurrency(args = process.argv.slice(2), cores = availableParallelism()) {
  const selected = args.filter(arg => arg === '--parallel' || arg.startsWith('--parallel='));
  if (selected.length > 1) throw new Error('Generation accepts one --parallel=1..4 request');
  const request = selected.at(0);
  if (request === undefined) return defaultGenerationConcurrency(cores);
  if (request === '--parallel') return 4;
  if (!/^--parallel=[1-4]$/u.test(request)) throw new Error('Generation concurrency must be 1..4');
  return Number(request.slice('--parallel='.length));
}

// Cold seconds from G668's 7c8e3b33a2 audit. Unknown jobs retain catalogue order.
const coldSeconds = { 'nine-layout': 90, 'open-plots-world': 64, 'nalati-species': 53,
  'nalati-rifle-rows': 33, 'driftwood-data-map': 32, 'nine-map-assembly': 31,
  'camp-specimen-catalogue': 26, 'pine-data-map': 26, 'nine-casts': 24, 'pine-coat-pages': 23 };

/** Rank by audited cost, preserving original indices for dependency admission.
 * @param {readonly string[]} ids @param {Readonly<Record<string,number>>} [costs] */
export function generationOrder(ids, costs = coldSeconds) {
  return ids.map((id, index) => ({ index, seconds: costs[id] ?? 0 }))
    .sort((a, b) => b.seconds - a.seconds || a.index - b.index).map(row => row.index);
}
