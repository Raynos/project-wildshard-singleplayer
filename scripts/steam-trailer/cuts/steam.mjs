// E168 Steam trailer — the cut: one table for picture, titles and sound, timed to the score.
//   the cut config for `node scripts/steam-trailer/cut.mjs <outDir> <musicTake.wav> <sfxDir> --cut steam` (the default)
//
// The score is MiniMax Music 3 take 204 (scripts/steam-trailer/steam-jobs.json → seed 204). Trailer time t plays source
// time t + OFF until the splice; its drum hits (music_scan.py / htdemucs drums) set every cut:
//   src 12.82 band enters  → 3.16    src 23.4 drop → 13.74 (the breath before Nalati)
//   src 24.66 percussion   → 15.00   (Nalati opens on the hit)
//   src 33.41 full peak    → 23.75   (the Storm Titan)
//   src 40.01 hit          → 30.35   (Pine Hollow opens on the hit)
//   src 50.92 peak ends    → 41.26   splice to src 54.24 (the break's last two beats) → src 55.31 final hit at 42.33 (end card)
// A bar is 2.18 s (110 bpm): the mid-shard cuts sit on bar lines.
/** @param {{ TAKE: string, SFX: string }} io */
export default function cut({ TAKE, SFX }) {
  const OFF = 9.66, LEN = 45.0, SPLICE = 41.26, SRC_B = 54.24, HIT = SPLICE + (55.31 - SRC_B);

  // [trailer start, shot, in-point in the shot (s), grade?, flash?] — each clip runs to the next row's start
  const rows = [
    [0.00, 'd-open', 0.2],
    [3.16, 'd-pier', 0.5],
    [5.73, 'd-combo', 0.1],
    [7.91, 'd-lookout', 1.5],
    [10.09, 'd-bridge', 1.0],
    [12.27, 'd-shrine', 0.5],
    [13.74, 'd-wreck', 1.0],
    [15.00, 'n-open', 0.3, null, 0.14],
    [17.21, 'n-gallop', 0.5],
    [19.39, 'n-camp', 1.0],
    [21.57, 'n-archer', 0.2],
    [23.75, 'n-titan', 0.4],
    [27.00, 'n-titan-fp', 0.2],
    [30.35, 'p-dawn', 0.5, null, 0.14],
    [32.53, 'p-stones', 0.8],
    [34.71, 'p-elite', 1.2],
    [36.89, 'p-pond', 0.8],
    [39.07, 'p-king', 0.5, 'night'],
    [41.26, 'black', 0],   // the score's break: cut to black under the King's roar, then the final hit slams the end card
    [HIT, 'p-final', 0.5],
  ];
  const clips = rows.map(([at, shot, inp, grade, flash], k) => {
    const end = k + 1 < rows.length ? rows[k + 1][0] : LEN;
    const c = { at, shot, in: inp, dur: Number((end - at).toFixed(4)) };
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
  const inClip = (shot, t) => { const c = clips.find((x) => x.shot === shot); return t >= c.in && t < c.in + c.dur; };

  const titles = [
    { id: 'shard-1', card: 'shard', at: 0.4, dur: 2.72, kicker: 'Shard I', name: 'Driftwood Isle', sub: 'Explore · Climb · Fight' },
    { id: 'shard-2', card: 'shard', at: 15.15, dur: 2.0, kicker: 'Shard II', name: 'Nalati Grasslands', sub: 'Ride · Hunt · Tame' },
    { id: 'shard-3', card: 'shard', at: 30.5, dur: 2.0, kicker: 'Shard III', name: 'Pine Hollow', sub: 'Track · Hunt · Face the King' },
    { id: 'end', card: 'end', at: Number(HIT.toFixed(3)), dur: Number((LEN - HIT).toFixed(3)) },
  ];

  // ── sound ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const ev = [];
  const add = (sound, at, gain_db = 0, extra = {}) => { if (at >= 0 && at < LEN) ev.push({ sound, at: Number(at.toFixed(3)), gain_db, ...extra }); };
  // gameplay, on the picture's own events (shot-relative times from shots/*.mjs)
  for (const T of [0.25, 0.65, 1.05]) if (inClip('d-combo', T)) { add('game:swordSwing', on('d-combo', T), -6, { take: Math.round(T * 3) % 2 }); add('game:swordHit-flesh', on('d-combo', T + 0.08), -9, { take: Math.round(T * 3) % 2 }); }
  if (inClip('d-combo', 2.1)) { add('game:swordHeavy', on('d-combo', 2.1), -4); add('game:boar_squeal', on('d-combo', 2.2), -8); add('game:kill', on('d-combo', 2.25), -8); }
  add('game:monkey_chatter', on('d-lookout', 2.0), -12, { pan: -0.3 });
  add('game:footstep-planks', on('d-bridge', 1.2), -14); add('game:footstep-planks', on('d-bridge', 1.62), -14, { take: 1 }); add('game:footstep-planks', on('d-bridge', 2.05), -14);
  add('game:footstep-planks', on('d-bridge', 2.5), -14, { take: 1 }); add('game:footstep-planks', on('d-bridge', 2.92), -14);
  add('game:gull', on('d-open', 1.2), -12, { pan: 0.4 });
  add('game:hoofsteps', on('n-gallop', 0.5), -6, { dur: 2.2 });
  add('game:horse_snort', on('n-gallop', 1.6), -12);
  add('game:hoofsteps', on('n-archer', 0.2), -8, { dur: 2.2, take: 1 });
  add('game:bowDraw', on('n-archer', 0.5), -6); add('game:bowTwang', on('n-archer', 1.6), -4); add('game:arrowWhoosh', on('n-archer', 1.62), -8);
  add('game:lightningCrackle', on('n-titan', 1.0), -6); add('game:thunder-near', on('n-titan', 1.1), -4);
  add('game:bowDraw', on('n-titan-fp', 0.4), -6, { take: 1 }); add('game:bowTwang', on('n-titan-fp', 1.5), -4, { take: 1 }); add('game:arrowWhoosh', on('n-titan-fp', 1.52), -8, { take: 1 });
  add('game:bowDraw', on('n-titan-fp', 2.3), -6); add('game:bowTwang', on('n-titan-fp', 3.4), -4);
  add('game:lightningCrackle', on('n-titan-fp', 2.8), -8, { take: 1 }); add('game:thunder-far', on('n-titan-fp', 3.0), -8);
  add('game:crossbowFire', on('p-elite', 2.4), -3); add('game:boltImpact-flesh', on('p-elite', 2.55), -6);
  add('game:king_call', on('p-king', 0.9), -4); add('game:bear_roar', on('p-king', 1.3), -8);
  add('game:king_call', 41.3, -3, { take: 1 }); add('game:bear_roar', 41.35, -6, { take: 1 });
  // trailer sound design: the shard changes, the reveals, the end. Peaks from sfx best/picks.json: the riser is full by
  // 2.7 s and holds, so it is cut at 4.0 s = on the hit; the reverse cymbal is cut at its 1.31 s peak; the whoosh centres
  // its 1.34 s peak on the cut. The sub drop is MOSS seed 3 (the only take that falls and decays; the CLAP pick held flat).
  const RISE = { peak: 4.0, dur: 4.0 }, REV = { peak: 1.31, dur: 1.31 }, WHOOSH = { peak: 1.34 };
  add('tr:reverse', 15.0, -4, REV); add('tr:riser', 15.0, -8, RISE);
  add('tr:impact', 15.0, -2); add('tr:whoosh', 15.0, -8, WHOOSH);
  add('tr:braam', 23.75, -3); add('tr:subdrop-decay', 23.75, -6);
  add('tr:reverse', 30.35, -6, REV); add('tr:impact', 30.35, -3); add('tr:whoosh', 30.35, -8, { ...WHOOSH, pan: -0.3 });
  add('tr:sword', on('d-combo', 2.1), -10);
  add('tr:riser', HIT, -6, RISE); add('tr:reverse', HIT, -5, REV);
  add('tr:braam', HIT, -1); add('tr:impact', HIT, -2); add('tr:subdrop-decay', HIT, -5);

  const mix = {
    length: LEN, sfxdir: SFX,
    music: {
      file: TAKE,
      segments: [[OFF, OFF + SPLICE, 0], [SRC_B, SRC_B + (LEN - SPLICE), SPLICE]],
      gain_db: 0,
      fades: [[0, 0.25, 'in'], [HIT + 1.3, LEN - HIT - 1.3, 'out']],
    },
    duck: [{ at: 13.74, dur: 1.2, db: -3 }, { at: 23.6, dur: 0.6, db: -2 }],
    beds: [
      { sound: 'game:bed-island', at: 0, dur: 15.2, gain_db: -20 },
      { sound: 'game:bed-steppe-wind', at: 14.9, dur: 8.9, gain_db: -20 },
      { sound: 'game:bed-stormwind', at: 23.6, dur: 6.9, gain_db: -21 },
      { sound: 'game:bed-forest', at: 30.2, dur: 8.9, gain_db: -19 },
      { sound: 'game:bed-steppe-night', at: 39.0, dur: 6.0, gain_db: -20 },
    ],
    events: ev.sort((a, b) => a.at - b.at),
  };

  return { edl: { length: LEN, clips, titles }, titles, mix, report: `${ev.length} sound events; end card at ${HIT.toFixed(2)}` };
}
