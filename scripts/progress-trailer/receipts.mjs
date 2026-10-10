// receipts.mjs — every number, date and SHA the progress trailer puts on screen, computed from git (PROGRESS-TRAILER
// §2.3 "Receipts", row PT7; E468), and the cards file titles.mjs renders from it.
//
//   node scripts/progress-trailer/receipts.mjs [--out=<dir>]        (default .cache/progress-trailer/receipts, gitignored)
//     writes <out>/receipts.json (the numbers), <out>/cards.json (titles.mjs's cards, every `at` a settled preview time)
//     and <out>/stills/ (the day-1 wall's 21 stills as they were at the chapter SHA: `git cat-file`, not the working
//     tree, since a still can change later).
//   then: scripts/browser-lane.sh --max 10 node scripts/steam-trailer/titles.mjs <frames> <out>/cards.json \
//           --titles-html=scripts/progress-trailer/titles.html            (or `<shots> --preview <out>/cards.json`)
//
// Definitions (§2.3), all from main's history in this checkout (a shallow clone cannot compute them, so this is not a
// vitest test; `node --test scripts/progress-trailer/receipts.test.mjs` asserts them):
//   - a commit's moment is its committer time; the calendar is UTC−5 (the repo's own offset), fixed, no DST;
//   - dayOf(sha) = calendar days from the origin commit 402198440 (16 Sep, day 1) to the commit, plus 1;
//   - a count is `git rev-list --count <sha>` of the SHA on screen;
//   - a span is the time between two named SHAs ("the first 43 hours" = 54e37d4dd → 6066f959c);
//   - the day-1 wall: the `progress/[0-9][0-9][0-9]-*` files in the chapter SHA's tree, each at the moment of the commit
//     that added it, ordered by that moment then file order, on a clock compressed from the origin (frame 0) to the
//     chapter SHA (the wall's last frame); a tile lands at max(its moment, the previous tile + 4 frames);
//   - the rail: `git log --oneline` of the chapter window (the lapse's first stage to its last; day 1 from the origin),
//     oldest first, each line's place = its count above the window's first commit, so between two stages the rail runs
//     at the real commits per screen-second.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPO = resolve(import.meta.dirname, '../..');
export const CHAPTERS = JSON.parse(readFileSync(join(import.meta.dirname, 'chapters.json'), 'utf8'));
const TZ = -5 * 3600; // UTC−5, the repo's commit offset
/** 4 decimals  @param {number} x */
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** @param {string[]} args */
export const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
/** @param {string} sha */
export const full = (sha) => git(['rev-parse', '--verify', `${sha}^{commit}`]);
/** @param {string} sha */
export const short = (sha) => full(sha).slice(0, 9);
/** committer time, unix seconds  @param {string} sha */
export const timeOf = (sha) => Number(git(['log', '-1', '--format=%ct', sha]));
/** @param {string} sha */
export const count = (sha) => Number(git(['rev-list', '--count', sha]));
/** @param {string} sha */
export const subjectOf = (sha) => git(['log', '-1', '--format=%s', sha]);

/** the UTC−5 calendar day number (days since the epoch) of a unix time  @param {number} t */
const localDay = (t) => Math.floor((t + TZ) / 86400);
/** @param {number} t  @param {number} [origin] */
export const dayOfTime = (t, origin = timeOf(CHAPTERS.origin)) => localDay(t) - localDay(origin) + 1;
/** @param {string} sha */
export const dayOf = (sha) => dayOfTime(timeOf(sha));
/** "2,495"  @param {number} n */
export const fmtCount = (n) => n.toLocaleString('en-US');
/** "16 Sep 2026" / "16 Sep"  @param {number} t  @param {boolean} [year] */
export const dateLabel = (t, year = false) => {
  const d = new Date((t + TZ) * 1000);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`;
};
/** "22:22"  @param {number} t */
export const clockLabel = (t) => new Date((t + TZ) * 1000).toISOString().slice(11, 16);
/** whole hours between two SHAs  @param {string} a  @param {string} b */
export const spanHours = (a, b) => Math.round((timeOf(b) - timeOf(a)) / 3600);
/** "1 h 46 min"  @param {string} a  @param {string} b */
export const spanLabel = (a, b) => {
  const m = Math.round((timeOf(b) - timeOf(a)) / 60);
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** the window's commits, oldest first: `to` and its ancestors that are not ancestors of `from`'s parents
 * @param {string} from  @param {string} to */
export const windowLines = (from, to) => {
  const base = count(from);
  const out = git(['log', '--date-order', '--reverse', '--abbrev=9', '--format=%h%x09%s', to, '--not', `${full(from)}^@`]);
  const lines = out ? out.split('\n').map((l) => { const [sha = '', ...s] = l.split('\t'); return { sha, s: s.join('\t').slice(0, 64) }; }) : [];
  const want = count(to) - base + 1;
  if (lines.length !== want) throw new Error(`window ${from}..${to}: ${lines.length} lines, counts say ${want}`);
  return { base, lines };
};

/** the wall's compressed clock runs from its first frame to its last (the last frame is the chapter SHA's moment, so
 * the wall ends on all of day 1 and its 29th commit)  @param {number} dur */
export const clockSpan = (dur) => (Math.round(dur * CHAPTERS.fps) - 1) / CHAPTERS.fps;

/** the day-1 wall: the numbered stills in `sha`'s tree, each at its adding commit's moment
 * @param {string} sha  @param {{ dur: number, stills: string, minGapFrames: number }} wall */
export const day1Stills = (sha, wall) => {
  const fps = CHAPTERS.fps, t0 = timeOf(CHAPTERS.origin), t1 = timeOf(sha);
  const re = new RegExp(`^${wall.stills.replace('[0-9][0-9][0-9]', '[0-9]{3}').replace('*', '.*')}$`);
  const inTree = new Set(git(['ls-tree', '--name-only', sha, 'progress/']).split('\n').filter((f) => re.test(f)));
  // the adding commit of each, oldest first; a commit's files in git's (path) order
  const log = git(['log', '--reverse', '--diff-filter=A', '--format=C %H %ct', '--name-only', sha, '--', wall.stills]);
  /** @type {{ file: string, sha: string, time: number }[]} */
  const found = [];
  let cur = { sha: '', time: 0 };
  for (const line of log.split('\n')) {
    if (line.startsWith('C ')) { const [, h = '', ct = '0'] = line.split(' '); cur = { sha: h, time: Number(ct) }; }
    else if (line && inTree.has(line) && !found.some((f) => f.file === line)) found.push({ file: line, sha: cur.sha, time: cur.time });
  }
  found.sort((a, b) => a.time - b.time); // stable: file order within a commit
  let prev = -Infinity;
  return found.map((f, i) => {
    const moment = (clockSpan(wall.dur) * (f.time - t0)) / (t1 - t0);
    const frame = Math.max(Math.round(moment * fps), prev + wall.minGapFrames);
    prev = frame;
    return { i, file: f.file, blob: git(['rev-parse', `${sha}:${f.file}`]), sha: f.sha.slice(0, 9), clock: clockLabel(f.time), moment: r4(moment), frame, t: r4(frame / fps) };
  });
};

/** a seeded typing rhythm over [t0, t1]: one key per character (the click track PT8 places), a longer gap after a space
 * @param {string} text  @param {number} t0  @param {number} t1 */
export const keyclicks = (text, t0, t1) => {
  let s = 0x9e3779b9; // mulberry32, fixed seed: the same rhythm every render
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const chars = Array.from(text);
  const gaps = chars.map((ch, i) => (i === 0 ? 0 : (text[i - 1] === ' ' ? 1.7 : 1) * (0.7 + 0.6 * rnd())));
  const total = gaps.reduce((a, g) => a + g, 0);
  let acc = 0;
  return chars.map((ch, i) => { acc += gaps[i] ?? 0; const t = t0 + ((t1 - t0) * acc) / total; return { t: r4(t), frame: Math.round(t * CHAPTERS.fps), ch }; });
};

/** the breath: the excerpt inside the `+` line it was, with that line's number in the new file
 * @param {{ sha: string, path: string, excerpt: string, dur: number, typeStart: number, typeEnd: number }} b */
export const breath = (b) => {
  const plus = git(['show', '--format=', b.sha, '--', b.path]).split('\n').find((l) => l.startsWith('+') && !l.startsWith('+++') && l.includes(b.excerpt));
  if (!plus) throw new Error(`breath: "${b.excerpt}" is not in a + line of ${b.sha}:${b.path}`);
  const fileLines = git(['show', `${b.sha}:${b.path}`]).split('\n');
  const lineNo = fileLines.indexOf(plus.slice(1)) + 1;
  const t = timeOf(b.sha);
  const ctx = [lineNo - 2, lineNo - 1, lineNo + 1].map((n) => ({ n, s: (fileLines[n - 1] ?? '').slice(0, 96) }));
  return { sha: short(b.sha), path: b.path, line: lineNo, context: ctx, plusLine: plus, excerpt: b.excerpt, words: b.excerpt.split(/\s+/).length,
    date: dateLabel(t), dateYear: dateLabel(t, true), time: clockLabel(t), dateTime: `${dateLabel(t)} ${clockLabel(t)}`, count: count(b.sha),
    keys: keyclicks(b.excerpt, b.typeStart, b.typeEnd), typeStart: b.typeStart, typeEnd: b.typeEnd };
};

/** @param {string} sha */
const stageOf = (sha) => { const t = timeOf(sha); return { sha: short(sha), count: count(sha), date: dateLabel(t), dateYear: dateLabel(t, true), time: t, subject: subjectOf(sha).slice(0, 72) }; };

/** the lapse's stages: PT5's lapse module when it exists (its stages' sha and t0), else chapters.json's, evenly spaced
 * @param {{ name: string, dur: number, stages: string[] }} lapse */
const lapseStages = async (lapse) => {
  const mod = join(import.meta.dirname, 'lapses', `${lapse.name}.mjs`);
  if (existsSync(mod)) {
    const m = /** @type {{ lapse?: { stages?: { sha: string, t0: number }[] } }} */ (await import(pathToFileURL(mod).href));
    const st = m.lapse?.stages;
    if (st && st.length > 0) return { from: `lapses/${lapse.name}.mjs`, stages: st.map((x) => Object.assign(stageOf(x.sha), { at: x.t0 })) };
  }
  return { from: 'chapters.json', stages: lapse.stages.map((sha, i) => Object.assign(stageOf(sha), { at: r4((i * lapse.dur) / lapse.stages.length) })) };
};

/** every on-screen number */
export const computeReceipts = async () => {
  const C = CHAPTERS, origin = full(C.origin), t0 = timeOf(origin);
  const chapters = [];
  for (const ch of C.chapters) {
    const n = count(ch.sha), t = timeOf(ch.sha);
    const base = { id: ch.id, sha: short(ch.sha), count: n, day: dayOf(ch.sha), date: dateLabel(t), label: `${ch.label} · ${fmtCount(n)} commits` };
    if (ch.wall) {
      const stills = day1Stills(ch.sha, ch.wall);
      const { lines } = windowLines(origin, ch.sha);
      const commits = git(['log', '--date-order', '--reverse', '--format=%ct', ch.sha, '--not', `${origin}^@`]).split('\n').map(Number);
      const rail = lines.map((l, i) => Object.assign(l, { t: r4((clockSpan(ch.wall.dur) * ((commits[i] ?? t0) - t0)) / (t - t0)) }));
      chapters.push({ ...base, kind: 'wall', dur: ch.wall.dur, clock: { from: clockLabel(t0), to: clockLabel(t), t0, t1: t }, span: spanLabel(origin, ch.sha), stills, rail });
    } else if (ch.lapse) {
      const L = ch.lapse;
      const { from, stages } = await lapseStages(L);
      const first = stages.at(0), last = stages.at(-1);
      if (!first || !last) throw new Error(`${ch.id}: no stages`);
      const { base: railBase, lines } = windowLines(first.sha, last.sha);
      const hours = L.span ? spanHours(L.span[0], L.span[1]) : null;
      const subject = L.subject.replace('{hours}', String(hours));
      chapters.push({ ...base, kind: 'lapse', name: L.name, dur: L.dur, stagesFrom: from, subject, span: L.span ? { from: short(L.span[0]), to: short(L.span[1]), hours } : null,
        open: L.open ?? 0, stages, railBase, rate: Math.round((lines.length / L.dur) * 10) / 10, rail: lines });
    }
  }
  const head = full('HEAD'), hn = count(head);
  const from = C.end.count.from;
  return {
    origin: { sha: short(origin), time: t0, date: dateLabel(t0, true), text: `${dateLabel(t0, true)}: an empty repo.`, subject: subjectOf(origin), count: count(origin) },
    chapters,
    breath: { ...breath(C.breath), dur: C.breath.dur, rail: windowLines(origin, C.breath.sha).lines },
    end: { sha: short(head), count: hn, day: dayOf(head), date: dateLabel(timeOf(head)), from: count(from), fromSha: short(from),
      text: `WILDSHARD · Day ${dayOf(head)} · ${fmtCount(hn)} commits`, cta: `${C.end.cta.text} · ${C.end.cta.url}`, ctaText: C.end.cta.text, url: C.end.cta.url },
  };
};

/** titles.mjs's cards: each card's opts carry its own receipts; `at` is a settled time for --preview
 * @param {Awaited<ReturnType<typeof computeReceipts>>} R  @param {string} stillsDir */
export const buildCards = (R, stillsDir) => {
  const cards = [];
  cards.push({ id: 'origin', card: 'origin', dur: 2, at: 1.2, text: R.origin.text, date: R.origin.date, rest: 'an empty repo.', sha: R.origin.sha });
  for (const ch of R.chapters) {
    if (ch.kind === 'wall') {
      cards.push({ id: `wall-${ch.id}`, card: 'wall', dur: ch.dur, at: ch.dur - 1 / 60, day: ch.day, label: ch.label, date: ch.date, count: ch.count, clock: { ...ch.clock, span: clockSpan(ch.dur) }, dateYear: dateLabel(ch.clock.t0, true),
        stills: ch.stills.map((s) => ({ src: pathToFileURL(join(stillsDir, s.file.replace('progress/', ''))).href, t: s.t, clock: s.clock, file: s.file })),
        rail: ch.rail, sha: ch.sha });
    } else if (ch.kind === 'lapse') {
      const readEnd = ch.open ? ch.dur - ch.open / 2 : ch.dur;
      const lastAt = ch.stages[ch.stages.length - 1]?.at ?? 0;
      const labelAt = r4(Math.min(lastAt, readEnd - 1.25));
      cards.push({ id: `frame-${ch.id}`, card: 'frame', dur: ch.dur, at: Math.max(0, labelAt - 0.6), subject: ch.subject, label: ch.label, labelAt, open: ch.open,
        stages: ch.stages.map((s) => ({ sha: s.sha, count: s.count, date: s.dateYear, at: s.at, subject: s.subject })), railBase: ch.railBase, rail: ch.rail });
    }
  }
  const b = R.breath;
  cards.push({ id: 'breath', card: 'breath', dur: b.dur, at: b.dur - 0.3, excerpt: b.excerpt, sha: b.sha, path: b.path, line: b.line, context: b.context, date: b.dateYear, time: b.time, count: b.count, keys: b.keys, rail: b.rail });
  const E = CHAPTERS.end;
  cards.push({ id: 'end-count', card: 'endCount', dur: E.count.dur, at: E.count.hit + 0.6, day: R.end.day, count: R.end.count, from: R.end.from, hit: E.count.hit, sha: R.end.sha });
  cards.push({ id: 'end-cta', card: 'endCta', dur: E.cta.dur, at: 1.2, text: R.end.ctaText, url: R.end.url });
  return cards;
};

/** each read block's text and its time on screen (§2.3: ≥ 1.2 s, ≤ 7 words; the cap height is titles.html's
 * window.legibility())  @param {ReturnType<typeof buildCards>} cards */
export const readSchedule = (cards) => cards.flatMap((c) => {
  switch (c.card) {
    case 'origin': return [{ card: c.id, text: c.text, from: 0, to: c.dur }];
    case 'wall': return [{ card: c.id, text: c.label, from: 0, to: c.dur }];
    case 'frame': {
      const readEnd = c.open ? c.dur - c.open / 2 : c.dur;
      return [{ card: c.id, text: c.subject, from: 0, to: c.labelAt }, { card: c.id, text: c.label, from: c.labelAt, to: readEnd }];
    }
    case 'breath': return [{ card: c.id, text: c.excerpt, from: c.keys.at(-1)?.t ?? 0, to: c.dur }];
    case 'endCount': return [{ card: c.id, text: `WILDSHARD · Day ${c.day} · ${fmtCount(c.count)} commits`, from: c.hit, to: c.dur }];
    case 'endCta': return [{ card: c.id, text: `${c.text} · ${c.url}`, from: 0, to: c.dur }];
    default: return [];
  }
});
/** words of a read block (separators and ellipses are not words)  @param {string} s */
export const wordCount = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const out = resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? join(REPO, '.cache/progress-trailer/receipts'));
  const stillsDir = join(out, 'stills');
  mkdirSync(stillsDir, { recursive: true });
  const R = await computeReceipts();
  for (const ch of R.chapters) if (ch.kind === 'wall') for (const s of ch.stills) writeFileSync(join(stillsDir, s.file.replace('progress/', '')), execFileSync('git', ['cat-file', 'blob', s.blob], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
  writeFileSync(join(out, 'receipts.json'), `${JSON.stringify(R, null, 1)}\n`);
  writeFileSync(join(out, 'cards.json'), `${JSON.stringify(buildCards(R, stillsDir))}\n`);
  for (const ch of R.chapters) {
    const what = 'stages' in ch ? `stages ${ch.stages.map((s) => `${s.sha}=${fmtCount(s.count)}`).join(' ')} (${ch.stagesFrom}) · rail ${ch.rail.length} lines, ${ch.rate}/s`
      : `${ch.stills.length} stills · ${ch.span}`;
    console.log(`[receipts] ${ch.id} ${ch.sha} day ${ch.day} · ${fmtCount(ch.count)} commits · ${what}`);
  }
  console.log(`[receipts] origin ${R.origin.text} · breath ${R.breath.sha} ${R.breath.dateTime} line ${R.breath.line} · end ${R.end.text}`);
  console.log(`[receipts] wrote ${out}/receipts.json, cards.json, stills/`);
}
