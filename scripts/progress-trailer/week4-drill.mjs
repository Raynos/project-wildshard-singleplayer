// week4-drill.mjs — PROGRESS-TRAILER §3.5's week-4 rule as a dry EDL (PT11, E468): add a chapter and the film still runs
// exactly 60 s (3,600 frames). The new chapter costs 12 s (an 8 s lapse, which takes the showpiece, and a 4 s play
// beat); the seconds come, in order, from (1) the oldest middle chapter folding into one 4 s beat (2.5 s lapse + 1.5 s
// shot), (2) the end cards shrinking from 6 s to 4 s, (3) every older lapse capping at 5 s. The cold open, the origin
// card, the day-1 wall and take, the breath and the rewind never compress.
//
//   node scripts/progress-trailer/week4-drill.mjs        prints the week-3 and week-4 EDLs' beats and asserts 3,600 frames
const FPS = 60;
const WEEK3 = [
  ['cold open', 2], ['origin card', 2], ['day-1 wall', 3], ['day-1 hunt', 5],
  ['week-1 lapse', 6], ['week-1 play', 4], ['week-2 lapse', 6], ['week-2 play', 4], ['week-3 lapse', 8], ['week-3 play', 4],
  ['breath', 2], ['rewind', 6], ['grid + end cards', 8],
];
const week4 = (beats) => {
  const out = [];
  for (const [name, s] of beats) {
    if (name === 'week-1 lapse') out.push(['week-1 folded: lapse', 2.5]);
    else if (name === 'week-1 play') out.push(['week-1 folded: one shot', 1.5]);
    else if (name === 'week-2 lapse') out.push([name, 5]);
    else if (name === 'week-3 lapse') { out.push([name, 5]); }
    else if (name === 'week-3 play') { out.push([name, s], ['week-4 lapse (showpiece)', 8], ['week-4 play', 4]); }
    else if (name === 'grid + end cards') out.push(['grid + end cards (cards 4 s)', 6]);
    else out.push([name, s]);
  }
  return out;
};
const frames = (beats) => beats.reduce((n, [, s]) => n + Math.round(s * FPS), 0);
for (const [label, beats] of [['week 3 (cut 1)', WEEK3], ['week 4 (drill)', week4(WEEK3)]]) {
  let at = 0;
  console.log(`\n${label}`);
  for (const [name, s] of beats) { console.log(`  ${at.toFixed(1).padStart(5)}  ${String(s).padStart(4)} s  ${name}`); at += s; }
  const n = frames(beats);
  console.log(`  = ${n} frames`);
  if (n !== 3600) throw new Error(`${label}: ${n} frames, not 3,600`);
}

export { week4, WEEK3 };
