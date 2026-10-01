# E357 S4.4c evidence

Source: `12496363` (level policy types), `1a54bc268baf1456c49f1435be07f224273fcdc8` (consumers), `9c31e55a` (explicit PBR hull fixture).

All assigned files have zero `wildshard/no-shard-branch` and `wildshard/no-active-chunk` sites. The migration consumes authored creature rendering, fight telegraphs, minimap water/palette/outside and debug-row policies through LevelSpec/selection; name and respawn text come from supplied services. Music's domain is now genre; persisted setting keys, assets, URLs and probe `style` output remain unchanged. HUD slots/selectors/visibility are preserved.

The source private export passed gen, tsc, touched-file standard oxlint, ratchet and 85 focused tests across ten files. The synthetic hull fixture subsequently passed its two tests with an explicit PBR policy; preload, geometry sharing, shell, hull and material assertions are retained. Its clean export passed gen/tsc/oxlint/ratchet. No ratchet baseline was changed. Peer AnimalFactory rig-contract lines and unrelated HUD WIP were preserved.

Parent: `534795497773979b93c9bdc09ddde9a1b07b2255`, captured by S4.4a at `/private/tmp/e357-sol-s44/parent`. Final c source: `1a54bc268baf1456c49f1435be07f224273fcdc8`, captured at `/private/tmp/e357-s44c/final` with:

```sh
node scripts/parity.mjs --export=1a54bc268baf1456c49f1435be07f224273fcdc8 --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --out=/private/tmp/e357-s44c/final
```

The run completed all four boots with zero boot errors and all 12 poses. The committed-baseline comparison exits red, as the parent already did. Direct parent-to-final comparison removes only the root `fields` report metadata from both records; it retains every fingerprint field and applies no ignore, quarantine, rename or pending map.

Pine and Nine Dragon compare green. Driftwood and Nalati differ only in `boot.audio.requests`: the same 16 old `/assets/sfx/best/` island-only URLs disappeared, with no URLs added. This is S4.3c C5 `7e0c7560`, which deleted those shared manifest entries/files after relocating the byte-identical sample set. This evidence records the difference and does not rebaseline it. Every other compared fingerprint field is unchanged, including scene, programs, HUD, systems, registry and saves.

All 12 poses retain exact calls, triangles and positions. Offline full-frame SSIM using the parity formula's 7x7 windows, constants and sample covariance has a minimum of **0.99543**; no masks were used. PIL decodes RGB images for this offline calculation, so this is separate from browser SSIM. Every paired frame was visually inspected. [Comparison JSON](s44c-comparison.json) holds the field differences, resources and image scores. [Contact sheet](s44c-poses.jpg) pairs parent then final, ordered beach/pier/wreck, bridge/camp/plains, spawn-rail/stair-street/well-edge, cabin/gate/pond.

This is c-local proof before S4.4a's composition extraction and subsequent peer fixes. Final integrated proof is queued for the lead after that source lands:

```sh
node scripts/parity.mjs --export=<integrated-sha> --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses
```

Use the same parent. Run the command directly; parity owns the browser lane. All capture browser sessions closed at normal completion. The lead owns full gates and push.
