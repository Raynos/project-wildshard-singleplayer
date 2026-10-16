#!/usr/bin/env node
// G418: poll once per 60s; ONLY notify wildshard-new through herdr-prompt.sh.
// Herdr exposes status but no reliable status-start timestamp/completion_seq in
// agent list. Durations therefore start at this process's first observation of
// each idle/done or working episode, not at guessed historical activity.
// Commit attribution also reads each lane's own LANDED/PUSHED report lines.
// A short SHA must resolve uniquely in git log; retain a verified report after
// it scrolls out of view. Read visible text while working, recent text at idle.
// Exact commit-lanes.jsonl pane records and explicit lane trailers still count;
// generic Jake/Assisted-by identities never identify a lane. A new attributed
// commit resets the working/no-commit clock. One successful alert per condition;
// state changes, session replacement or a new commit re-arm it. No AI process.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import * as v from 'valibot';

const root = resolve(import.meta.dirname, '..');
const agentsSchema = v.object({ result: v.object({ agents: v.array(v.object({
  name: v.optional(v.string()), pane_id: v.string(), agent_status: v.string(),
  agent_session: v.optional(v.object({ value: v.string() })),
})) }) });
const commitSchema = v.object({ sha: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u)), pane: v.string() });
/** @typedef {{ identity: string, status: string, since: number, commit: string, changed: number, alerted: boolean, turnAlerted: boolean }} Observation */
/** @type {Map<string, Observation>} */
const observations = new Map();
const stop = new AbortController();

/** Match only standalone reports, including the terminal's assistant bullet.
 * Incoming peer messages, quoted reports and ordinary commit mentions do not count.
 * @param {string} history @param {string} text @param {string} name
 * @param {string} pane @param {ReadonlyMap<string, string>} ledger
 * @param {string} [previous] @returns {{sha: string, at: number} | undefined} */
export function latestLaneCommit(history, text, name, pane, ledger, previous = '') {
  const commits = history.split('\u001E').flatMap(record => {
    const fields = record.trim().split('\0');
    if (fields.length < 4) return [];
    const [sha, seconds, author, body] = fields;
    const at = Number(seconds) * 1000;
    return /^[a-f0-9]{40}$/u.test(sha) && Number.isFinite(at) ? [{ sha, at, author, body }] : [];
  });
  const reported = new Set([previous]);
  for (const match of text.matchAll(/^(?:[ \t]*[•●⏺][ \t]+)?(?:LANDED|PUSHED)[ \t]+`?([a-f0-9]{7,40})\b/gmu)) {
    const prefix = match.at(1);
    if (prefix === undefined) continue;
    const matching = commits.filter(commit => commit.sha.startsWith(prefix));
    const commit = matching.at(0);
    if (matching.length === 1 && commit !== undefined) reported.add(commit.sha);
  }
  return commits.find(commit => {
    const explicit = [commit.author, ...commit.body.split('\n').filter(line => /^(?:Assisted-by|Lane|Agent):/u.test(line))];
    return reported.has(commit.sha) || ledger.get(commit.sha) === pane
      || explicit.some(line => line.match(/\bsp-x\d+\b/gu)?.includes(name));
  });
}

/** The callback adapter deliberately returns void; the child handle is not a completion signal.
 * @param {string} executable @param {string[]} args
 * @param {(error: Error | null, stdout: string, stderr: string) => void} complete */
function execute(executable, args, complete) {
  execFile(executable, args, { cwd: root, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }, complete);
}
const command = promisify(execute);

async function poll() {
  const [listed, history, ledger] = await Promise.all([
    command('herdr', ['agent', 'list']),
    command('git', ['log', '--since=2 hours ago', '-512', '--format=%H%x00%ct%x00%an%x00%B%x1e']),
    readFile(resolve(root, '.git/commit-lanes.jsonl'), 'utf8').catch((/** @type {unknown} */ error) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
      throw error;
    }),
  ]);
  const agents = v.parse(agentsSchema, JSON.parse(listed)).result.agents;
  const laneAgents = agents.filter(agent => agent.name !== undefined && /^sp-x\d+$/u.test(agent.name));
  /** @type {Map<string, string | undefined>} */
  const texts = new Map();
  await Promise.all(laneAgents.map(async agent => {
    const source = agent.agent_status === 'idle' || agent.agent_status === 'done' ? 'recent-unwrapped' : 'visible';
    try {
      texts.set(agent.pane_id, await command('herdr', ['agent', 'read', agent.pane_id, '--source', source, '--lines', '200']));
    } catch {
      // The lane may start working between list and read; never scroll it then.
      try { texts.set(agent.pane_id, await command('herdr', ['agent', 'read', agent.pane_id, '--source', 'visible', '--lines', '200'])); }
      catch { texts.set(agent.pane_id, undefined); }
    }
  }));
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
      observed = { identity, status, since: now, commit: '', changed: now, alerted: false, turnAlerted: false };
      observations.set(name, observed);
    }
    const text = texts.get(agent.pane_id);
    const commit = latestLaneCommit(history, text ?? '', name, agent.pane_id, panes, observed.commit);
    if (commit !== undefined && observed.commit !== commit.sha) {
      observed.commit = commit.sha;
      observed.changed = Math.max(observed.since, Math.min(now, commit.at));
      if (status === 'working') observed.alerted = false;
    }
    // G440: one task per Codex turn. A working episode (a commit does not end it) past 60 min gets one alert.
    const turn = now - observed.since;
    if (status === 'working' && turn > 60 * 60_000 && !observed.turnAlerted) {
      const message = `[watchdog] ${name} one turn has run ${Math.floor(turn / 60_000)} min (G440: one task per turn). Wrap it at its next commit and start the next task in a fresh turn.`;
      await command('bash', ['scripts/herdr-prompt.sh', 'wildshard-new', message]);
      observed.turnAlerted = true;
      console.info(`${new Date().toISOString()} ${message}`);
    }
    // A failed pane read cannot establish that the lane has not landed work.
    if (status === 'working' && text === undefined) continue;
    const age = now - (status === 'working' ? observed.changed : observed.since);
    const overdue = status === 'idle/done' ? age > 5 * 60_000 : status === 'working' && age > 45 * 60_000;
    if (!overdue || observed.alerted) continue;
    const minutes = Math.floor(age / 60_000);
    const message = status === 'idle/done'
      ? `[watchdog] ${name} idle/done for ${minutes} min (observed status, pane ${agent.pane_id}).`
      : `[watchdog] ${name} working for ${minutes} min without an attributed commit (own LANDED/PUSHED report verified in git log, exact pane ledger or lane trailer; last ${observed.commit.slice(0, 9) || 'none observed'}). Split or redirect its task.`;
    await command('bash', ['scripts/herdr-prompt.sh', 'wildshard-new', message]);
    observed.alerted = true;
    console.info(`${new Date().toISOString()} ${message}`);
  }
  for (const name of observations.keys()) if (!live.has(name)) observations.delete(name);
}

async function main() {
  if (process.env.HERDR_ENV !== '1') throw new Error('lane-watchdog requires a Herdr-managed terminal');
  process.once('SIGINT', () => { stop.abort(); });
  process.once('SIGTERM', () => { stop.abort(); });
  console.info('lane-watchdog: 60s poll; 5min idle / 45min no-commit / 60min turn; alerts only wildshard-new');
  while (!stop.signal.aborted) {
    const started = Date.now();
    try { await poll(); }
    catch (error) { console.error('lane-watchdog: observation/send refused:', error instanceof Error ? error.message : String(error)); }
    try { await setTimeout(Math.max(1, 60_000 - (Date.now() - started)), undefined, { signal: stop.signal }); }
    catch (error) { if (!(error instanceof Error) || error.name !== 'AbortError') throw error; }
  }
  console.info('lane-watchdog: stopped');
}

const entry = process.argv.at(1);
if (entry !== undefined && resolve(entry) === import.meta.filename) await main();
