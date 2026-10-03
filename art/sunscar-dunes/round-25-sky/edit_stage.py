"""edit_stage.py: the early stage as an edit of the late one (round 16).

The first early panorama (pano.py early) painted the afterglow far too tall: sampled at the five mock cameras, the best
fit to every mockup's sky bands was the LATE strip (early weight 0-0.1). So the early stage is now the late painting
edited to twenty minutes earlier, slice by slice (the same seven slices, so the stitch and its seams are the late one's):
the same horizon, clouds and composition, a warmer, brighter afterglow low over the horizon, fewer stars.

usage: python3 edit_stage.py   (writes early2/<slice>.png in parallel, then stitches early2/panorama.png)
"""
import os, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pano

HERE = pano.HERE
SRC, DST = os.path.join(HERE, 'late'), os.path.join(HERE, 'early2')
SLICES = [('A', 320), ('BL', 270), ('CL', 220), ('DL', 170), ('BR', 370), ('CR', 420), ('CLOSE', 110)]


def glow_text(a0):
    f = (pano.GLOW + 360 - a0) % 360 / pano.COV
    if 0.0 < f < 1.0:
        return f"The afterglow's hottest point is just above the horizon at {round(f * 100)}% of the width: there, a strong glowing orange-gold band hugs the horizon and the low cloud streaks are lit fiery coral and orange from below."
    near = min(abs((pano.GLOW + 360 - a0) % 360), abs((a0 + pano.COV - pano.GLOW) % 360))
    if near < 100:
        return "The afterglow is just off this slice's edge nearest it: the horizon there warms to salmon and rose, the low clouds catch a rose glow."
    return "This part of the sky faces away from the sunset: a dusky rose band low on the horizon under a deep blue-violet sky."


def one(name, a0):
    out = os.path.join(DST, f'{name}.png')
    if os.path.exists(out):
        return
    prompt = ("EDIT the attached painted panorama slice of a desert dusk sky so it shows the SAME sky about twenty minutes "
              "EARLIER, just after sunset. Keep the exact composition: the same level horizon at 88% of the height, the same "
              "distant dune silhouettes, the same cloud streaks in the same places and shapes, nothing moved, added or removed. "
              f"Change only the light: {glow_text(a0)} The sky above is a little lighter: dusky violet and blue-violet rather than "
              "night navy, the milky way gone, only a few of the brightest stars still showing high up. Keep it a clean, "
              "smooth, painterly matte painting with no banding, no text, no UI, no border, no watermark.")
    pano.run_codex(DST, name, [os.path.join(SRC, f'{name}.png')], prompt)


if __name__ == '__main__':
    os.makedirs(DST, exist_ok=True)
    ts = [threading.Thread(target=one, args=s) for s in SLICES]
    for t in ts: t.start()
    for t in ts: t.join()
    pano.stitch(DST)
