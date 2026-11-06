# Sky Reach E410 #2: the upper sky over the hero views (round 37)

Every hero view (A, B, C, proposal B) faces heading 0-5 deg, and C pitches up into the panorama's top band (12-37 deg up), which was a flat mauve cap where mockups C and A have big sunlit golden-hour cumulus.

- gen.py: three codex image_gen edits of the crop (headings -48..+48 deg, rows 0-983 of ../round-17-mockup-loop/panorama-warm.jpg, the shipped strip's source), with mockups C's and A's upper skies as references. takes.jpg: the crop (top left) and takes 0, 1, 2.
- merge.py: take 1 (the largest, most readable masses) feathered into the source above row 400 (~10.6 deg up: the sun at ~6 deg, its glow and the horizon untouched), 120 px edge feathers, wrapping heading 0. Output: panorama-sky.jpg, the new source.
- Shipped with: (cd ../round-14-loop-4/pano && python3 prep.py 564 ../../round-37-upper-sky/panorama-sky.jpg) -> public/assets/far-reach/sky/panorama*.webp and look/panoramaData.ts (sun 352.16 / 6.01 deg, horizon unchanged).
- board.jpg: mockups (top) / now (bottom): A, C, B, proposal B. Upper sky (rows 90-250 of 844), mockup / before / now: C 202/168/148 s55 / 181/156/149 s34 / 202/162/144 s61; A 195/158/140 s58 / 191/156/135 s57 / 196/151/126 s71; B 179/157/147 s41 / 189/157/140 s52 / 199/153/127 s72 (more saturated than B's paler mockup; the sky follows A and C, the round-10 ruling).
