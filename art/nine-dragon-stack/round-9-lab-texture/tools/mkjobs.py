#!/usr/bin/env python3
"""mkjobs.py <batch> — codex image_gen jobs for the P5 texture lab's painted surface swatches."""
import json, sys
SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/be65981d-8428-4bae-8549-6996f99c15c1/scratchpad/tex'

STYLE = ("STYLE (read first): 界画霓虹 Jiehua Neon. The world of a video game is painted as a Song-dynasty jiehua "
         "ruled-line architectural painting crossed with a rainy blue-hour Kowloon megacity: every surface is PAINTED "
         "by hand, fine black ink contour hairlines of constant width, layered watercolour and gouache washes, dry-brush "
         "grain, stippled grit, ink-wash grime runs and water stains, on a faint silk ground. Not a photograph, not a 3D "
         "render, not photo-scanned: an illustrator's painted surface. The attached images are crops of the game's "
         "concept art: match their painting technique, value range and level of detail exactly.")

SWATCH = ("TASK: Use the built-in image_gen tool to create exactly ONE square 1:1 image: a seamless TILEABLE texture "
          "swatch for a game material, seen perfectly straight on (orthographic, flat, no perspective, no vanishing "
          "point, no horizon), with even, flat, neutral lighting (no cast shadows from a light, no sun, no neon "
          "reflections, no vignette, no glare, no rain streaks in the air). The surface fills the whole frame edge to "
          "edge: no border, no frame, no background, no text labels, no watermark, no objects in front. It must tile: "
          "what leaves the left edge continues at the right edge, what leaves the top continues at the bottom. "
          "One generation only. Then copy the PNG that YOUR image_gen call produced (its path is in the tool result; "
          "other runs are writing to ~/.codex/generated_images at the same time, so never 'the newest file') to {out}. "
          "Create or modify no other file.")

JOBS = {
  'flag': (['t1-left.jpg', 't6-bal.jpg'],
    "SUBJECT: the top surface of ONE single large granite paving slab, a continuous stone surface with NO joints, no "
    "grid, no slab edges anywhere in the frame. Dark blue-grey granite, fine painted grain and speckle (black, grey and "
    "a few pale flecks), worn smooth by feet, a few hairline cracks drawn in fine ink, darker damp patches and shallow "
    "water-stain rings where puddles dried, soft mottling. Mid-dark value overall, low contrast, no strong features "
    "that would repeat visibly."),
  'stone': (['t2-balustrade.jpg', 't6-bal.jpg'],
    "SUBJECT: weathered grey granite of a carved stone balustrade (rails and posts), a vertical face. Mid-grey stone "
    "with painted grain, stippled pits and grit, darker vertical rain-grime runs streaming down from the top edge, "
    "water stains, a few chipped scars outlined in fine ink, faint lichen specks, soft mottling. No carving motif, no "
    "frame, no edges: just the stone surface."),
  'panel': (['t2-balustrade.jpg', 't1-left.jpg'],
    "SUBJECT: ONE carved stone balustrade panel seen straight on, filling the whole frame: a sunken field framed by a "
    "narrow double inset border (two thin ink-ruled rectangles near the frame's edge), and in the field a low-relief "
    "carving of auspicious clouds (xiangyun / ruyi cloud scrolls: two spiral cloud heads joined by a flowing tail, and "
    "small curls at the corners), every carved edge outlined in fine black ink, the recessed grooves a shade darker. "
    "Weathered grey granite, painted grain and grit, dark rain-grime runs from the top border, water stains. This one "
    "does not need to tile; it is a single panel, symmetric left to right."),
  'concrete': (['t3-tower.jpg', 't4-street.jpg'],
    "SUBJECT: the bare wall of an old Kowloon concrete tenement, a vertical face, about 4 by 4 metres: cool blue-grey "
    "painted concrete, patchy lighter repairs and darker re-plastered patches, dark ink-wash grime runs and rust-brown "
    "streaks dripping down from above, water stains and tide marks, faint horizontal formwork seams, small cracks drawn "
    "in fine ink, flaking paint at a few spots, a little green moss in the lowest stains. No windows, no pipes, no "
    "objects: only the wall surface."),
  'tiles': (['t1-gate.jpg'],
    "SUBJECT: a glazed Chinese temple roof seen from straight above the slope (orthographic): parallel courses of "
    "rounded barrel tiles (tongwa) running from the top of the frame to the bottom, exactly 8 barrel-tile columns across "
    "the frame, evenly spaced, with the concave pan tiles between them, the tiles overlapping in exactly 8 courses from "
    "top to bottom. Deep malachite-green glaze, each tile a slightly different green, the glaze worn and crazed in "
    "places, wet sheen on the crowns of the barrels, dark ink contours on every tile edge, grime in the gutters."),
  'lacquer': (['t1-gate.jpg'],
    "SUBJECT: the surface of an old temple gate pillar in cinnabar-red lacquered wood, a vertical face: deep red lacquer "
    "with fine crackle (duanwen craquelure lines drawn in ink), worn through along a few strokes to the black undercoat "
    "and the brown wood grain underneath, vertical wood grain faintly visible through the lacquer, darker rain-grime "
    "runs from the top, water stains, a little dust. No carving, no gold, no edges: only the lacquered surface."),
  'poster': (['t3-shop.jpg', 't4-street.jpg'],
    "SUBJECT: a stretch of street wall pasted over with layers of old torn Hong Kong street bills: overlapping "
    "rectangular paper notices in faded red, yellow, pale green and white, printed with big black and red brush "
    "calligraphy (only these words, each drawn cleanly: \"招租\", \"出售\", \"跌打\", \"補習\", \"收購\", \"福\"), torn and "
    "peeling edges showing older layers and the grey concrete beneath, glue stains, rain streaks and water damage, "
    "curling corners outlined in fine ink."),
  'panelw': (['t2-balustrade.jpg', 't1-left.jpg'],
    "SUBJECT: ONE long horizontal carved stone balustrade panel (a frieze), seen straight on. Make a landscape 3:2 image "
    "in which the panel is a band exactly 4 times as wide as it is tall, spanning the FULL width of the image from the "
    "left edge to the right edge, vertically centred, with flat pure black above and below it. The panel has NO border "
    "or frame of its own (the frame is drawn elsewhere): it is only the sunken field: plain weathered grey granite with "
    "painted grain and grit, and in its middle third a low-relief carving of auspicious clouds (xiangyun: two spiral "
    "ruyi cloud heads joined by one flowing tail, symmetric), small cloud curls near the left and right ends, every "
    "carved edge outlined in fine black ink, the recessed grooves a shade darker, dark rain-grime runs from the top "
    "edge, water stains. IGNORE the square/tileable instruction below for the shape: this image is 3:2 landscape."),
  'concrete2': (['t3-tower.jpg', 't4-street.jpg'],
    "SUBJECT: the bare wall of an old Kowloon concrete tenement, a vertical face, about 4 by 4 metres, filling the frame "
    "EVENLY to all four corners (NO vignette, NO dark corners, NO circular or rounded frame, the corners as bright and "
    "detailed as the centre): cool blue-grey painted concrete, patchy lighter repairs and darker re-plastered patches, "
    "dark ink-wash grime runs and a few rust-brown streaks dripping down from above, water stains and tide marks, faint "
    "horizontal formwork seams, small cracks drawn in fine ink, flaking paint at a few spots. No windows, no pipes, no "
    "objects: only the wall surface. Even density everywhere so it can repeat."),
  'flag2': (['t1-left.jpg', 't3-shop.jpg'],
    "SUBJECT: the top surface of ONE single large worn granite paving slab, a continuous stone surface with NO joints, "
    "no grid, no slab edges anywhere in the frame, filling the frame evenly to all four corners (no vignette). "
    "Blue-grey granite, fine painted grain and dense speckle, polished smooth by feet so it is slightly glossy, a few "
    "fine ink hairline cracks, soft darker wet blotches, tiny pits, low contrast and even density everywhere so it can "
    "repeat without any feature standing out."),
  'flagdab': (['e-flags.jpg', 'e-down.jpg'],
    "SUBJECT: a swatch of EXACTLY the painted flagstone surface in the attached crops (the codex-painted frames of this "
    "game), but as a flat texture: the top of ONE single granite slab, NO joints, no slab edges, no reflections, no "
    "neon colour, no rain streaks, filling the frame evenly to all four corners. Copy the crops' painting technique "
    "exactly: a dense dappled texture of small rounded brush dabs and flecks (like the 'cun' texture strokes of a "
    "Chinese landscape painting), slate blue-grey darks and paler blue-grey lights, a few fine ink hairline cracks, "
    "even density everywhere so it can repeat."),
  'stonedab': (['e-panel.jpg'],
    "SUBJECT: a swatch of EXACTLY the painted balustrade stone in the attached crop, as a flat texture of a vertical "
    "stone face: NO carving, no frame, no edges, no rain drops in the air, filling the frame evenly to all four "
    "corners. Copy the crop's painting technique exactly: dappled rounded brush dabs of blue-grey stone, dark "
    "rain-grime runs streaming down from the top, a few warm ochre water stains, fine ink cracks, even density."),
  'paneldab': (['e-panel.jpg'],
    "SUBJECT: ONE long horizontal carved stone balustrade panel (a frieze), painted EXACTLY like the attached crop "
    "(dappled blue-grey brush dabs, dark rain-grime runs, a few ochre stains; the carved relief outlined in black ink "
    "with a pale lit lip on its upper edges). Make a landscape 3:2 image in which the panel is a band exactly 4 times "
    "as wide as it is tall, spanning the FULL width of the image from the left edge to the right edge, vertically "
    "centred, with flat pure black above and below it. The panel has NO border or frame of its own: only the sunken "
    "field, and in its middle third the low-relief auspicious clouds (two spiral ruyi cloud heads joined by one "
    "flowing tail, symmetric), small cloud curls near both ends. IGNORE the square/tileable instruction below for "
    "the shape: this image is 3:2 landscape."),
  'concretedab': (['e-wall.jpg', 't3-tower.jpg'],
    "SUBJECT: a swatch of the painted concrete tower wall of the attached crops, as a flat texture of a bare wall about "
    "4 by 4 metres: NO windows, no pipes, no signs, no objects, filling the frame evenly to all four corners (no "
    "vignette). Cool blue-grey concrete painted with dappled brush dabs, dark ink-wash grime runs dripping down, water "
    "stains and tide marks, faint horizontal slab seams, a few fine ink cracks, even density so it can repeat."),
  'wood': (['t3-shop.jpg'],
    "SUBJECT: weathered dark timber planks of an old shopfront (vertical boards, about 12 cm wide, running top to "
    "bottom), brown-black wood with painted grain, knots, cracks and worn edges outlined in fine ink, faded dark "
    "varnish, grime and water stains at the bottom, a few nail heads. Only the planks, flat, straight on."),
}

batch = sys.argv[1] if len(sys.argv) > 1 else 'b1'
ids = sys.argv[2].split(',') if len(sys.argv) > 2 else list(JOBS)
jobs = []
for jid in ids:
    refs, subj = JOBS[jid]
    out = f'{SP}/raw/{jid}-{batch}.png'
    jobs.append({'id': f'{jid}-{batch}', 'inputs': [f'{SP}/{r}' for r in refs], 'prompt': f'{STYLE}\n\n{subj}\n\n{SWATCH.format(out=out)}', 'out': out})
json.dump(jobs, open(f'{SP}/codex/jobs-{batch}.json', 'w'), indent=1, ensure_ascii=False)
print(len(jobs), 'jobs ->', f'{SP}/codex/jobs-{batch}.json')
