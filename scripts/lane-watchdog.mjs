#!/usr/bin/env node
// G418: poll once per 60s; ONLY notify wildshard-new through herdr-prompt.sh.
// Herdr exposes status but no reliable status-start timestamp/completion_seq in
// agent list. Durations therefore start at this process's first observation of
// each idle/done or working episode, not at guessed historical activity.
// Commit attribution uses exact git-log SHAs matched to post-commit's local
// commit-lanes.jsonl pane records, or an explicit sp-xN author/trailer. Generic
// Assisted-by: Codex trailers alone never identify a lane. A new attributed
// commit resets the working/no-commit clock. One successful alert per condition;
// state changes, session replacement or a new commit re-arm it. No AI process.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import * as v from 'valibot';

const run = promisify(execFile), root = resolve(import.meta.dirname, '..');
const agentsSchema = v.object({ result: v.object({ agents: v.array(v.object({
  name: v.optional(v.string()), pane_id: v.string(), agent_status: v.string(),
  agent_session: v.optional(v.object({ value: v.string() })),
})) }) });
const commitSchema = v.object({ sha: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u)), pane: v.string() });
/** @typedef {{ identity: string, status: string, since: number, commit: string, changed: number, alerted: boolean }} Observation */
/** @type {Map<string, Observation>} */
const observations = new Map();
const stop = new AbortController();
process.once('SIGINT', () => { stop.abort(); });
process.once('SIGTERM', () => { stop.abort(); });

/** @param {string} command @param {string[]} args */
async function command(command, args) {
  return (await run(command, args, { cwd: root, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 })).stdout;
}

async function poll() {
  const [listed, history, ledger] = await Promise.all([
    command('herdr', ['agent', 'list']),
    command('git', ['log', '--since=2 hours ago', '-512', '--format=%H%x00%ct%x00%an%x00%B%x1e']),
    readFile(resolve(root, '.git/commit-lanes.jsonl'), 'utf8').catch(error => {
      if (error?.code === 'ENOENT') return '';
      throw error;
    }),
  ]);
  const agents = v.parse(agentsSchema, JSON.parse(listed)).result.agents;
  const panes = new Map();
  for (const line of ledger.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const parsed = v.safeParse(commitSchema, JSON.parse(line));
      if (parsed.success) panes.set(parsed.output.sha, parsed.output.pane);
    } catch { /* Partial concurrent ledger append supplies no attribution. */ }
  }
  const now = Date.now(), live = new Set();
  for (const agent of agents) {
    const name = agent.name;
    if (name === undefined || !/^sp-x\d+$/u.test(name)) continue;
    live.add(name);
    const identity = `${agent.pane_id}:${agent.agent_session?.value ?? ''}`;
    const status = agent.agent_status === 'idle' || agent.agent_status === 'done' ? 'idle/done' : agent.agent_status;
    let observed = observations.get(name);
    if (observed === undefined || observed.identity !== identity || observed.status !== status) {
      observed = { identity, status, since: now, commit: '', changed: now, alerted: false };
      observations.set(name, observed);
    }
    // git log is newest-first. Never attribute an ordinary body mentioning a peer.
    for (const record of history.split('\x1e')) {
      const [sha, seconds, author, body] = record.trim().split('\0');
      if (sha === undefined || seconds === undefined || author === undefined || body === undefined) continue;
      const explicit = [author, ...body.split('\n').filter(line => /^(?:Assisted-by|Lane|Agent):/u.test(line))];
      const named = explicit.some(line => line.match(/\bsp-x\d+\b/gu)?.includes(name));
      if (!named && panes.get(sha) !== agent.pane_id) continue;
      if (observed.commit !== sha) {
        observed.commit = sha;
        observed.changed = Math.max(observed.since, Math.min(now, Number(seconds) * 1000));
        if (status === 'working') observed.alerted = false;
      }
      break;
    }
    const age = now - (status === 'working' ? observed.changed : observed.since);
    const overdue = status === 'idle/done' ? age > 5 * 60_000 : status === 'working' && age > 45 * 60_000;
    if (!overdue || observed.alerted) continue;
    const minutes = Math.floor(age / 60_000);
    const message = status === 'idle/done'
      ? `[watchdog] ${name} idle/done for ${minutes} min (observed status, pane ${agent.pane_id}).`
      : `[watchdog] ${name} working for ${minutes} min without an attributed commit (git author/trailer or exact SHA/pane ledger; last ${observed.commit.slice(0, 9) || 'none observed'}). Split or redirect its task.`;
    await command('bash', ['scripts/herdr-prompt.sh', 'wildshard-new', message]);
    observed.alerted = true;
    console.info(`${new Date().toISOString()} ${message}`);
  }
  for (const name of observations.keys()) if (!live.has(name)) observations.delete(name);
}

if (process.env.HERDR_ENV !== '1') throw new Error('lane-watchdog requires a Herdr-managed terminal');
console.info('lane-watchdog: 60s poll; 5min idle / 45min no-commit; alerts only wildshard-new');
while (!stop.signal.aborted) {
  const started = Date.now();
  try { await poll(); }
  catch (error) { console.error('lane-watchdog: observation/send refused:', error instanceof Error ? error.message : String(error)); }
  try { await setTimeout(Math.max(1, 60_000 - (Date.now() - started)), undefined, { signal: stop.signal }); }
  catch (error) { if (!stop.signal.aborted) throw error; }
}
console.info('lane-watchdog: stopped');
