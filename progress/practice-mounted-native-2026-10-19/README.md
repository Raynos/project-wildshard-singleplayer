# Mounted native arena verification

Scope: unchanged Colossus motion2 and Conch motion3 applications served at their real Site-relative mount paths from the complete static Site root. The dedicated loopback HTTP server and muted browser are owned by the test and closed in finally. No Vite development server, Mac, remote, publication, gameplay source change, or asset modification.

Harness: `scripts/qa-mounted-native-enemies.mjs`.

Native touch Start, Attack and Retry are used. Logged diagnostic player placement/aim positions the player for collision and enemy attack observation. No enemy state, health, RNG, damage, clocks or actor models are injected. Screenshots show the actual engine with its WIP overlay; no render override. The supplied isolated arena loadout contains only sword. Spear testing is not applicable and no weapon is injected.

Each application has original-source and four-mount SHA-256 inventories, captured before and after its test. The four mounts are Colossus, Conch, Puffer and Mantis. Report checks include equality with the corresponding original tested source tree, byte preservation, true entry, single correct native actor, sword damage, native death/reward, enemy-caused player defeat, blocked defeated-player attack, Retry actor identity/full HP/reset loot, reload asset paths and empty browser/world/shard state.

This is cloud Chromium iPhone 16 Pro emulation. It is not physical phone/Safari/performance proof or visual acceptance.

## Results and limits

Both final runs passed all 21 checks. All six before/after inventories (including the initial Conch run) are identical. The Conch initial equal-HP corpse assertion was invalidated by natural regeneration; raw failure and exact harness are preserved under provenance. The corrected full rerun passed. Corpse observations are sampled rather than per-frame/damage-event proof: all sampled strike states are idle, with no observed adjacent HP decrease, but inter-sample damage plus regeneration is not excluded by this harness alone. Entry/corpse/player-defeat screenshots were visually inspected. The very close player-defeat view reflects logged diagnostic player placement, not a presentation-quality camera claim.

No Site or gameplay files were edited. Browser/server closed on each run. Final report sizes: Colossus 185,688 bytes; Conch 119,984 bytes. `summary.json` is the compact publishable overview. SHA-256 manifest covers all frozen evidence.
