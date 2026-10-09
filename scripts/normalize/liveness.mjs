/** Decision 88: references, or a recent execution of an unfinished/reusable script. */
import { createReadStream, globSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const DAY = 86_400_000;
const TEXT = /\.(?:mjs|mts|js|ts|json|md|sh|py|yml|yaml|toml|txt)$/;
async function files(root) {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === '.DS_Store') continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

/** Shell words, retaining command boundaries; no command is evaluated. */
function shellWords(command) {
  const words = [];
  let word = '', quote = '';
  const flush = () => { if (word) words.push(word); word = ''; };
  for (let index = 0; index < command.length; index++) {
    const ch = command[index];
    if (ch === '\\' && quote !== "'") { word += command[++index] ?? ''; continue; }
    if (quote) { if (ch === quote) quote = ''; else word += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (';|&\n'.includes(ch)) { flush(); words.push(';'); continue; }
    if (/\s/.test(ch)) { flush(); continue; }
    word += ch;
  }
  flush();
  return words;
}

function scriptPath(word, cwd, root) {
  if (!word || word.startsWith('-')) return null;
  const path = relative(root, resolve(cwd, word));
  return path.startsWith('scripts/') ? path : null;
}

/** Peel only execution wrappers; a mention by cat/grep/etc is deliberately not a run. */
function executable(words, cwd, root) {
  let index = 0;
  while (/^[A-Za-z_][\w]*=/.test(words[index] ?? '')) index++;
  while (index < words.length) {
    const name = basename(words[index++]);
    if (name === 'env') {
      while (words[index]?.startsWith('-') || /^[A-Za-z_][\w]*=/.test(words[index] ?? '')) index++;
      continue;
    }
    if (name === 'lockf') { while (words[index]?.startsWith('-')) index++; index++; continue; }
    if (name === 'caffeinate') {
      while (words[index]?.startsWith('-')) { const option = words[index++]; if (option === '-t' || option === '-w') index++; }
      continue;
    }
    if (name === 'timeout' || name === 'gtimeout') { while (words[index]?.startsWith('-')) index++; index++; continue; }
    if (name === 'browser-lane.sh') { if (words[index] === '--max') index += 2; continue; }
    if (name === 'run-locked.sh') { index++; continue; }
    if (name === 'uv') {
      if (words[index++] !== 'run') return null;
      while (words[index]?.startsWith('-')) {
        const option = words[index++];
        if (['--project', '--directory', '--python', '--with', '--with-editable', '--with-requirements'].includes(option)) index++;
      }
      continue;
    }
    if (name === 'pnpm') { if (words[index++] !== 'exec') return null; if (words[index] === '--') index++; continue; }
    if (name === 'npx') {
      while (words[index]?.startsWith('-')) { const option = words[index++]; if (option === '-p' || option === '--package') index++; }
      continue;
    }
    if (/^(?:node|bash|sh|python3?|python3\.\d+)$/.test(name)) {
      while (words[index]?.startsWith('-')) {
        const option = words[index++];
        if (['-c', '-lc', '-ic', '-e', '--eval', '-m', '--print', '-p'].includes(option)) {
          return ['-c', '-lc', '-ic'].includes(option) && (name === 'bash' || name === 'sh') ? { nested: words[index] ?? '' } : null;
        }
        if (['--import', '--loader', '--require', '-r', '--conditions', '-C'].includes(option)) index++;
      }
      // uv run python, npx node, and pnpm exec node naturally reach this branch.
      return scriptPath(words[index], cwd, root);
    }
    return scriptPath(words[index - 1], cwd, root);
  }
  return null;
}

function executions(command, cwd, root) {
  const result = [];
  let segment = [];
  let currentCwd = cwd;
  const consume = () => {
    if (segment[0] === 'cd' && segment[1]) currentCwd = resolve(currentCwd, segment[1]);
    else {
      const path = executable(segment, currentCwd, root);
      if (typeof path === 'string') result.push(path);
      else if (path?.nested) result.push(...executions(path.nested, currentCwd, root));
    }
    segment = [];
  };
  for (const word of shellWords(command)) { if (word === ';') consume(); else segment.push(word); }
  consume();
  return result;
}

function argumentsObject(value) {
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
}

// Modern Codex stores functions.exec as a custom call containing JavaScript.
// Extract literal command arguments, never execute the surrounding JavaScript.
function orchestrationCommands(source) {
  const commands = [];
  const pattern = /\b(?:cmd|command)\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
  for (const match of source.matchAll(pattern)) {
    const literal = match[1];
    if (literal[0] === '"') { try { commands.push(JSON.parse(literal)); } catch { /* incomplete streaming call */ } }
    else commands.push(literal.slice(1, -1).replaceAll(String.raw`
`, '\n').replaceAll(/\\([\\'"`])/g, '$1'));
  }
  return commands;
}

async function recentRuns(root, home, now, transcriptRoots) {
  const result = new Map();
  const cutoff = now - 5 * DAY;
  const roots = transcriptRoots ?? [join(home, '.codex/sessions'), ...
    (await readdir(join(home, '.claude/projects'), { withFileTypes: true }).catch(() => []))
      .filter(entry => entry.isDirectory() && entry.name.includes('wildshard')).map(entry => join(home, '.claude/projects', entry.name))];
  for (const folder of roots) for (const path of await files(folder)) {
    if (!path.endsWith('.jsonl') || (await stat(path)).mtimeMs < cutoff) continue;
    let cwd = root;
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of lines) {
      let record;
      try { record = JSON.parse(line); } catch { continue; }
      if (record.type === 'session_meta' || record.type === 'turn_context') cwd = record.payload?.cwd ?? cwd;
      if (record.cwd) cwd = record.cwd;
      const timestamp = Date.parse(record.timestamp ?? '');
      if (!(timestamp >= cutoff && timestamp <= now) || !cwd.includes('wildshard')) continue;
      const commands = [];
      for (const block of record.message?.content ?? []) {
        if (block.type === 'tool_use' && block.name === 'Bash' && typeof block.input?.command === 'string') commands.push(block.input.command);
      }
      const payload = record.payload;
      if (record.type === 'response_item' && payload?.type === 'function_call') {
        const args = argumentsObject(payload.arguments);
        if (/(?:exec_command|shell|Bash)/.test(payload.name ?? '') && typeof (args?.cmd ?? args?.command) === 'string') commands.push(args.cmd ?? args.command);
      }
      if (record.type === 'response_item' && payload?.type === 'custom_tool_call' && /(?:functions\.exec|exec)$/.test(payload.name ?? '') && typeof payload.input === 'string') commands.push(...orchestrationCommands(payload.input));
      for (const command of commands) for (const script of executions(command, cwd, root)) {
        const previous = result.get(script);
        if (!previous || timestamp > previous) result.set(script, timestamp);
      }
    }
  }
  return result;
}

function references(text, source, root, entries) {
  const result = new Set();
  const add = path => {
    if (!path.startsWith('scripts/')) return;
    const entry = path.slice(8).split('/')[0];
    if (entries.has(entry)) result.add(entry);
  };
  for (const match of text.matchAll(/\bscripts\/([\w./*{},-]+)/g)) {
    const path = `scripts/${match[1].replace(/[,.]+$/, '')}`;
    if (/[*{]/.test(path)) {
      // A tree-wide inventory glob does not name a tool; only a named family is a reference.
      if (/^scripts\/[\w-]+/.test(path)) for (const file of globSync(path, { cwd: root })) add(file);
    }
    else add(path);
  }
  // Living docs sometimes abbreviate a sibling in a scripts table to its filename.
  for (const match of text.matchAll(/(?<![\w./-])([\w-]+\.(?:mjs|d\.mts|py|sh|json))\b/g)) {
    if (entries.has(match[1])) result.add(match[1]);
  }
  if (source.startsWith('scripts/')) for (const match of text.matchAll(/(?:^|[\s'"`(])((?:\.\.?\/)+[\w./-]+)/g)) {
    add(relative(root, resolve(root, dirname(source), match[1])));
  }
  return result;
}

async function finishedAsk(root, entry) {
  const id = /^e(\d+)-/i.exec(entry)?.[1];
  if (!id) return false;
  const path = join(root, `docs/tasks/asks/E${id}.md`);
  try { return /\*\*Status:\*\*\s*(?:done|dropped|folded into|superseded by)\b/i.test(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const legacy = await readFile(join(root, 'project/archive/2026-09-22-asks-table.md'), 'utf8').catch(() => '');
  return legacy.split('\n').some(line => new RegExp(`^\\|\\s*E${id}\\s*\\|`, 'i').test(line) && /\|\s*(?:done|dropped)\b/i.test(line));
}

async function classify(root, home, now, transcriptRoots) {
  const entries = new Map((await readdir(join(root, 'scripts'), { withFileTypes: true }))
    .filter(entry => entry.name !== 'README.md' && entry.name !== '.DS_Store' && entry.name !== '__pycache__')
    .map(entry => [entry.name, { name: entry.name, folder: entry.isDirectory(), reasons: [] }]));
  const sourcePaths = [];
  for (const name of ['package.json', '.claude/settings.json', 'vite.config.ts', 'AGENTS.md', 'README.md']) sourcePaths.push(join(root, name));
  for (const name of ['.githooks', '.claude/hooks', '.github/workflows', '.claude/skills', '.agents/skills', 'vite', 'test', 'api-tests', 'docs/design', 'docs/plans']) sourcePaths.push(...await files(join(root, name)));
  for (const path of await files(join(root, 'docs'))) if (dirname(path) === join(root, 'docs') && path.endsWith('.md')) sourcePaths.push(path);
  sourcePaths.push(...await files(join(home, '.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/memory')));
  const add = (name, reason) => { const entry = entries.get(name); if (entry && !entry.reasons.includes(reason)) entry.reasons.push(reason); };
  for (const path of sourcePaths) {
    if (!TEXT.test(path) && !path.includes('/.githooks/')) continue;
    let text;
    try { text = await readFile(path, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const name of references(text, relative(root, path), root, entries)) add(name, `reference: ${relative(root, path)}`);
  }
  for (const [script, timestamp] of await recentRuns(root, home, now, transcriptRoots)) {
    const name = script.slice(8).split('/')[0];
    if (!await finishedAsk(root, name)) add(name, `executed: ${new Date(timestamp).toISOString()}`);
  }
  const scripts = new Map();
  for (const path of await files(join(root, 'scripts'))) {
    const source = relative(root, path);
    if (source === 'scripts/README.md' || !TEXT.test(path)) continue;
    scripts.set(source, references(await readFile(path, 'utf8'), source, root, entries));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [source, targets] of scripts) {
      const owner = entries.get(source.slice(8).split('/')[0]);
      if (!owner?.reasons.length) continue;
      for (const name of targets) {
        if (!entries.get(name)?.reasons.length) { add(name, `dependency: ${source}`); changed = true; }
      }
    }
    for (const [name, entry] of entries) if (name.endsWith('.d.mts') && entries.get(name.replace(/\.d\.mts$/, '.mjs'))?.reasons.length && entry.reasons.length === 0) {
      add(name, 'declaration beside live module'); changed = true;
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function group(entry) {
  if (entry.folder) return 'Folders';
  if (/^e\d+-/i.test(entry.name)) return 'One-off asks';
  if (/^(?:bake-|.*rig-bake|tex-tiers|simplify-models)/.test(entry.name)) return 'Bake and asset build';
  if (/^(?:check-|unused-assets|plan-lint|coverage-ratchet)/.test(entry.name)) return 'Check and audit';
  if (/^(?:bench-|.*gpu|.*memory|soak|.*perf)/.test(entry.name)) return 'Bench, performance and memory';
  if (entry.name.startsWith('test-')) return 'Test harness';
  if (/^(?:physics-|scorecard|nalati-(?:quest|raid|walk|boot|ride-physics|ragdoll))/.test(entry.name)) return 'Gameplay verification';
  if (/^(?:native-|ota-|deploy-|.*lane|push-main|serve-build|vercel-|debug-settings|ask-new)/.test(entry.name)) return 'Infrastructure, lanes and release';
  if (/(?:capture|shots|board|mockup|render|lineup|compare|cards)/.test(entry.name)) return 'Capture, boards and mockups';
  return 'Other';
}

function readme(entries) {
  const notes = {
    'test-sdk-full-client.mjs': ' — `<installed-product> <report.json> <sha> [first-party]`: normal Game stages, mounted equipment, real two-boundary tile driving, zero-download revisit, actual offline state restore and 15 scoped unloads. Optional `first-party` removes the embedded declaration and boots the canonical template descriptor. Run through browser-lane outside quiet windows; owns and closes its muted iPhone-sized browser and static server. Functional proof, not a frame-floor reading.',
    'frame-floor.mjs': ' — live cadence from drawn-frame rAF timestamps, with callback-time and CPU-work p95 diagnostics; owns isolated previews and browser/Simulator lanes. `--device=<name>` selects the Simulator (default `frame-floor-iphone-17-pro`); each run writes a separate `progress/frame-floor/<sha>-<run-id>.json`.',
    'shard-platform.mjs': ' — SF6: `--check` gates converted shards at public SDK share ≥80 % and their ratcheted `runtime/` ceiling; `--json` emits logical-line counts, unique-kit attribution and milestone flags. The immutable physical-line baseline and old ratio stay labelled legacy TS. Proof convention: executable, unskipped Vitest tests at `test/proof/<slug>/<boot|headless|replay|ledger|grid-ready>.test.ts`; the flag is true when its file exists, and the push gate runs every proof; a shard with a canonical witness result (`test/proof/<slug>/compatibility.json`, written only from a real run) reads headless / replay / ledger / compatible from it instead, so a fail-closed witness never reads as a pass. `boot` proves shardfile boot with no trusted chunk; `headless` proves 10,000 Node ticks; `replay` proves snapshot/restore/suffix equality; `ledger` proves ledger/dedupe restoration; `grid-ready` proves the shard meets the grid contract. Template proofs use `_template`. Compatible requires headless + replay + ledger proofs; transitional reports remaining `runtime/` gameplay or a witness that is not yet compatible. Missing proofs are false, irrespective of percentages. Generated/baked paths and marked generated files do not count; generators count public whatever they import.',
  };
  const groups = ['Bake and asset build', 'Check and audit', 'Infrastructure, lanes and release', 'Bench, performance and memory', 'Gameplay verification', 'Test harness', 'Capture, boards and mockups', 'One-off asks', 'Other', 'Folders'];
  let text = '# Scripts\n\nGenerated by `node scripts/normalize/liveness.mjs --readme`. Check with `node scripts/normalize/liveness.mjs --readme --check`.\n\nOne line per surviving top-level entry. Liveness follows decision 88; this generated index is not a liveness root.\n';
  for (const name of groups) {
    const rows = entries.filter(entry => group(entry) === name);
    if (rows.length === 0) continue;
    text += `\n## ${name}\n\n`;
    for (const entry of rows) text += `- [${entry.name}${entry.folder ? '/' : ''}](./${entry.name}${entry.folder ? '/' : ''})${notes[entry.name] ?? ''}\n`;
  }
  return text;
}

async function main() {
  const args = process.argv.slice(2);
  const option = name => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const root = resolve(option('--root') ?? process.cwd());
  const home = resolve(option('--home') ?? homedir());
  const now = Date.parse(option('--now') ?? new Date().toISOString());
  if (!Number.isFinite(now)) throw new Error('Invalid --now timestamp');
  const transcriptRoots = args.filter(arg => arg.startsWith('--transcripts=')).map(arg => resolve(arg.slice(14)));
  // README validation is structural and needs no private transcript scan.
  if (args.includes('--readme')) {
    const entries = (await readdir(join(root, 'scripts'), { withFileTypes: true })).filter(entry => !['README.md', '.DS_Store', '__pycache__'].includes(entry.name)).map(entry => ({ name: entry.name, folder: entry.isDirectory() })).sort((a, b) => a.name.localeCompare(b.name));
    const expected = readme(entries), path = join(root, 'scripts/README.md');
    if (args.includes('--stdout')) { process.stdout.write(expected); return; }
    if (args.includes('--check')) { if (await readFile(path, 'utf8').catch(() => '') !== expected) throw new Error('scripts/README.md is stale; run node scripts/normalize/liveness.mjs --readme'); }
    else await writeFile(path, expected);
    console.log(`scripts/README.md: ${entries.length} entries${args.includes('--check') ? ' checked' : ' written'}`);
    return;
  }
  const entries = await classify(root, home, now, transcriptRoots.length > 0 ? transcriptRoots : undefined);
  const dead = entries.filter(entry => entry.reasons.length === 0).map(entry => `scripts/${entry.name}`);
  if (args.includes('--json')) console.log(JSON.stringify({ count: entries.length, live: entries.length - dead.length, dead, entries }, null, 2));
  else console.log(`${entries.length} entries; ${entries.length - dead.length} live; ${dead.length} not live\n${dead.join('\n')}`);
}

if (resolve(process.argv[1] ?? '') === import.meta.filename) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
