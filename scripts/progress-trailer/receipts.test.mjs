// PT7's receipts test (PROGRESS-TRAILER §2.3; E468): the trailer's on-screen numbers, computed from git, are the plan's.
//   node --test scripts/progress-trailer/receipts.test.mjs
// Needs main's full history (a shallow CI clone or the gate's .git-less export cannot count commits), so it is a node
// test beside receipts.mjs, not a vitest file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCards, computeReceipts, count, dayOf, dayOfTime, readSchedule, timeOf, wordCount, dateLabel, spanHours } from './receipts.mjs';

const R = await computeReceipts();
const chapter = (id) => {
  const c = R.chapters.find((x) => x.id === id);
  assert.ok(c, id);
  return c;
};

void test('chapter counts are 29 / 660 / 2,495 / 5,729 on main\'s first-parent SHAs', () => {
  assert.deepEqual(['568a1463f', '2d2c5815a', '19a434635', 'c9aaa62ab'].map(count), [29, 660, 2495, 5729]);
  assert.deepEqual(['day1', 'week1', 'week2', 'week3'].map((id) => chapter(id).count), [29, 660, 2495, 5729]);
  assert.deepEqual(['day1', 'week1', 'week2', 'week3'].map((id) => chapter(id).day), [1, 8, 15, 22]);
  assert.equal(chapter('week1').label, 'WEEK 1 · 660 commits');
  assert.equal(chapter('week3').label, 'WEEK 3 · 5,729 commits');
});

void test('lapse stage counts: 232 (3a83028ec), 1,483 (3719d1d8e), 3,117 (54e37d4dd)', () => {
  assert.equal(count('3a83028ec'), 232);
  assert.equal(count('3719d1d8e'), 1483);
  assert.equal(count('54e37d4dd'), 3117);
  for (const [id, first, last] of [['week1', 232, 660], ['week2', 1483, 2495], ['week3', 3117, 5729]]) {
    const st = chapter(id).stages;
    assert.equal(st[0]?.count, first, `${id} first stage`);
    assert.equal(st[st.length - 1]?.count, last, `${id} last stage`);
    for (let i = 1; i < st.length; i++) assert.ok((st[i]?.count ?? 0) > (st[i - 1]?.count ?? 0), `${id} stages grow`);
  }
  // the rail runs at the real commits per screen-second: one line per commit of the window
  assert.equal(chapter('week1').rail.length, 660 - 232 + 1);
  assert.equal(chapter('week3').rail.length, 5729 - 3117 + 1);
});

void test('dayOf: 16 Sep is day 1, 9 Oct is day 24 (UTC−5 calendar days from 402198440)', () => {
  assert.equal(dayOf('402198440'), 1);
  assert.equal(dayOfTime(Date.parse('2026-10-09T00:00:00-05:00') / 1000), 24);
  assert.equal(dayOfTime(Date.parse('2026-10-09T23:59:59-05:00') / 1000), 24);
  assert.equal(dayOfTime(Date.parse('2026-10-10T00:00:00-05:00') / 1000), 25);
  assert.equal(dateLabel(timeOf('85833b267')), '9 Oct'); // a commit of 9 Oct
  assert.equal(dayOf('85833b267'), 24);
});

void test('the origin card and the spans', () => {
  assert.equal(R.origin.text, '16 Sep 2026: an empty repo.');
  assert.equal(R.origin.count, 1);
  assert.equal(chapter('day1').span, '1 h 46 min');
  assert.equal(spanHours('54e37d4dd', '6066f959c'), 43);
  assert.equal(chapter('week3').subject, 'The first 43 hours');
});

void test('the day-1 wall: 21 stills present at 568a1463f, in time then file order, ≥ 4 frames apart, on the 22:13 → 23:58 clock', () => {
  const w = chapter('day1');
  assert.equal(w.stills.length, 21);
  assert.equal(new Set(w.stills.map((s) => s.file)).size, 21);
  assert.ok(w.stills.every((s) => /^progress\/\d{3}-/.test(s.file)));
  assert.equal(w.stills[0]?.file, 'progress/001-first-terrain-and-trees.png');
  assert.equal(w.stills[20]?.file, 'progress/013-animals-boar-headshot-corpse.png');
  assert.equal(w.clock.from, '22:13');
  assert.equal(w.clock.to, '23:58');
  // the grid is empty for the first ≈ 0.86 s
  assert.ok(Math.abs((w.stills[0]?.t ?? 0) - 0.86) < 0.02, `first tile at ${w.stills[0]?.t}`);
  for (let i = 1; i < 21; i++) {
    const a = w.stills[i - 1], b = w.stills[i];
    assert.ok(a && b);
    assert.ok(b.frame - a.frame >= 4, `${b.file} lands ${b.frame - a.frame} frames after ${a.file}`);
    assert.ok(b.frame >= Math.round(b.moment * 60), `${b.file} never lands before its moment`);
  }
  assert.ok((w.stills[20]?.t ?? 9) < w.dur, 'the wall ends on all of day 1');
  assert.equal(w.rail.length, 29);
});

void test('the breath: "claude code as the UI for building" verbatim in a + line of b39cc8b8a, 16 Sep 22:22', () => {
  const b = R.breath;
  assert.equal(b.sha, 'b39cc8b8a');
  assert.equal(b.dateTime, '16 Sep 22:22');
  assert.ok(b.plusLine.startsWith('+') && b.plusLine.includes(b.excerpt));
  assert.equal(b.excerpt, 'claude code as the UI for building');
  assert.equal(b.words, 7);
  assert.equal(b.keys.map((k) => k.ch).join(''), b.excerpt);
  for (let i = 1; i < b.keys.length; i++) assert.ok((b.keys[i]?.t ?? 0) > (b.keys[i - 1]?.t ?? 0));
});

void test('the end cards read HEAD\'s day and count', () => {
  assert.equal(R.end.count, count('HEAD'));
  assert.equal(R.end.day, dayOf('HEAD'));
  assert.equal(R.end.from, 5729);
  assert.match(R.end.text, /^WILDSHARD · Day \d+ · [\d,]+ commits$/);
  assert.equal(R.end.cta, 'Play free · wildshard.io');
});

void test('every read block: ≤ 7 words and ≥ 1.2 s on screen (cap height: titles-check.mjs)', () => {
  const cards = buildCards(R, '/stills');
  assert.deepEqual(cards.map((c) => c.card), ['origin', 'wall', 'frame', 'frame', 'frame', 'breath', 'endCount', 'endCta']);
  for (const r of readSchedule(cards)) {
    assert.ok(wordCount(r.text) <= 7, `${r.card}: "${r.text}"`);
    assert.ok(r.to - r.from >= 1.2 - 1e-9, `${r.card}: "${r.text}" ${(r.to - r.from).toFixed(2)} s`);
  }
});
