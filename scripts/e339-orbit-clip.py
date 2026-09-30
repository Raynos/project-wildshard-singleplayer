#!/usr/bin/env python3
"""E339: join scripts/e339-angles.mjs --orbit recordings into one phone clip, each segment labelled (name · variant).

  python3 scripts/e339-orbit-clip.py <out.mp4> <webm>:<label>[,<webm>:<label>…] [--kbps 3500] [--crop 0.62]

--square keeps a W×W square round the centre (the orbit looks straight at the face); else --crop keeps the top fraction of the portrait frame (the head and chest: the orbit looks at the face), so the bits go to
the faces. H.264 high, +faststart, no audio.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
segs = [s.rsplit(":", 1) for s in sys.argv[2].split(",")]
opt = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
kbps = int(opt("--kbps", "3500"))
crop = float(opt("--crop", "0.62"))
square = "--square" in sys.argv   # a W×W square round the centre (an orbit that looks straight at the face)

probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", segs[0][0]],
                       capture_output=True, text=True, check=True).stdout.strip().split(",")
W, H0 = int(probe[0]) // 2 * 2, int(probe[1])
H = W if square else int(H0 * crop) // 2 * 2
Y0 = (H0 - H) // 2 // 2 * 2 if square else 0
font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", max(18, W // 26))
work = Path(tempfile.mkdtemp(prefix="e339-clip-"))
inputs, chains = [], []
for i, (webm, label) in enumerate(segs):
    lab = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lab)
    tw = d.textlength(label, font=font)
    pad = W // 40
    d.rectangle((pad, pad, pad + tw + 2 * pad, pad + font.size + 2 * pad), fill=(13, 27, 38, 205), outline=(143, 227, 255, 200))
    d.text((2 * pad, 1.6 * pad), label, font=font, fill=(143, 227, 255, 255))
    lp = work / f"label-{i}.png"
    lab.save(lp)
    inputs += ["-i", webm, "-i", str(lp)]
    chains.append(f"[{2 * i}:v]fps=30,crop={W}:{H}:0:{Y0},setsar=1[v{i}];[{2 * i + 1}:v]format=rgba[l{i}];[v{i}][l{i}]overlay=0:0,format=yuv420p[s{i}]")
flt = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[out]"
out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", flt, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow",
                "-profile:v", "high", "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 1.15)}k", "-bufsize", f"{kbps * 2}k", "-r", "30", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", str(out)], check=True)
print(f"{out}: {W}×{H}, {out.stat().st_size / 1e6:.1f} MB")
