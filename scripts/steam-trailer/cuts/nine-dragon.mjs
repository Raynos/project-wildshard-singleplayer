// E169 F3 — the Nine Dragon Stack COMING SOON teaser (15.0 s): the cut config for
//   node scripts/steam-trailer/cut.mjs <outDir> <take.wav> <sfxDir> --cut nine-dragon [--portrait]
// Picture: shots/nine-dragon.mjs (the in-engine partial shard). Sound (Jake's shortest path, 2026-09-26): ONE MiniMax
// Music 3 cue (nine-dragon-jobs.json, take 302), the game's own sound set (public/assets/sfx/best/: the rain bed, the
// sword) and E168's trailer sound design (<sfxDir>/tr-*.wav: the whoosh, riser, reverse cymbal, impact, braam, sub drop —
// each already made with MOSS-SoundEffect v2 and Stable Audio 3 Medium and CLAP-picked). No new SFX generation.
// --portrait: the same cut on the portrait captures (1080×1920).
import { rigAt } from '../shots/lib.mjs';
import { shots } from '../shots/nine-dragon.mjs';

/**
 * The score: MiniMax take 302 (30 s, 90 bpm: a beat 0.667 s, a bar 2.67 s). Its melodic intro (erhu-like glides over a
 * drone) runs to 16.03, where drums and bass enter together on one kick — the DROP; after it the kick marks every bar
 * (16.03, 18.70, 21.37, 24.04, 26.71). htdemucs: no vocals (0.1 %).
 *   trailer 0 → src 13.03 (the last 3 s of the intro, building) · 3.00 = src 16.03 the drop = the rim breach
 *   11.00 = src 24.04: the music drops out for one beat (the grapple lands) · 11.67 = src 26.71: the last bar's
 *   kick = the end card; the take plays out to its end (30.02) under the card, faded.
 */
export const SCORE = { seed: 302, OFF: 13.03, DROP: 16.03, OUT: 24.04, HIT_SRC: 26.71, BREACH: 3.0, GAP: 11.0, END_HIT: 11.67 };

/** @param {{ TAKE: string, SFX: string, portrait?: boolean }} io */
export function cut({ TAKE, SFX, portrait = false }) {
  const LEN = 15.0;
  const { OFF, OUT, HIT_SRC, BREACH, GAP, END_HIT } = SCORE;
  const BEAT = 60 / 90;
  const mid = 'nd-grapple';
  // [trailer start, shot, in-point (s), grade?, flash?] — each clip runs to the next row's start. Cuts on the beats after
  // the drop (3.00 + k · 0.667): the breach holds a bar, the jian 3 beats, the stairs 2, the grapple 4 (into the gap).
  const rows = [
    [0.00, 'nd-rise', 0.3, 'nine-dragon'],
    [BREACH, 'nd-breach', 0.1, 'nine-dragon'],
    [BREACH + 4 * BEAT, 'nd-jian', 0.0, 'nine-dragon'],
    [BREACH + 7 * BEAT, 'nd-stairs', 0.3, 'nine-dragon'],
    [BREACH + 9 * BEAT, mid, 0.0, 'nine-dragon'],
    [END_HIT, 'nd-wide', 0.2, 'nine-dragon', 0.08],
  ];
  for (const row of rows) row[0] = Number(row[0].toFixed(3));
  const clips = rows.map(([at, shot, inp, grade, flash], k) => {
    const end = k + 1 < rows.length ? rows[k + 1][0] : LEN;
    const c = { at, shot, in: inp, dur: Number((end - at).toFixed(4)) };
    if (grade) c.grade = grade;
    if (flash) c.flashIn = flash;
    return c;
  });
  const clip = (shot) => { const c = clips.find((x) => x.shot === shot); if (!c) throw new Error(`no clip ${shot}`); return c; };
  /** trailer time of an event `t` s into a shot's capture */
  const on = (shot, t) => { const c = clip(shot); return Number((c.at + t - c.in).toFixed(3)); };

  // ── titles ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // the altimeter reads the rise's camera height (the cube's altitude: Lantern Square is +125 m), then lands on the square
  const rise = shots.find((s) => s.name === 'nd-rise'), rc = clip('nd-rise');
  const riseRig = portrait && rise.portrait?.rig ? rise.portrait.rig : rise.rig;
  const ALT_AT = 0.15, ALT_END = BREACH + 2.0;
  const track = [];
  for (let t = 0; t <= BREACH - ALT_AT + 1e-6; t += 1 / 30) track.push([Number(t.toFixed(4)), Number(rigAt(riseRig, rc.in + ALT_AT + t).p[1].toFixed(2))]);
  const titles = [
    { id: 'alt', card: 'alt', at: ALT_AT, dur: Number((ALT_END - ALT_AT).toFixed(3)), track, land: Number((BREACH - ALT_AT).toFixed(3)), final: 125,
      kicker: 'Shard IV', label: 'The Yamen Well', finalLabel: 'Lantern Square' },
    { id: 'teaser', card: 'teaser', at: END_HIT, dur: Number((LEN - END_HIT).toFixed(3)),
      kicker: 'Project Wildshard · Shard IV', mark: '九龍疊城', name: 'Nine Dragon Stack', cta: 'Coming soon',
      credits: ['Music: MiniMax-Music3', 'Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 — Powered by Stability AI', 'Captured in engine · prototype footage']
        .join(portrait ? '<br>' : ' &nbsp;·&nbsp; ') },
  ];

  // ── sound ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // E168's picks (<sfxDir>/picks.json): the riser is full by ~3.25 s, the reverse cymbal peaks at 1.31 s, the whoosh at
  // 1.34 s, the sub drop (MOSS seed 3, the one that falls and decays) at once
  const RISE = { peak: 3.25 }, REV = { peak: 1.31, dur: 1.31 }, WHOOSH = { peak: 1.34 };
  const ev = [];
  const add = (sound, at, gain_db = 0, extra = {}) => { if (at > -5 && at < LEN) ev.push({ sound, at: Number(at.toFixed(3)), gain_db, ...extra }); };
  // the rise into the breach: the riser climbing with the camera, a reversed cymbal, both topping out on the drop
  add('tr:riser', BREACH, -11, RISE);
  add('tr:reverse', BREACH, -7, REV);
  // the rim breach on the drop: an impact, a whoosh over the rail
  add('tr:impact', BREACH, -5);
  add('tr:whoosh', on('nd-breach', 1.3), -14, { ...WHOOSH, pan: 0.25 });
  // the jian (shots/nine-dragon.mjs nd-jian): drawn up into the frame 0.1–0.45 (the blade's ring), a slash at 0.62 and a
  // backhand at 1.29 on the beats (the engine's own swing, the trailer sword's ring over it)
  add('game:weaponSwap', on('nd-jian', 0.08), -10);
  add('tr:sword', on('nd-jian', 0.3), -12, { pan: 0.15 });
  add('game:swordSwing', on('nd-jian', 0.64), -6, { pan: 0.2 });
  add('tr:sword', on('nd-jian', 0.66), -13, { pan: 0.25 });
  add('game:swordSwing', on('nd-jian', 1.31), -7, { pan: -0.2, take: 1 });
  // the stair-street: a soft whoosh up the steps
  add('tr:whoosh', on('nd-stairs', 0.9), -17, { ...WHOOSH, pan: -0.2 });
  // The hook fires at 0.24 s, bites, then the zip crosses the Well and lands before the end-card gap.
  add('tr:impact', on(mid, 0.5), -9);
  add('tr:whoosh', on(mid, 1.15), -9, WHOOSH);
  add('tr:riser', GAP + 0.6, -16, RISE);
  // the end card: the reversed cymbal through the gap into the last hit (braam + impact + sub drop)
  add('tr:reverse', END_HIT, -5, REV);
  add('tr:braam', END_HIT, -4);
  add('tr:impact', END_HIT, -3);
  add('tr:subdrop-decay', END_HIT, -7);

  const mix = {
    length: LEN, sfxdir: SFX,
    music: {
      file: TAKE,
      segments: [[OFF, OUT, 0], [HIT_SRC, HIT_SRC + (LEN - END_HIT), END_HIT]],
      gain_db: 0,
      fades: [[0, 0.3, 'in'], [LEN - 1.6, 1.6, 'out']],
    },
    duck: [{ at: BREACH - 0.2, dur: 0.25, db: -2 }],
    beds: [
      { sound: 'game:bed-rain', at: 0, dur: LEN, gain_db: -19, fade: 0.8 },
    ],
    events: ev.sort((a, b) => a.at - b.at),
  };
  const edl = { length: LEN, clips, titles, ...(portrait ? { size: [1080, 1920] } : {}) };
  return { edl, titles, mix, report: `${ev.length} sound events; breach ${BREACH}, gap ${GAP}, end card ${END_HIT}; grapple` };
}
