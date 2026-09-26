#!/usr/bin/env python3
"""mkedits.py <capdir> <outdir> <jobs.json> [cams] — codex image_gen EDITS of the lab's own frames: the reachable
surface targets (same geometry and camera; only the surfaces are repainted). Style paragraph first (ART-STYLE-RESEARCH
§6 prompt A, trimmed to what an edit of this frame can show), then the surface brief, then the task."""
import json, sys

STYLE = ("STYLE (read first): 界画霓虹 Jiehua Neon. First-person portrait screenshot of a video game, standing on a wet "
         "granite plaza halfway up a colossal vertical Chinese megacity at deep blue hour in light rain. The world is drawn "
         "as a Song-dynasty jiehua ruled-line architectural painting: every building edge, slab, balcony rail, window "
         "mullion and pipe is a ruler-straight hairline of black ink of constant width, crisp and black near the viewer, "
         "fading to pale grey ink in the distance. Only a few things carry mineral colour: azurite-blue and "
         "malachite-green glazed roof tiles, cinnabar-red lacquer, red paper lanterns. The only saturated colour is neon, "
         "glowing softly into the wet air; the wet stone mirrors it as long vertical colour streaks.")

SURF = ("EDIT BRIEF: keep EXACTLY this frame's geometry, camera, composition, every object, every sign, every line and "
        "every window where it is. Change only the SURFACES, so that every surface reads HAND-PAINTED in that style "
        "instead of flat: the flagstones are worn, wet, dark blue-grey granite with painted grain, fine joints and shallow "
        "puddles that mirror the neon and the sky; the balustrade is rain-soaked grey granite with carved cloud-scroll "
        "reliefs outlined in ink, dark rain-grime runs streaming down, a wet sheen on its rail tops; the concrete tower "
        "walls carry ink-wash grime runs and water stains below every sill and slab; the glazed roof tiles are "
        "malachite / azurite with a worn glaze and ink contours on every tile; the lacquer posts are weathered cinnabar "
        "with crackle and worn edges; the timber shopfronts are weathered dark wood; the piers are layered with torn "
        "street posters. Grime is a darker ink wash, not photographic dirt. Keep it a painting, not a photo.")

TASK = ("TASK FOR CODEX: Use the built-in image_gen tool to EDIT the attached screenshot into exactly ONE portrait image "
        "with the same aspect ratio as described above. No device frame, no browser chrome, no watermark, no HUD. One "
        "generation only. Then copy the PNG that YOUR image_gen call produced (its path is in the tool result; other "
        "runs are writing to ~/.codex/generated_images at the same time, so never 'the newest file') to {out}. Create or "
        "modify no other file.")

capdir, outdir, jobs_path = sys.argv[1], sys.argv[2], sys.argv[3]
cams = sys.argv[4].split(',') if len(sys.argv) > 4 else ['corner', 'panel', 'shop', 'down']
jobs = []
for c in cams:
    out = f'{outdir}/edit-{c}.png'
    jobs.append({'id': f'edit-{c}', 'inputs': [f'{capdir}/{c}.jpg'], 'prompt': f'{STYLE}\n\n{SURF}\n\n{TASK.format(out=out)}', 'out': out})
json.dump(jobs, open(jobs_path, 'w'), indent=1, ensure_ascii=False)
print(len(jobs), 'jobs ->', jobs_path)
