// E466 TRAILERS CT6 — the cinematic concept trailer, draft 1 (~67 s, 1920 × 1080): the cut config for
//   node scripts/steam-trailer/cut.mjs <outDir> <take.wav> <sfxDir> --cut concept --build <shotsDir>
// Picture: the generated shots (docs/plans/trailers/ct2-script.md draft 3), each pre-conformed to 1920 × 1080 by
// cinematic/prep_concept.sh as <shotsDir>/<id>.mp4 (b14 already reversed; b03 a wipe between two aligned stills; b15
// a hold on b07). Draft 1 has no terminal insert (council R2C-3: the recorded session is another job; draft 2 records one).
// Labels (R1C-4, R1A-10): CONCEPT TRAILER · NOT GAMEPLAY on every frame (a still overlay), the full label over shot 1,
// five captions (council R2C-6), the end card. Sound: MiniMax take 404 of concept-jobs.json from 2.84 s, so its big hit (src 24.84)
// lands on the cut into shot 6 at 22.0; the trailer SFX set on the structure.

/** @param {{ TAKE: string, SFX: string, BUILD: string, BUG?: string }} io */
export function cut({ TAKE, SFX, BUILD, BUG }) {
  const OFF = 2.84, LEN = 67.0, END = 62.0, HIT = 22.0;
  // [start, shot id, in-point (s)] — each runs to the next row's start
  const rows = [
    [0.0, 'b01', 0], [4.0, 'b02', 0], [8.0, 'b03', 0], [14.0, 'b04', 0], [18.0, 'b05', 0],
    [HIT, 'b06', 0], [28.0, 'b07', 0], [32.0, 'b08', 0], [36.0, 'b09', 0], [40.0, 'b10', 0], [44.0, 'b11', 0],
    [48.0, 'b12', 0], [52.0, 'b13', 0], [56.0, 'b14', 0], [END, 'b15', 0],
  ];
  const clips = rows.map(([at, shot, inp], k) => {
    const end = k + 1 < rows.length ? rows[k + 1][0] : LEN;
    return { at, shot, in: inp, dur: Number((end - at).toFixed(4)), video: `${BUILD}/${shot}.mp4` };
  });
  const at = (shot) => clips.find((c) => c.shot === shot).at;
  const titles = [
    { id: 'clabel', card: 'clabel', at: 0.3, dur: 3.4 },
    { id: 'cap1', card: 'bigcap', at: 4.4, dur: 3.4, text: 'Describe a world.' },
    { id: 'cap2', card: 'bigcap', at: 9.0, dur: 3.6, text: 'Claude Code builds it.' },
    { id: 'cap3', card: 'bigcap', at: 18.6, dur: 3.0, text: 'Upload it.' },
    { id: 'cap4', card: 'bigcap', at: 28.4, dur: 3.2, text: 'Players arrive.' },
    { id: 'cap5', card: 'bigcap', at: 36.4, dur: 3.2, text: 'Every shard built by a player.' },
    { id: 'end', card: 'endC', at: END, dur: LEN - END },
  ];
  const ev = [];
  const add = (sound, t, gain_db = 0, extra = {}) => { if (t >= 0 && t < LEN) ev.push({ sound, at: Number(t.toFixed(3)), gain_db, ...extra }); };
  const RISE = { peak: 3.25, dur: 3.25 }, REV = { peak: 1.31, dur: 1.31 }, WHOOSH = { peak: 1.34 };
  add('tr:reverse', at('b03'), -10, REV);
  add('tr:whoosh', at('b05') + 1.5, -9, WHOOSH);
  add('tr:riser', HIT, -8, RISE); add('tr:impact', HIT, -3); add('tr:braam', HIT, -5);
  for (const s of ['b08', 'b10', 'b12', 'b14']) add('tr:whoosh', at(s), -12, WHOOSH);
  add('tr:riser', END, -8, RISE); add('tr:braam', END, -3); add('tr:impact', END, -4);
  const mix = {
    length: LEN, sfxdir: SFX,
    music: { file: TAKE, segments: [[OFF, OFF + LEN, 0]], gain_db: 0, fades: [[0, 0.3, 'in'], [LEN - 2.5, 2.5, 'out']] },
    duck: [], beds: [], events: ev.sort((a, b) => a.at - b.at),
  };
  const overlays = BUG ? [{ png: BUG, from: 0, to: END }] : [];
  return { edl: { length: LEN, clips, titles, overlays }, titles, mix, report: `${ev.length} sound events; end card at ${END}` };
}
