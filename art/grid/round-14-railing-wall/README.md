# round-14-railing-wall: Which railing + wall closes a shard edge that can't blend?

Ask E438 (SHARD-PLATFORM mockups, wave 8), after G99: where a shard edge has no blendable geometry (a cliff, a drop or
an infinite void), the engine puts a railing and a wall at the road. Shown at the hardest case, a DROP: Sky Reach's
edge, where the ground ends at the road and the cloud sea lies at −40 m with islands floating at +27…+44 m
(`art/grid/round-11-seam-heights/README.md`). Every frame also follows G80 (boulevard) and G78 (safe-zone HUD).

First person on foot in the right lane of the boulevard, Sky Reach on the right in its painterly golden-hour look,
template cells on the left.

Made with codex `image_gen`, editing `art/grid/round-10-asphalt/B-boulevard.jpg` (road), `art/grid/round-12-vr-void/A-tron-grid-rail.jpg`
(safe-zone HUD) and `art/far-reach/round-38-grid-edges/A-plank-bridge.jpg` (Sky Reach's style). Art direction, not renders.

## Board: `board.jpg`

| Variant | File | What it shows |
|---|---|---|
| A | `A-jersey-chainlink.jpg` | A grey precast concrete jersey barrier with a 2.5 m galvanised chain-link fence on top; utilitarian highway. |
| B | `B-stone-parapet-iron.jpg` | A waist-high dressed-stone parapet with a black iron railing, stone pillars with lamps every ~10 m; a cliff-road promenade. |
| C | `C-cyan-rail-grid-curtain.jpg` | One thin glowing cyan rail on slim posts (the VR void wall of G89) with a faint cyan grid curtain rising from it. |
| D | `D-guardrail-glass-wall.jpg` | A steel W-beam guard rail with a tall clear glass wind wall behind it. |

Re-rolls: none. Small slips kept: A, B and C added a green distance sign ("KEEPER 212 M" / "SKY REACH 212 M").

**Recommended: B.** It is the same neutral stone as G90's retaining walls, so one material family covers every hard
seam (wall, parapet, railing), and it frames the view instead of caging it. C reads as "the world ends here", which is
right for the outer void but wrong beside a shard you can enter; A cages the view; D is the strongest second (it shows
the most) but glass at 2× render scale is reflections and overdraw on the phone.
