"""MUSIC.md v3 row 10: re-score the 15 s / 30 s trailers with the shipped MiniMax piano title theme.

    ~/ml/music/analysis/.venv/bin/python scripts/trailer/score_minimax.py

The picture is unchanged (cut.sh + the EDLs made it; its frames are not kept), so this swaps the audio track of
public/trailer-{15,30}.mp4 in place: video stream copied bit for bit, new AAC 160 kb/s audio.
The score is a window of the piano title file named in public/assets/music/piano/music.json placed so that its strongest bar-aligned energy rise
(the groove coming in) lands on the cut's first sword swing - 12.8 s in the 30 s cut, 5.3 s in the 15 s cut (the
EDL cue points in MUSIC.md). The dive shot gets the in-game underwater treatment (a 500 Hz low-pass while the camera
is under), 0.4 s fade-in, 1 s fade-out on the end card.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / "public/assets/music/piano/music.json"
CUTS = {  # name: (length s, first swing s, underwater window s) - from scripts/trailer/edl-*.txt
    "trailer-30": (28.1, 12.8, (15.0, 16.4)),
    "trailer-15": (14.9, 5.3, (6.7, 7.6)),
}


def decode(path: Path, sr: int = 48000) -> np.ndarray:
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"],
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).T.copy()


def main() -> None:
    sr = 48000
    spec = json.loads(MANIFEST.read_text())["slots"]["title"]
    x = decode(MANIFEST.parent / spec["full"])
    bar = 4 * 60.0 / spec["bpm"]
    y = librosa.to_mono(x)
    hop = 480
    rms = librosa.feature.rms(y=y, frame_length=4096, hop_length=hop)[0]
    t_r = np.arange(len(rms)) * hop / sr
    dur = x.shape[1] / sr
    report = {}
    for name, (length, swing, (uw0, uw1)) in CUTS.items():
        # candidate hits: downbeats of the title's grid (loopStart is a downbeat)
        downs = np.arange(spec["loopStart"] % bar, dur, bar)
        best, best_s = None, -1.0
        for d in downs:
            s0 = d - swing
            if s0 < 0 or s0 + length > dur:
                continue
            before = rms[(t_r >= d - bar) & (t_r < d)].mean()
            after = rms[(t_r >= d) & (t_r < d + bar)].mean()
            rise = after / (before + 1e-6)
            if rise > best_s:
                best, best_s = s0, rise
        if best is None:
            best, best_s = 0.0, 0.0
        a, b = int(best * sr), int((best + length) * sr)
        seg = x[:, a:b]
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "score.wav"
            sf.write(str(wav), seg.T, sr)
            src = REPO / f"public/{name}.mp4"
            tmp = Path(td) / f"{name}.mp4"
            af = (f"lowpass=f=500:enable='between(t,{uw0},{uw1})',afade=t=in:st=0:d=0.4,"
                  f"afade=t=out:st={length - 1.0:.2f}:d=1.0,loudnorm=I=-16:TP=-1.5:LRA=11")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
                            "-af", af, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest",
                            "-movflags", "+faststart", str(tmp)], check=True)
            tmp.replace(src)
        report[name] = {"title_offset_s": round(best, 3), "energy_rise_at_swing": round(float(best_s), 2)}
        print(f"{name}: {spec['full']} from {best:.2f}s, swing at {swing}s lands on a {best_s:.2f}x energy rise")
    (REPO / "scripts/trailer/score-minimax.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
