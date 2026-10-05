# hud / round-24-shard-panels: Pine Hollow's trader and a Nalati camp on the platform panels (SF28 part 2)

Not a pick: proof for SHARD-PLATFORM SF28 ("no shard builds DOM; each panel is declared"). Jake already picked G87 (big
cards + a shard accent, `round-19-ui-kit/B-big-cards-accent.jpg`, which is Mott's stall). Big cards sit behind
**pause ▸ Settings ▸ Debug ▸ Look ▸ Item cards**, default **Classic**.

| File | What it shows |
|---|---|
| `pine-trader-classic-before.jpg` / `-after.jpg` | Mott's swaps in Classic: before, Pine's own `TradePanel` DOM; after, the platform `ShopPanel` with the declared `layout: { kind: 'slate' }`. The panel alone (3D canvas hidden, 1146 × 2088 PNG) is **pixel-identical**: 0 differing pixels |
| `pine-trader-big-before.jpg` | before, Big did nothing at Mott's stall (his slate was shard DOM) |
| `pine-trader-big-after.jpg` | after, Big: the G87 sheet in 08 MOSS, seven swaps as compact 4-up tiles (READY / NEED MORE / FULL), the first (a full quiver) framed: "BOLTS ×10 · FULL" |
| `pine-trader-big-2-after.jpg` | the same after → : "TRADE PITCH BOLTS ×10" with "3 AMBER RESIN" under it |
| `nalati-camp-{classic,big}-{before,after}.jpg` | Baqyt Ata's dialogue at the nomad camp. Nalati's camp UI was already platform-drawn (the engine's DialogueBox, QuestChip and RewardCaption); nothing changes, and Big has no item card here |
| `capture-before.json` / `capture-after.json` | what each shot read back: the slate rows and buttons, the tiles, their feet, the bar, the accent, the dialogue |

**How they were made** (SHARD-PLATFORM SF28, ask E435, 2026-10-04): `capture.mjs` through `scripts/browser-lane.sh`,
Chromium as an iPhone 16 Pro (402 × 874 @3×, portrait, muted), Item cards saved before the load, against
`scripts/serve-build.sh --rev` builds of `80909aca9` (before) and `33cadc992` (after). Pine: the quest handle gives 3 deer
hides, 4 amber resin, a boar hide and a venison, poses at Mott's hatch and opens his stall. Nalati: poses at the elder and
talks to him.
