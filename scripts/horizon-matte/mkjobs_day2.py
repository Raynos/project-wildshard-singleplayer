"""The day-segment prompts of art/driftwood-isle/round-9-horizon (codex image_gen, one run per heading)."""
import json, os
import sys
# usage: mkjobs_day2.py <workdir>  (holds day-<h>.jpg captures + ref-hero.jpg; writes jobs-day2.json there)
H = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
REPO = '/Users/raynos/projects/games/wildshard-singleplayer'
OUT = f'{REPO}/art/driftwood-isle/round-9-horizon'

COMMON = """You are painting one segment of a 360-degree PAINTED HORIZON MATTE (the film matte-painting trick) for Driftwood Isle, a low-poly stylized first-person island game (three.js) in the style of the second attached image (the Driftwood Isle concept art: saturated tropical blue sky, white faceted low-poly cumulus, turquoise-to-cobalt sea, grey faceted rock sea stacks with green tops, fluffy low-poly palms).

The FIRST attached image is a real in-game frame looking straight out to sea from the island (camera 3 m above the sea, pitch exactly level, 95 degree horizontal field of view). Its horizon line is EXACTLY on the horizontal middle of the image (y = 50 %). EDIT that frame: keep the exact framing, the exact horizon height (the sea/sky line must stay exactly at the vertical middle), the sky gradient in the top third, and paint only the FAR DISTANCE, 2 to 5 km away, on and just above the horizon:
- everything sits ON the horizon line and is small and distant: the main island / sea-stack group is BOLD and readable: its tallest element reaches 13-16 % of the image height above the horizon line (about 10 degrees), the others 5-10 %; nothing near the camera, no foreground, no island shore, no beach, no boats, no birds, no people, no buildings;
- distant things are softened by blue sea haze (aerial perspective): lower contrast and bluer the farther they are, but still readable faceted low-poly shapes with crisp facet edges;
- a LOW BANK of soft white faceted cumulus clouds sits on the horizon ALL THE WAY ACROSS the full width of the image (its flat base on the horizon, tops 6-12 % of the image height above the horizon, with one or two bigger towering cumulus up to 20 % in the middle part), faceted low-poly like the concept art, a little hazy at their base, so the segments of the 360 panorama join;
- the upper 60 % of the sky stays the plain, clean gradient from the reference (no big clouds, no sun, no planet, no birds) - that part will be cut away;
- the lower half is open deep sea: turquoise-blue with faint facet ripples, deepening to cobalt near the horizon, a thin bright haze line on the horizon;
- LEFT 30 % and RIGHT 30 % of the image: only open sea, the low cloud bank and haze (no islands or rocks there), so that neighbouring segments blend. Put the islands / sea stacks in the MIDDLE 40 % of the width.
It must look like a clean, painterly-but-in-engine game background (like a Wind Waker / Sea of Thieves skybox matte), not a photo, no text, no UI, no watermark, no frame.
"""

SEG = {
    0: ("facing WEST; the high midday sun is to the upper LEFT (south), so rocks are lit from the left, shaded blue-violet on the right",
        "a cluster of 4 tall faceted grey sea stacks with green grassy tops and one natural rock arch, 2-4 km away, the tallest ~8 degrees high, with tiny white foam at their feet"),
    60: ("facing NORTH-NORTH-WEST; the sun is high BEHIND-LEFT of the camera, so the far shapes are front-lit and bright",
        "a long, low distant island 4-5 km away, pale blue-green through the haze, with a gentle hill, a fringe of tiny palm trees and a pale sand line, plus one small sea stack in front of it"),
    120: ("facing NORTH-NORTH-EAST; the sun is high BEHIND-RIGHT of the camera, front-lit",
        "a bigger far island 5 km away with a faceted low-poly volcanic peak (hazy blue, green lower slopes, a tiny wisp of cloud at its top) reaching ~9 degrees, with a taller towering cumulus behind it"),
    180: ("facing EAST; the high midday sun is to the upper RIGHT (south), rocks lit from the right",
        "three small separate islets 2-3 km away, each a faceted rock with 2-3 tiny palms and a pale sand rim, plus two thin faint sea stacks far behind in the haze"),
    240: ("facing SOUTH-SOUTH-EAST, toward the high sun (just above the top of the frame): shapes are BACKLIT - darker blue-grey silhouettes with bright warm rim light on their tops, a band of sparkling sun glitter on the sea below the sun, brighter warmer haze",
        "two tall slender backlit sea stacks and a low rocky reef 2-3 km away, silhouetted against the bright haze"),
    300: ("facing SOUTH-SOUTH-WEST, near the high sun (upper left, just above the frame): partly backlit, warm bright haze on the left",
        "a far chain of three low blue-grey islands 5 km away, receding into the haze, the nearest with a few tiny palms"),
}

jobs = []
for d, (light, content) in SEG.items():
    p = (COMMON + f"\nTHIS SEGMENT: {light}. In the middle 40 %: {content}.\n\n"
         "TASK FOR CODEX: Use the built-in image_gen tool to EDIT the FIRST attached reference image into exactly ONE "
         "landscape image, 1536x1024, as described above (same framing, horizon exactly at the vertical middle). One generation only. "
         "Do not write any code or files; just generate the image.")
    jobs.append({"id": f"day2-{d}", "inputs": [f"{H}/day-{d}.jpg", f"{H}/ref-hero.jpg"], "prompt": p, "out": f"{H}/gen-day2-{d}.png"})
json.dump(jobs, open(f'{H}/jobs-day2.json', 'w'), indent=1)
print(len(jobs))
