# E357 finish rows L5–L8, L11 (GAME-NORMALIZATION § Finish rows)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you. Then your row in GAME-NORMALIZATION
§ Finish rows, and the Handoff in `docs/tasks/asks/E357.md` it came from (sol-x1 / sol-x1c, sol-x2, sol-x3, the X5c
builder). Do only your section. Each item = its own commit, parity unchanged on every original shard unless the item
says otherwise (`--only=fingerprint+poses`, phone; add `walk+combat+leak` when you touch weapons, input or the world),
and the full suite green. Land as private candidates from HEAD; ask the lead (`herdr agent prompt wildshard-9
"[from <you>] …"`) for a landing slot. Stop at 400k context, 90 min or ~200 turns: commit what is done, update your
Handoff in E357.md, report ≤ 40 lines.

## sol-x2b — L6 (X2 leftovers)
1. GameMenu's legacy kit / skins / tools / pack renderers become registered game TabSpecs (the X2 registry); `Menu.ts`
   loses its `kit` / `skins` / `skinsTitle` options. The Bag looks and behaves the same on all four shards (phone
   captures before / after of every tab, in `progress/normalization/l6/`).
2. FullMap and DebugMenu get layer handles from the UI layer registry: no `calc(var(--ws-layer-hud)+6)` left.
These are HUD files: announce before you start (`herdr agent list`, then a prompt to each) and send the SHA after.

## sol-x3b — L7 (X3 leftovers)
1. J3: one more chunk-group try (B69 broke boot three times: `main_exports`, "Ka is not a constructor"). Read B69 first.
   It lands only if all seven slugs boot off-branch (phone + desktop) and offline; else revert it and write down why.
2. `check-chunks` runs in `scripts/vercel-tree-gate.sh` and in deploy.yml's Test.
3. `retried()` moves from `src/entry.ts` into the engine (public, documented) and wraps `manifest.load()` and
   `level.look()`.
4. `scripts/ios-retry-check.mjs`: the E188 Simulator re-test (a dropped module download retried), run through
   `scripts/sim-lane.sh`. If the Simulator lane is busy for > 4 min, report "queued: <command>".
5. The four-shard offline Explore run (X3's queued one); confirm or finish X3's staged boot steps.

## sol-x5d — L8 (X5 leftovers)
1. The cosmetics service: one SkinLocker (Nalati's becomes a profile of it).
2. Nine Dragon's `vm/trail.ts` onto the shared slash trail (looks identical: before / after clip).
3. The balbal `class Wedge` becomes a GroundTell `'wedge'`.
4. The SkyRig + backdrop split (10 §X5): the sky rig and the backdrop as engine pieces, every shard's look unchanged
   (phone captures of all six shards before / after).
5. The local smoothstep copies (DeathFade.ts, bow/family.ts, Nalati Spear.ts) use the shared one.

## sol-fin — L5 + L11 (small items)
1. Delete the dead `src/engine/player/Hoverboard.ts` (nothing imports it; check again).
2. `Player.spawn` clears `dashT`: a respawn mid-dodge must not keep dashing. A test; parity will move only where a
   route respawns mid-dodge (say which, or none).
3. B81: drop the legacy `uses` tags; B72: the fog registry throws on an unknown patch id (a test).
4. A parity build-cache eviction rule in `scripts/parity.mjs`: keep the newest N (default 3) entries in
   `~/.cache/wildshard-parity`, evict by mtime after each build; a test with a temp dir.
5. AGENTS.md: the "before you push" line from 11 §Z4 (read it there).
6. Queue the `--tiers=all` milestone parity run sol-x1c named: report "queued: <exact command>" for the lead.
