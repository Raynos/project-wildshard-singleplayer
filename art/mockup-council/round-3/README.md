# Mockup council round 3

- far-reach: capture `progress/far-reach/20261002-2333-b69c79d1` (sha b69c79d1, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-stalk'}, page errors 0)

Camera re-aims since round 2 (named by the builder in cameras.json `$doc`): `mock-B-quest-start` 9 m from the keeper (the
mockup HUD's KEEPER 9 M); `mock-C-hands-fan` about 5 m from the right bridge-head post with the deck in view;
`mock-proposal-B` its own camera at Sunrest's rim right of the bridge head, looking along the hanging bridge and over the
drop; `mock-D-crown-arena` pulled back to the arena's south rim (z -172.5), the Roc staged 27 m past the dais on its stalk
line (`calm: false`). Rulings applied: the `fan-gust` freeze is removed (mock-C stages nothing).

Builder's claims to verify: rope bridges hang in a sag with thin hemp hand ropes and painted deck wood; textured hero sky
isles; a low sun just behind the mill, less fill, more rim; an olive-gold tufted meadow; grass round the boulders; the fan's
real idle hold lower right, open face-on, with the glove visible; a darker storm; a cumulus bank round the crown.

- sunscar-dunes: capture `progress/sunscar-dunes/20261002-2351-a9e50413` (sha a9e50413, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 3

Camera re-aims since round 2 (named by the builder): `mock-C-waymark` (-53.9, -17.2) yaw -69, with the next waymark in view
at the right (the lead's ledger-5 ruling in round 2: the tower view did not match the mockup); `mock-B-logbook` (-65.5,
48.5) yaw 31.5, because the caravan was turned 180° so the camera looks north at the tailboard into the afterglow, as the
mockup does; `mock-dusk-fire` yaw -10.

Lead decision in round 2: the light follows the mockups (a low key in front with the afterglow), not the style bible's old
"never in the player's face" rule; the bible was updated with the reason.

Builder's claims to verify: light calibrated on the seat's measured patches (ground and zenith, per mockup); layered
crests running diagonally across the spawn view, the tower on a dune crest; orange cloud banks lit from below in the
sunset views, clearing with the dusk; the glove without the dusk rim (no X-ray), lit from the viewer side, the coil lower
and diagonal; the flame orange with a yellow core, a dark smoke plume, embers that drift shorter and fade (no streaks); the
caravan's tent lit canvas, a pack horse (a generated model), no trail stakes. Not done yet, by the builder's own account:
crate textures, stitching and a cuff on the glove.

**Correction (from the cameras.json diff between the round-2 and round-3 captures; seats B and C found the list above wrong):**

- `mock-B-logbook`: x -90.5 → -65.5; yaw -148.5 → 31.5; z 7.5 → 48.5
- `mock-C-waymark`: pitch -2 → -1; x 65.1 → -53.9; yaw 37 → -69; z -25.6 → -17.2
- `mock-D-hands`: yaw 42 → 50

`mock-dusk-fire` did not change this round (its -10 was round 2). From round 4 on, this list is generated from the cameras blobs in meta.json, never from the builder's messages.
