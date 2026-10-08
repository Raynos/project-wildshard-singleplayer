# SF48-g Nalati white road face — SF23 far-proxy skirt

Pinned9cfbdd00a (contains seam capc5f935056), DeveloperON, muted iPhone16Proportrait Chromium, onebrowserlane. Command: scripts/browser-lane.sh node progress/shard-platform/sf48/white-face.mjs --url=<pinnedpreview> --out=<scratch>. Captures inspected.0pageerrors; browser+previewclosed.

**Controlled result:** at south road (705,-277.5), lookingeast, and westroad(277.5,-150), lookingnorth, hide ONLY mesh far-proxy under grid-cell:nalati-grasslands at world(555,0,0). The tall smooth whiteface disappears in both. The capped lower platform retaining seam remains. Travellercurrentnull, so the native Nalati runtime is not entered/drawn. Thus this road face is the **SF23 proxy skirt**, not Nalati runtime terrain/slab. Normal/far-hidden are explicitly diagnostic ablations, not a proposed productionhide or paritypass.

Actual baked far.glb bounds[-250,-20,-250]..[250,104.5233,250]. Outerwestvertices−20..99.6797m, outersouth−20..82.9112m (112vertices each). The drawn proxy has208border-foot vertices.

Source causal chain:
- src/game/grid/farProxy.ts139–153: every outerrim vertex is connected down to FAR_EDGE_FLOOR=-20; lower colours inherit0.7×the lip (snow remainsbright), lower normals are horizontal but tops reuse smoothgroundnormals. This creates an artificial smooth snowyverticalwall.
- src/game/grid/farView.ts36: only the skirtfoot shifts3m inward; the top staysat trueheight. The14m seamcap in engine/sim/seamGeometry.ts cannot remove that100m proxyface behindit.
- Nalati look/terrainPainter.ts does have a separate rocky nativePainterlySlab, but regionalView roots are hidden whileparked; that nativegeometry was absenthere.

**Honest Opus proposal:** retain exact baked terrain/edge heights, topology/collider rows and socketcuts. Treat exposed proxy boundary faces as cliffs: split their normals from the top terrain, use a declared painterly rock/cliff palette/recipe rather than stretching snowy lipcolour down100m, and break the face into measured coarse rocky strata while preserving its true silhouette/closure. Keep short interior LOD crackskirts separate. Re-bake/account any changed mesh costs; roadnormalcaptures and entered/parkedhandoff parity must prove no openings, fakeflatground, or colliderchange. A blanket high-edge clamp, hiddenproxy or flattening the true85–100m terrain is not thefix. Renderingimplementation belongs to Opus.
