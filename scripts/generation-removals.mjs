// G320: component parity is never permission to remove a whole product's retained outputs.

/** Plan only deletions of previously tracked catalogue outputs, retaining their exact predecessor hashes.
 * @param {readonly import('./generate.mjs').ShardGenerationJob[]} before
 * @param {readonly import('./generate.mjs').ShardGenerationJob[]} after
 * @param {readonly string[]} deleted
 * @param {(file:string)=>string} previousHash
 * @returns {import('./generation-removals.mjs').GenerationRemovalPlan} */
export function planGenerationRemovals(before, after, deleted, previousHash) {
  const removed = new Set(deleted);
  /** @type {import('./generation-removals.mjs').GenerationRemoval[]} */
  const outputs = [];
  const shards = new Set();
  for (const old of before) for (const file of old.outputs) {
    if (!removed.has(file)) continue;
    const job = after.find(row => row.outputs.includes(file));
    if (old.shard === null || job === undefined || job.shard !== old.shard) throw new Error(`Removal needs a retained shard-owned producer: ${file}`);
    const expected = previousHash(file);
    if (job.buildOutputs?.[file] !== expected) throw new Error(`Removal needs the unchanged predecessor hash in buildOutputs: ${file}`);
    if (job.platform === 'darwin' || job.capture || job.browser || job.preview || job.recordedInputs || job.seedOutputs?.includes(file)) throw new Error(`Removal producer is not a cold build-time job: ${job.id}`);
    const products = after.filter(row => row.shard === job.shard && Object.keys(row.comparisonOutputs ?? {}).length === 0 && row.outputs.some(output => output.endsWith('/shard.json')));
    if (products.length === 0) throw new Error(`Removal needs a registered complete shard.json producer: ${job.shard}`);
    outputs.push({file, job:job.id, shard:old.shard, expected});
    shards.add(old.shard);
  }
  return {outputs, shards:[...shards], jobIds:after.filter(job => job.shard !== null && shards.has(job.shard)).map(job => job.id)};
}

/** Admit only the fresh pinned clean-room product and every exact deleted output, never an asset-only report.
 * @param {import('./generation-removals.mjs').GenerationRemovalPlan} plan
 * @param {import('./generation-clean-room.mjs').CleanRoomReport} report
 * @param {string} pin */
export function assertGenerationRemovalProof(plan, report, pin) {
  if (report.pin !== pin) throw new Error('Removal clean-room proof is for a different staged tree');
  for (const output of plan.outputs) {
    const job = report.jobs.find(row => row.id === output.job);
    if (job?.status !== 'matched' || !job.outputs.some(row => row.file === output.file && row.exact && row.expected === output.expected && row.generated === output.expected)) throw new Error(`Removal output did not cold-regenerate exactly: ${output.file}`);
  }
  for (const shard of plan.shards) if (!report.shardfiles.some(row => row.shard === shard && row.status === 'matched')) throw new Error(`Removal complete product did not match: ${shard}`);
}
