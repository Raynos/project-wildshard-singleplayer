# Mockup council round 5

- far-reach: capture `progress/far-reach/20261003-0033-9dbf50f8` (sha 9dbf50f8, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-stalk'}, page errors 0)

Changes since round 4 (generated from the two captures):

- `mock-proposal-B`: x 5.0 → 7.6; yaw 5.4 → 8; z -11.0 → -11.5 (onto the KNOLL, moved 2.6 m east).
- Real cameras at this capture (meta.json `camAt`, first round recorded): proposal-B (7.6, 33.09, -11.5) on the knoll;
  A (0, 31.7, -10); B (-0.3, 31.7, -4.8); **C (3.2, 31.7, -11), back on the meadow** (round 4: 1.1 m up the knoll);
  D (0, 45.68, -172.5).
- Commit touching staging code: `eb2f215f1` (the Roc staged ON its 13 m flight circle, a spot every lap passes; the
  round-4 should-fix).

Builder's claims to verify: the light (grade saturation 0.32 / contrast 0.24, bloom 0.55 from a 0.7 threshold, rim light
about 45% stronger, a hotter sun core, the sun about 9° up just right of the windmill from the spawn, the panorama's middle
sky saturated peach instead of grey; the builder counts 10–20% of each mock view above 230 against the mockups' 16–19%);
the meadow (darker ground under the blades, flowers in tight drifts, olive-gold: B (99, 85, 34) vs (96, 80, 50)); the rim
crags and code root cones removed from the playable isles. Not done by the builder's account: B's sky (A's isle cluster
sits in it), the keel shapes.

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0057-56c23085` (sha 56c23085, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 5

Changes since round 4 (generated from the two captures): no mock-* camera changed; no commit touched staging code. This
capture records each shot's real camera (meta.json `camAt`), so real-camera moves are compared from round 6 on. Ruling in
force (round 4): the idle hold is the big low coil four of the five mockups show; D uses it too.

Builder's claims to verify (round-4 must-fixes), measured by the builder in Rec. 709 luminance on the ground band: the
shade faces cool violet-brown, not black; brighter lit crests; A's spread 62 (mockup 79, was about 40), dusk-fire's 34
(mockup 62); D's ground (57, 30, 31) vs (60, 37, 33) and zenith (31, 33, 74) vs (32, 34, 75); the logs back inside the
bowl; the glove neutral dark brown with sheen, the thumb patch fixed; sunset clouds as irregular banks with dark cores;
late skies blue-violet; the tent dark canvas; the far-sand stepped strip fixed; the wagon lit by its own lantern. Tried
and rejected by the builder: the NEUTRAL tone mapper (it drove the sand's blue to about 0 and the skies to saturated plum
under this look's colours), so AgX stays. Still weak by its own account: the plait reads beaded; dusk-fire's spread.

All Signal Dunes commits between the round-4 and round-5 captures (added after seat C found a dusk change in plugin.ts, raising the dusk after Sefa's flag from 0.25 to 0.38, that re-lights the staged B view; it is real play state, not a breach):

- 0d4101be0 the round-4 findings (shade faces, light, logs, glove, clouds, tent; the dusk change is in it)
- 7f5d30dcb the caravan wagon lit by its own hanging lantern
