# Brine Pitcher Matriarch: complete-character-next

Complete editable source study for DI-N16. Not admitted, playable or visually accepted.
Original approved hero is authoritative. Corrected Explorer and World-v2 sheets were
inspected for supporting hidden anatomy; their AI camera labels remain approximate.

The producer reuses v3's native codec, GLB skin, material export and unchanged review
cameras/lighting. It rebuilds the integrated head, hood, lip and trunk/root relationship:
three leaning vessels, broader irregular ivory rolls, tapering lip lobes, thick green
hoods with crimson undersides, flared living hinges, curved root arches around embedded
rocks and clustered leaves. No engine, collider, runtime contract, root lift or gameplay
source is changed. Provisional inherited dimensions are NOT accepted fit/contact data.

## Reproduce

From repository root:

    blender -b -t 2 -P art/driftwood-isle/approved-brine-pitcher/complete-character-next/build_complete.py -- --out tmp/pitcher-complete-next-reproduce --render
    python3 art/driftwood-isle/approved-brine-pitcher/complete-character-next/audit_complete.py tmp/pitcher-complete-next-reproduce
    ./node_modules/.bin/vitest run art/driftwood-isle/approved-brine-pitcher/complete-character-next/native.test.ts --config art/driftwood-isle/approved-brine-pitcher/complete-character-next/vitest.config.ts

The producer imports the retained `approved-puffer/native_export.py` codec. The script
is the editable source; GLB, native-source JSON and metadata/payload are normal complete
usable assets, not archive fragments. Seven rigid joints preserve the predecessor's
absolute bind convention. Current assets have no new animation acceptance.

## Honest intermediate finding

`failed-closed-hood/build_complete.py` records the first integrated pass. Actual hero
rendering showed its new crowns obscuring the mouth openings, a substantive visual
failure despite passing geometry/skin audits. Its checkpoint and raw captures remain
retained. The correction raises the entire front hood plane to show the underside;
it is not a camera, lighting or framing change. Independent comparison is still required.

## Review conditions

600×720, Standard view transform, 24 Cycles samples, no denoising; unchanged three area
lights and ground. Orthographic scale5, target(0,0,2), 8-unit orbit. Hero28°/15°;
front0°/0°, left−90°/0°, right90°/0°, back180°/0°, top0°/89.9°, elevated sides39°.
Left/right names are camera-side names, not the AI panels' screen-facing labels.

Unchanged rubric for later independent review: silhouette/proportions35%, mouth and
expression30%, defining details20%, facet/style15%. No self-score, no technical-pass
credit toward likeness, and no runtime/animation/collider acceptance implied.

## Source checks and limits

The final topology audit checks exact float32 GLB/native positions, linear colors,
rigid weights, ordered oriented triangles and bind closure. All three hollow vessels
and all three assembled thick hoods are watertight with positive volume; every closed
component has coherent outward winding, and zero-area triangles are refused. A mutated
native vertex is independently refused by the audit. The real native decoder and
THREE GLTFLoader tests cover consumer loading, typed attributes, owned copies, valid
skin and every exported flat normal. These are source-consumer tests, not gameplay.

Current authored root geometry reaches native y=−0.08410984m in bind. This is an
explicit floor/contact blocker; no root lift, collider padding or engine exception
has been applied. The inherited dimensions are provisional and unchanged. This pass
does not repair or supersede the earlier negative runtime/corpse studies.

The closed-hood source is stored verbatim in a nested historical folder; its original
relative codec lookup assumes placement at the parent complete-character-next level.
Its exact generated assets and ten actual views are retained under ignored raw
`candidate/`, and independently checkpointed by the coordinator.
