# Template shard

Copy this folder to start a shard. It stays hidden from title cards; enter it through
Debug ▸ Developer tools ▸ Template shard. The world is deliberately grey: one noise
octave, one trail, a hut with a working door, a ramp beside stair treads, and a swim pool.
There are no ground sets, KTX2 tables, asset globs, or downloaded art.

`manifest.ts` declares every mechanism, loadout, budget and tier. `plugin.ts` registers
world pieces, rows, input, UI, playgrounds and scoped systems through the public indexes.
The stages are world → kit → loadout → play. Equipment construction uses the public
`ctx.game.runtime.buildEquipment` bridge; its `install` hook adds the off-hand lantern.

The iron sword and boar come from the kit. The custom whip combines `blocks.viewmodel`
and `blocks.melee`; its heavy lane contact applies kit poison. `greyBlob` supplies a
custom rig and a two-strike brain. Greyback demonstrates EliteBrain; Big Blob demonstrates
BossBrain and two health phases. Reach the hut, then defeat the smaller blob to receive
five coins. NOTES is a bag fragment; `template.notes` is its shard-scoped reward guard.

Phone has ten scattered props and a 30 fps budget; desktop has twenty and a 60 fps budget.
`strings.ts` holds player-facing text. All disposable resources belong to a level scope.
`models/` holds model definitions; `thumbs/` contains the card
source, `audio/` the cue map, `boot/` the empty file plan, `look/` the engine-chain extension,
`explore/` the no-file art, `weapons/` equipment, and `world/` pieces and climate.
Optional `combat/`, `species/`, `quest/` and `playground/` hold authored behavior.

Open ask: E357 Z1. The headless contract is `test/shards/_template/contract.test.ts`.
The macOS gate must boot, walk to the hut, kill the blob and exercise unload/reload.
