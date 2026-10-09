// E466 TRAILERS — the alpha trailer (~63 s, 16:9): the cut config for
//   node scripts/steam-trailer/cut.mjs <outDir> <take.wav> <sfxDir> --cut alpha [--build <build-beat.mp4>] [--bug <bug.png>]
// Picture: every shard's in-engine captures (shots/*.mjs) at HEAD, plus one finished clip, the build beat (a real Claude Code
// session beside the Sky Reach grey-to-final time-lapse, made by build-beat.mjs). Alpha is said three ways (Jake,
// 2026-10-09): the opening card, the ALPHA · IN ENGINE corner bug on every frame between them, the end card.
// Sound: ONE MiniMax Music 3 cue (alpha-jobs.json, take 304), the game's own sound set (public/assets/sfx/best/) on the
// picture's events, and the trailer sound design (<sfxDir>/tr-*.wav, MOSS v2 + SA3 Medium, CLAP-picked) on the cuts.

/**
 * The score: take 304 (70 s, a beat 0.905 s = 66 bpm half-time, a bar 3.62 s). Trailer time t plays source time t + OFF.
 *   src 0–10.4   the drone              → the alpha card (t 0–3.77)
 *   src 10.37    the first soft onset   → the cold open (Driftwood from the sea)
 *   src 14.90    the hit (0.80)         → t 8.30, the shards run
 *   src 37.49    the breath             → t 30.89, the build beat (the hit inside it, src 42.90, is t 36.30)
 *   src 45.62    the band returns       → t 39.02, the second run
 *   src 65.52    the drop               → t 58.92, the end card; the tail fades out by t 63.2
 */
export function cut({ TAKE, SFX, BUILD, BUG }) {
  const OFF = 6.6, LEN = 63.2, END = 58.92;
  const beat = (src) => Number((src - OFF).toFixed(3));

  // [trailer start, shot, in-point in the shot (s), grade?, flash?] — each clip runs to the next row's start
  const rows = [
    [0.00, 'black', 0],
    [beat(10.37), 'd-open', 0.0],
    [beat(14.90), 'd-combo', 0.9, null, 0.12],
    [beat(16.71), 'd-lookout', 1.0],
    [beat(18.52), 'd-wreck', 1.5],
    [beat(20.32), 'n-open', 0.3, null, 0.14],
    [beat(23.02), 'n-herd', 0.8],
    [beat(24.82), 'n-camp', 1.0],
    [beat(26.63), 'n-bow', 0.5],
    [beat(28.43), 'p-dawn', 0.5, null, 0.14],
    [beat(31.15), 'p-pond', 1.2],
    [beat(32.96), 'p-final', 1.0],
    [beat(34.77), 'p-king', 0.6, 'night'],
    [beat(37.49), 'build', 0],
    [beat(45.62), 'dn-vista', 0.3, null, 0.14],
    [beat(48.33), 'dn-tower', 0.5],
    [beat(50.10), 'sr-rise', 0.3, null, 0.14],
    [beat(52.86), 'sr-roc', 0.5],
    [beat(54.65), 'nd-breach', 0.4, null, 0.14],
    [beat(57.36), 'nd-stairs', 0.4],
    [beat(59.18), 'g-reveal', 0.3],
    [beat(62.79), 'p-king-fp', 1.0],
    [beat(63.69), 'nd-jian', 0.6],
    [beat(64.59), 'n-archer', 1.4],
    [END, 'p-final', 0.6], // under the end card's veil
  ];
  const clips = rows.map(([at, shot, inp, grade, flash], k) => {
    const end = k + 1 < rows.length ? rows[k + 1][0] : LEN;
    const c = { at, shot, in: inp, dur: Number((end - at).toFixed(4)) };
    if (shot === 'build') c.video = BUILD;
    if (grade) c.grade = grade;
    if (flash) c.flashIn = flash;
    return c;
  });
  /** trailer time of an event `t` s into a shot's capture */
  const on = (shot, t) => {
    const c = clips.find((x) => x.shot === shot);
    if (!c) throw new Error(`no clip ${shot}`);
    return Number((c.at + t - c.in).toFixed(3));
  };
  const inClip = (shot, t) => { const c = clips.find((x) => x.shot === shot); return Boolean(c) && t >= c.in && t < c.in + c.dur; };
  const at = (shot) => clips.find((x) => x.shot === shot).at;

  const titles = [
    { id: 'alpha', card: 'alpha', at: 0, dur: beat(10.37) },
    { id: 'shard-1', card: 'shard', at: at('d-open') + 0.4, dur: 3.6, kicker: 'Shard I · Toon', name: 'Driftwood Isle', sub: 'Explore · Climb · Fight' },
    { id: 'shard-2', card: 'shard', at: at('n-open') + 0.2, dur: 2.4, kicker: 'Shard II · Painterly', name: 'Nalati Grasslands', sub: 'Ride · Hunt · Tame' },
    { id: 'shard-3', card: 'shard', at: at('p-dawn') + 0.2, dur: 2.4, kicker: 'Shard III · Photoreal', name: 'Pine Hollow', sub: 'Track · Hunt · Face the King' },
    { id: 'build', card: 'caption', at: at('build') + 0.4, dur: 7.4, kicker: 'Built in Claude Code', text: 'A real session · sped up' },
    { id: 'shard-4', card: 'shard', at: at('dn-vista') + 0.2, dur: 2.4, kicker: 'Shard IV · Dusk', name: 'Signal Dunes', sub: 'Whip · Climb · Light the fires' },
    { id: 'shard-5', card: 'shard', at: at('sr-rise') + 0.2, dur: 2.4, kicker: 'Shard V · Golden hour', name: 'Sky Reach', sub: 'Cross · Hover · Mend the bridge' },
    { id: 'shard-6', card: 'shard', at: at('nd-breach') + 0.2, dur: 2.4, kicker: 'Shard VI · Neon', name: 'Nine Dragon Stack', sub: 'Climb · Grapple · Duel' },
    { id: 'grid', card: 'caption', at: at('g-reveal') + 0.2, dur: 3.2, kicker: 'One world', text: 'Every shard on one grid' },
    { id: 'end', card: 'endA', at: END, dur: Number((LEN - END).toFixed(3)) },
  ];

  // ── sound ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const ev = [];
  const add = (sound, t, gain_db = 0, extra = {}) => { if (t >= 0 && t < LEN) ev.push({ sound, at: Number(t.toFixed(3)), gain_db, ...extra }); };
  // gameplay, on the picture's own events (shot-relative times from shots/*.mjs)
  for (const T of [1.05]) if (inClip('d-combo', T)) { add('game:swordSwing', on('d-combo', T), -6); add('game:swordHit-flesh', on('d-combo', T + 0.08), -9); }
  if (inClip('d-combo', 2.1)) { add('game:swordHeavy', on('d-combo', 2.1), -4); add('game:boar_squeal', on('d-combo', 2.2), -8); add('game:kill', on('d-combo', 2.25), -8); }
  add('game:horse_neigh', on('n-herd', 1.4), -14, { pan: 0.3 });
  add('game:bowDraw', on('n-bow', 0.7), -8); add('game:bowTwang', on('n-bow', 1.9), -6);
  add('game:king_call', on('p-king', 0.9), -4); add('game:bear_roar', on('p-king', 1.3), -8);
  add('game:swordSwing', on('nd-jian', 0.64), -8, { pan: 0.2 });
  add('game:bowTwang', on('n-archer', 1.6), -6, { take: 1 }); add('game:arrowWhoosh', on('n-archer', 1.62), -9);
  // trailer sound design on the structure: the hit, every shard change, the breath, the return, the end card
  const RISE = { peak: 4.0, dur: 4.0 }, REV = { peak: 1.31, dur: 1.31 }, WHOOSH = { peak: 1.34 };
  add('tr:riser', at('d-combo'), -10, RISE); add('tr:impact', at('d-combo'), -3); add('tr:subdrop', at('d-combo'), -6);
  for (const s of ['n-open', 'p-dawn', 'dn-vista', 'sr-rise', 'nd-breach']) { add('tr:reverse', at(s), -7, REV); add('tr:whoosh', at(s), -10, WHOOSH); }
  add('tr:subdrop', at('build'), -6);
  add('tr:reverse', at('dn-vista'), -5, REV); add('tr:impact', at('dn-vista'), -4);
  add('tr:whoosh', at('g-reveal'), -8, { ...WHOOSH, pan: -0.3 });
  add('tr:riser', END, -7, RISE); add('tr:braam', END, -2); add('tr:impact', END, -3); add('tr:subdrop', END, -5);

  const mix = {
    length: LEN, sfxdir: SFX,
    music: { file: TAKE, segments: [[OFF, OFF + LEN, 0]], gain_db: 0, fades: [[0, 0.4, 'in'], [END + 2.2, LEN - END - 2.2, 'out']] },
    duck: [{ at: at('build'), dur: 0.8, db: -2 }],
    beds: [
      { sound: 'game:bed-steppe-larks', at: at('n-open'), dur: at('p-dawn') - at('n-open') + 0.3, gain_db: -22 },
      { sound: 'game:bed-forest', at: at('p-dawn'), dur: at('p-king') - at('p-dawn'), gain_db: -20 },
      { sound: 'game:bed-steppe-night', at: at('p-king'), dur: at('build') - at('p-king') + 0.3, gain_db: -21 },
      { sound: 'game:bed-coldwind', at: at('dn-vista'), dur: at('sr-rise') - at('dn-vista'), gain_db: -22 },
      { sound: 'game:bed-highwind', at: at('sr-rise'), dur: at('nd-breach') - at('sr-rise'), gain_db: -21 },
      { sound: 'game:bed-rain', at: at('nd-breach'), dur: at('g-reveal') - at('nd-breach'), gain_db: -20 },
    ],
    events: ev.sort((a, b) => a.at - b.at),
  };

  const overlays = BUG ? [{ png: BUG, from: Number(at('d-open').toFixed(3)), to: END }] : [];
  return { edl: { length: LEN, clips, titles, overlays }, titles, mix, report: `${ev.length} sound events; end card at ${END}` };
}
