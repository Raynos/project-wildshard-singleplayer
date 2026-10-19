# Pearlglass Medusa: complete-character-next

Complete editable source candidate, awaiting independent likeness review. Not admitted to gameplay. The prior v2 source, captures, review and negative death proof remain unchanged.

## Scope

The approved original hero is the authority. The original Explorer and corrected World sheets inform uncertain hidden surfaces only. This pass reconstructs the full character together: thick irregular bell with staggered facets, recessed teal underside and bowed tapering ivory arches; compact rounded orange organ cluster with short curled fronds; and eight physically thick twisting ribbons with varied lengths, broad curved sections, curled ends and face-mounted hollow barnacles. No eyes or mouth were invented.

Native coordinates remain right-handed +Y-up, +Z-front, with the body/core origin at y=0. The existing 27-joint chain rig and native animation contract remain intact. No runtime catalogue, engine, physics architecture, browser, Site or production asset is changed. The GLB joins source objects by native part to reduce container overhead; its triangle paint, winding, skin and positions are checked against the native arrays.

## Reproduction

From repository root, run the local producer under the shared heavy build lease with Blender limited to two threads:

    python3 scripts/heavy-lane.py build -- blender -b -t 2 -P art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/build_medusa.py -- --out art/driftwood-isle/approved-pearlglass-medusa/complete-character-next --render-dir tmp/pearlglass-medusa-complete-next

Then run this directory's audit_medusa.py and audit_glb.py with this directory as the argument, the installed Vitest binary with this directory's native.test.ts and vitest.config.ts, and prepare_review.py. The latter requires the preserved v2 raw captures in their original ignored folder.

The producer and native-source.json are editable source. metadata.json and payload.bin exercise the actual packedCreatureBodies loader; the GLB has its actual 27-joint skin. The ten raw PNG captures remain ignored, with immutable hashes in capture-provenance.json; previews and paired v2 comparisons are derived only by labels, resizing and WebP encoding. Camera positions, projection, framing, resolution, lights and exposure match v2. Source renders are not native-game captures.

## Verification boundary

The checks cover finite/nondegenerate triangles, closed expected components, positive signed volume, consistent shared-edge winding, normalized influences, exact typed pack bytes, actual native-loader ownership, numeric pose compatibility, weighted live bounds, GLB/native triangle and paint equivalence, and normal/winding agreement in both GLB and the actual native consumer. They do not certify absence of every geometric intersection, artistic acceptance, gameplay, animation quality or phone performance.

Standard FlightMotion death remains rejected. The retained original v2 failure reaches -1.1920032153359559 m; this candidate's actual weighted replay is separately recorded in rejected-flight-death.json. No parameter sweep, root lift, ground exemption, flight-height change or physics redesign was attempted. Existing physical corpse admission is still required before in-game use.

## Preserved failed attempt

The first generated geometry accidentally reversed the new ribbon surface winding. The strict positive-volume audit rejected all eight ribbon solids. Its producer, native arrays, GLB, metadata, pack, construction report, full ten-view raw capture set and original audit log are retained under the ignored failed-inward-ribbons subdirectory. Correcting the face orientation is part of this pass, not acceptance of that failed source. The complete final capture set is regenerated from the corrected model, including an explicit front opening around the organ and seated/tapered rib ends.

The added actual-consumer normal test initially failed because the inherited source pack omitted normals. This candidate now authors and packs an explicit per-triangle normal channel; no engine fallback or recomputation hides that omission. The failing test log is retained in ignored raw evidence.

No builder likeness rating is supplied. Independent review must inspect the actual final ten captures and compare the authoritative hero plus both approved sheets, with v2 retained as the previous source.

## Final measured checks

Six focused actual-consumer tests pass. The source contains 5,742 triangles, 17,226 non-indexed vertices, 27 joints and ten native mesh parts. The weighted live sweep has minimum Y 0.081116245769556 m at the unchanged existing 1.2 m root/0.35 scale; it is not gameplay/contact admission. The default flight-death replay remains rejected at -1.1913332079183132 m.

The final normal-channel addition changes only native-source/packed bytes: the GLB is byte-identical to the model used for all ten final captures, SHA-256 3fc2f82d7248c35bffce2b716c24ee979e7de330901d5b72fa4b1a5bd967e3c3. The source render is therefore the same exact geometry, skin, materials and normals.

Retained visible limitations for independent inspection: upper rings still converge toward a small central hub; some ivory rib ends remain visible outside the side rim; lower ribbon ends retain blunt tapered tips. No claim that every requested artistic correction has passed review.
