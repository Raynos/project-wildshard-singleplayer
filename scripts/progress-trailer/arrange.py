#!/usr/bin/env python3
"""arrange.py — the progress trailer's score as an arrangement that grows like the game (PROGRESS-TRAILER §3.4, PT8).

    ~/ml/music/analysis/.venv/bin/python scripts/progress-trailer/arrange.py <stems dir> <out.wav> --in=<s> [--len=60]

The stems are one MiniMax take split by scripts/steam-trailer/music_stems.py (htdemucs: other / bass / drums / vocals).
The take's in-point `--in` puts its strongest downbeat on the rewind's impact. Each stem is unmuted at its chapter's
start with a half-bar fade (120 bpm: a bar is 2 s): `other` alone under day 1, + bass at week 1 (0:12), + drums at
week 2 (0:22), the full mix at week 3 (0:32), everything out for the breath (0:44–0:46), back in for the rewind (0:46);
the drop and the trailer families (riser, sub) are mix.py events, not this file. Writes 48 kHz stereo.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
stems_dir, out = Path(args[0]), Path(args[1])
T_IN, LEN = float(opt.get('in', '0')), float(opt.get('len', '60'))
# (stem, [(at, gain)…]) — the gain holds from `at` until the next point; each step fades over FADE seconds
PLAN = {
    'other':  [(0, 1.0), (44, 0.0), (46, 1.0)],
    'bass':   [(0, 0.0), (12, 1.0), (44, 0.0), (46, 1.0)],
    'drums':  [(0, 0.0), (22, 1.0), (44, 0.0), (46, 1.0)],
    'vocals': [(0, 0.0), (32, 1.0), (44, 0.0), (46, 1.0)],
}
FADE = 1.0

mix, sr = None, None
for stem, points in PLAN.items():
    path = stems_dir / f'{stem}.wav'
    if not path.exists():
        continue
    x, rate = sf.read(str(path), always_2d=True)
    sr = sr or rate
    a = int(T_IN * rate)
    x = x[a:a + int(LEN * rate)]
    if len(x) < int(LEN * rate):
        x = np.pad(x, ((0, int(LEN * rate) - len(x)), (0, 0)))
    t = np.arange(len(x)) / rate
    g = np.zeros_like(t)
    prev = points[0][1]
    g[:] = prev
    for at, gain in points[1:]:
        k = np.clip((t - at) / FADE, 0, 1)
        g = np.where(t >= at, prev + (gain - prev) * k, g)
        prev_mask = t >= at + FADE
        g[prev_mask] = gain
        prev = gain
    y = x * g[:, None]
    mix = y if mix is None else mix + y
if mix is None:
    sys.exit(f'no stems in {stems_dir}')
peak = np.abs(mix).max()
if peak > 0.98:
    mix *= 0.98 / peak
sf.write(str(out), mix, sr)
print(f'{out}: {len(mix) / sr:.2f} s at {sr} Hz, in-point {T_IN:.2f} s')
