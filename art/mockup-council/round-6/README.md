# Mockup council round 6

- sunscar-dunes: capture `progress/sunscar-dunes/20261003-0132-28e3eb78` (sha 28e3eb78, staged {'mock-B-logbook': 'logbook', 'mock-C-waymark': 'waymarks-lit', 'mock-D-hands': 'waymarks-lit'}, page errors 0)

### Signal Dunes, round 6

Changes since round 5 (generated from the two captures):

- no mock-* camera changed

Real camera positions (meta.json camAt):
- `mock-A-spawn`: the real camera moved 8.29 m ([0, 21.3, 70] → [0, 13.01, 70])
- `mock-B-logbook`: the real camera moved 5.86 m ([-58.8, 16.46, 42.1] → [-58.8, 10.6, 42.1])
- `mock-C-waymark`: the real camera moved 2.98 m ([-53.9, 2.88, -17.2] → [-53.9, 5.86, -17.2])
- `mock-D-hands`: the real camera moved 3.09 m ([117.99, 14.17, 88.02] → [118.02, 11.08, 87.99])
- `mock-dusk-fire`: the real camera moved 8.29 m ([0, 21.3, 70] → [0, 13.01, 70])

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- 1c872018f E399 Signal Dunes, council round 5 dune shapes: a shorter dune wave (72 m, crests 12 m, lee 0.42: every face under the max climb) 
- 55a286313 E399 Signal Dunes: the idle coil bigger (council round 5: about half the mockups' loop), still the low lean of the lead's ruling: 
- f81b2ed09 E399 Signal Dunes, council round 5 findings: the sand's near-scale texture (measured, Rec. 709 high-pass on the ground band: A fin

**Note for the seats:** no camera was re-aimed, but the real camera heights moved 3–8 m because the dune terrain under the views was reshaped (a shorter dune wave, the tower on its own dune). Judge whether each view's new framing still matches its mockup; ledger 5 forbids reshaping ground only to frame a shot, so check the reshaped dunes read the same from the hero views and aerials.

Builder's claims to verify, measured by the builder in Rec. 709 on the ground band (mockup / game): dusk-fire spread 62/45, fine detail 8.5/6.5; A spread 79/50, fine 7.2/6.6; D spread 53/45; B 34/42; C 67/77. Also: anisotropic sand grain with cm- and mm-scale octaves, noise-bent ripple crests, ripples on slip faces so shade faces carry texture; charred unlit logs (no glow when unlit, only their ends over the rim); a brighter flame with half the light pool; the whip a crossing plait, the coil bigger and low. Known short by the builder's account: C and D ground a step darker than the mockups (D 42,17,19 vs 60,37,33); the gauntlet's stitching still faint.

- far-reach: capture `progress/far-reach/20261003-0201-fc54d9df` (sha fc54d9df, staged {'h4-crown': 'quest-crown', 'mock-D-crown-arena': 'roc-stalk'}, page errors 0)

## Sky Reach (far-reach), round 6

Changes since round 5 (generated from the two captures):

- `mock-C-hands-fan`: yaw 12 → 5
- `mock-D-crown-arena`: pitch 4 → 2; settle 300 → 150; y 44 → 46.4; z -172.5 → -176
- `mock-proposal-B`: pitch -12 → -10; x 7.6 → 0; y 31.4 → 32.4; yaw 8 → 0; z -11.5 → 3

Real camera positions (meta.json camAt):
- `mock-D-crown-arena`: the real camera moved 4.18 m ([0, 45.68, -172.5] → [0, 47.97, -176])
- `mock-proposal-B`: the real camera moved 16.40 m ([7.6, 33.09, -11.5] → [0, 34.09, 3])

Commits touching staging code between the captures:
- none

All shard commits between the captures:
- c061ffd27 E399 Sky Reach GPU ceilings re-recorded at the m5 parity measurement of a6a08ef9e (phone 206.53 -> 208.78, desktop 320.99 -> 323.2
- a6a08ef9e E399 Sky Reach: the grassy rises as a list (layout KNOLLS): Sunrest's on the bridge's axis behind the spawn, so proposal B's view 
- 1a40cc1e0 E399 Sky Reach: the low sun left of the windmill (painted at heading 352.3, 6.1 up: mockups A and D put it 6-10 deg left of their 
- e1f5fa462 E399 Sky Reach: NEUTRAL tone map (the hang was reading c.fx before engineChain('clean')), grade saturation 0 / contrast 0.12 / blo

**Notes for the seats:** this is a fresh sky-reach session (the last one stopped at round 5 on a plateau and a full context). The builder moved the high step 36 m west (layout STEP) and added rises (layout KNOLLS: Sunrest's on the bridge axis behind the spawn, one on the crown arena's south side), and moved proposal B and D onto them. Check that these are real playable ground a player would plausibly reach and stand on, not ground placed only to frame a shot (ledger 5), and that they read the same from the hero views and aerials. h4-crown now stands inside the arena and its discovery ring, so the boss intro and the place toast play at h4 rather than in D; D's 0.15 s settle catches the Roc on its staged circle spot (the stage code is unchanged).

Builder's claims to verify (Rec. 709 luminance, its measure.py): the top 1% at 238–243 against the mockups' 236–241, and 2.5–5.0% of the frame above 230 against 1.9–3.8% (round 5: 223–228 and 0.1–0.8%); the meadow median in A (75, 62, 20) against (75, 65, 24); the NEUTRAL tone mapper; the painted sun 15° left and 6° up, under the mill's hub on its left; the sky isles off the sun's line with aerial haze. Known open by the builder's account: the sky isles' look and count, the fan's metal finish, proposal B's bridge reads small, D's Roc pose.
