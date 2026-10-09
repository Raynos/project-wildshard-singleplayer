"""Matched grid JPEG diagnostics; requires ImageMagick, no runtime/image changes.

python3 compare-grid.py proof-5b2e86cf7
Pairs are OFF | ON | absolute RGB difference x4. Percentages are diagnostic,
not a visual pass threshold. The second OFF capture supplies the noise floor.
"""
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
width, height = 402, 874


def load(variant, pose):
    path = root / f"matched-{variant}" / f"matched-{pose}.jpg"
    return subprocess.check_output([
        "magick", str(path), "-resize", f"{width}x{height}!", "-depth", "8", "rgb:-"
    ])


def stats(a, b, box):
    x0, y0, x1, y1 = box
    total = above8 = above24 = pixels = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            at = (y * width + x) * 3
            delta = [abs(a[at + c] - b[at + c]) for c in range(3)]
            total += sum(delta)
            above8 += max(delta) > 8
            above24 += max(delta) > 24
            pixels += 1
    return {"meanAbs": round(total / (pixels * 3), 4),
            "over8Percent": round(above8 * 100 / pixels, 4),
            "over24Percent": round(above24 * 100 / pixels, 4)}


result = {"units": "8-bit RGB; percentages of pixels by max-channel difference",
          "pairOrder": ["off", "on", "absolute difference x4"],
          "terrainBand": [45, 340, 340, 420], "poses": {}}
for pose in ["entry", "centre"]:
    off, noise, on = (load(v, pose) for v in ["off", "off2", "on"])
    result["poses"][pose] = {
        name: {"noise": stats(off, noise, box), "swap": stats(off, on, box)}
        for name, box in [("full", (0, 0, width, height)),
                          ("terrainBand", result["terrainBand"])]
    }
    rows = []
    for y in range(height):
        a = off[y * width * 3:(y + 1) * width * 3]
        b = on[y * width * 3:(y + 1) * width * 3]
        rows.append(a + b + bytes(min(255, abs(x - z) * 4) for x, z in zip(a, b)))
    ppm = f"P6\n{width * 3} {height}\n255\n".encode() + b"".join(rows)
    subprocess.run(["magick", "ppm:-", "-quality", "82",
                    str(root / f"pair-matched-{pose}.jpg")], input=ppm, check=True)
(root / "grid-pixel-diff.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
