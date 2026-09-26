"""E168: split a trailer take with htdemucs (the repo's stems.py separate()) — the vocal share per 2 s window (MiniMax
sometimes sings on an "instrumental" brief) and the stems as WAVs, so the mix can lift the drums on the hits.
    ~/ml/music/analysis/.venv/bin/python scripts/steam-trailer/music_stems.py <take.wav> <outdir>"""
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "music/gen"))
from stems import separate  # noqa: E402

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
x, sr = librosa.load(str(src), sr=44100, mono=False)
st = separate(x, sr)
for k, v in st.items():
    sf.write(str(out / f"{k}.wav"), v.T, sr)
tot = sum((v ** 2).sum() for v in st.values())
print({k: round(float((v ** 2).sum() / tot), 3) for k, v in st.items()})
voc = st["vocals"].mean(0) ** 2
allp = sum(v.mean(0) ** 2 for v in st.values())
w = 2 * sr
print("vocal share per 2 s:", " ".join(f"{voc[i:i + w].sum() / (allp[i:i + w].sum() + 1e-9):.2f}" for i in range(0, len(voc), w)))
