# M3 runtime-owner and 80/20 checklist (E435)

All six content shards remain **transitional**. A bound quest/item/spawn has a platform data owner, but its trusted
TypeScript controller is still custom code. A grid entry proof does not establish the 80/20 split, headless compatibility,
or a memory/fps gate. This inventory separates those claims.

## Source measurement

Measured on committed source `370ecda0d41f461493d4c565fb1fc42e37ffa976` (2026-10-08), after the Signal checkpoint binding.
Uncommitted work is excluded, including Nine Dragon item adoption. Later receipts must name their own source pin.

Reproduce in a clean export with `pnpm gen` followed by `node scripts/shard-platform.mjs --json`.
`inventory.json` preserves the scalar output and source pin. Public share is public SDK lines / (public + custom),
with unique-use kit code included in custom. Runtime/data closures reaching engine/game/kit or the trusted SDK count custom (build-time generators keep
their explicit tool-import exception); putting declarations in `data/` alone does not make their closure public. The separate runtime ceiling counts
`runtime/` plus trusted-SDK closures against 20% of the fixed baseline. Legacy code outside `runtime/` still contributes
to custom, so a short entry wrapper does not mean the hard 20% is finished. Generated and baked output is excluded.

| Shard | Public / custom lines | Public SDK share | Runtime + trusted / ceiling | Split verdict |
| --- | ---: | ---: | ---: | --- |
| Signal Dunes | 42 / 3,647 | 1.14% | 62 / 965 | open |
| Driftwood Isle | 165 / 15,711 | 1.04% | 4,560 / 3,753 | open |
| Pine Hollow | 665 / 19,384 | 3.32% | 3,999 / 4,339 | open |
| Nalati Grasslands | 113 / 27,050 | 0.42% | 7,639 / 6,618 | open |
| Sky Reach | 92 / 5,917 | 1.53% | 459 / 1,377 | open |
| Nine Dragon Stack | 39 / 20,858 | 0.19% | 194 / 5,033 | open |

None of these six reaches 80% public SDK share. The canonical compatible witness is the conjunction of executable
headless, replay and ledger fixtures in `test/proof/<slug>/`; those dedicated witnesses are absent for all six at this pin.
The existing per-shard contract and browser receipts are valuable separate proofs, not substitutes for that conjunction.
The template is the reference implementation, not a seventh claimed content conversion here. Naming a G51 controller
does not excuse a shared-kit dependency (G135) or a performance finding; remaining kit imports stay SF54 conversion debt.

## Signal Dunes — SF50-p

- **Bound:** six-step Signal quest, two ledger facts, the bullwhip identity/family/context with native slot compatibility,
  13 respawning creature homes and the Matriarch boss. Every current creature allocation is a declared home or that boss;
  no additional one-shot `actors[]` row is needed. Audio and ordinary ray/strider brain policies already have declared data.
- **C26 / checkpoint:** `370ecda0d`. The real-plugin migration/rebind fixture keeps completed flags, paid reward,
  boss status, 25 coins, inventory, native owned/worn whip, title/play metadata and profile dedupe. Progress projects the
  same emitting ledger and refuses/retries a failed profile write. Its visible feat table remains empty. The Matriarch
  record intentionally reconstructs `kills` as 0/1 from its defeated flag; historical repeat kills are not preserved in
  that runtime record. The legacy document is left untouched; no state field is widened.
- **G51 runtime:** whip targeting/charge/lash and crackables; well/crank/bucket/brazier/fire controllers; Matriarch phases,
  storm, introduction and retry; skitterer decisions and species/rig dressing; marker placement, Sefa and dialogue;
  look/meshes and plugin composition. `runtime/index.ts` delegates to the legacy plugin, so its small physical folder
  is not the complete custom inventory. The emitting helper is in `runtime/persistence.ts`; ordinary cues and policy
  adapters are in `runtime/audio/cues.ts` and `runtime/brains.ts`.
- **Open:** actual terrain-tile adoption, props/world conversion and the remaining public SDK behaviour closure. The
  compiled dune tiles and runtime-bound world section seam landed in `7ce6398f2`, but the accompanying
  [tile receipt](../hybrid-tiles/README.md) explicitly says nothing draws those tiles yet at this inventory pin. The missing
  pack horse/cache-coverage regression from `eb19cbc58` is fixed by `ab3b4e4fd`: actual-GLB fixtures and standalone/grid
  browser presence are green, with ordinary charged overflow ([receipt](../sf50/cache-overflow/README.md)). No Signal baseline was changed.
  Port parity, both-surface floor,
  cold peak/census and prepared-layout soak remain independent gates. [Grid evidence](../sf50/README.md).

## Driftwood Isle — SF46-p

- **Bound:** authored quest steps/markers through trusted placement ports, the original feat rules as deduped ledger
  facts with the read-only Progress projection, wooden/iron sword rows and native-slot shims, Captain body/boss identity
  with unchanged runtime allocation order. Current-save count migration, rewards, title/play metadata and rebind proof
  landed in `3e995e5a2`; [binding fixture](../../../test/shards/driftwood-isle/hybrid-rows.test.ts).
- **G51 runtime:** Captain combat/rig recipes, night/distance/random-delay ecology and practice spawns, crab/monkey/sailor
  decisions, rope/boat interactions and model/view recipes, quest world anchors and transient presentation. There are no
  generic home rows because those gates do not fit the ordinary home keeper; declaring fictitious homes would change play.
- **Open:** world/prop tiles and public SDK closure of compatible behaviour; specialized ecology remains explicitly
  custom until an approved representation exists. The genuine pre-G164 unsealed-save gate and continuous-layout
  memory/floor gates are not closed by the newer runtime-owner migration.

## Pine Hollow — SF47-p

- **Bound:** Warden quest, feat ledger + Progress projection, crossbow/lever/longbow rows with native family/slot shims,
  fixed Antler King body, bounded lodge/loadout/boss/elite/feat state. Native equipment objects, projectile authority and
  retained entry scopes are preserved. Boss/elite legacy reads initialize platform fields; current-save migration tests
  are distinct from the grid HP/identity continuation proofs.
- **G51 runtime:** projectile/reload/charged bow mechanics, lair elite timing/dressing, forest herds and ghost/night
  decisions, lodge/trader/dialogue/harvest flows, weather/audio/view recipes and bespoke world construction. Carried
  effects use the platform player lifetime; entered callbacks retire on leaving.
- **Open:** world-first tiles, compatible behaviour closure and full headless/replay/ledger proofs. Pine remains
  Developer-only in the grid under G233 with honest whole-runtime charging and the G216 warning; a successful Developer
  walk is not a 1.0 GB pass. [Runtime travel evidence](../sf47/hybrid-travel-a661cebcf/README.md).

## Nalati Grasslands — SF48-p

- **Bound:** three chapters and seventeen feat rules, Progress projection of the emitting ledger, four native equipment
  objects with declared families/contexts, fixed Golden King body, and bounded horse-name/cosmetic/bond/boss/elite/feat
  continuation. Active wiring landed in `a4ffb1c2d` after the migration helpers in `28fe9f479`. Current-save tests preserve
  named/bonded horses, owned/worn skins, boss wins/rewards, elite state, counts, worn title and play time; independent
  placements and refusal/retry are explicit. Native IDs and ordinary allocation order remain unchanged.

- **G51 runtime:** mounted/taming controls, native bow/rifle projectiles and spear throwing, reward weapon families,
  dynamic herd/pack/night decisions, mesh-only Storm Titan, story/people placement and painterly world/view recipes.
  Horse names, cosmetics and bond are durable state candidates, not renderer metadata. Declared group policies do not
  make their native adapters headless-compatible.
- **Open:** world-first tiles, public SDK closure and dedicated
  compatible fixtures. Developer-only grid admission and memory warning remain; no cap saving is claimed by binding.
  [Owner receipt](../sf48/runtime-owner/README.md) names its exact candidate and current-save proof.

## Sky Reach — SF49-p (`far-reach`)

- **Bound:** four-step quest, quest/Roc ledger outcomes + Progress projection without new visible titles, fan item with
  SF70 context and the old `far-fan` slot, twelve finite actor rows plus the Roc boss, bounded rewarded/Roc continuation.
  `158b42d8d` preserves runtime actor identities and order, C26 reward/boss migration and fact/reward dedupe.
- **G51 runtime:** flight homes/steering/wakes, deferred placement/floors, `setHome`, lift/winch/rope/bridge controllers,
  unique Roc phases, fan gust physics, quest placement/dialogue, and look/model recipes. The plugin relocation and all
  nineteen surfaced SF62 findings were handled earlier; zero findings does not mean zero custom gameplay.
- **Open:** tiled world/public SDK behaviour and compatible witnesses. Four cold entries and standalone parity are
  recorded separately from its over-cap Developer-only grid status. [Binding receipt](../sf49/hybrid-rows/README.md).

## Nine Dragon Stack — SF51-p

- **Committed at this pin:** declared audio and four portal-linked road decks/collider rows; the trusted runtime still
  delegates to the native fragment. `shard.config.ts` has no `runtime.binds` behaviour sections at the measured pin.
  Jian/Fei Zhua item adoption is in flight in another lane and is excluded from these source measurements. No quest,
  ledger, spawn or mutable-state binding is claimed here.

- **G51 runtime:** Jian contact/combo/rig recipes, Fei Zhua cable/anchor/swing/climb simulation, portal rides and dynamic
  gate/fragment controllers, elevation/placement, and stylized world/look construction. Four declared portal-linked road
  decks and their collider rows are entry data, not a gameplay conversion.
- **Open:** finish the current item adoption proof, then audit actual quest/feat/state/body owners before declaring rows;
  no unsupported quest or achievement is invented for this fragment. World/props tiles, runtime ceiling/public share,
  compatibility and qualifying layout gates remain. [Entry evidence](../sf51/entries-walk.json).

## Gate checklist shared by all six

- [ ] Public SDK share >=80% and fixed-baseline runtime ceiling both pass.
- [ ] Every compatible behaviour runs through the shardfile/AS lane; every remaining custom controller is named as G51.
- [ ] The trusted runtime has no shared-kit dependency, no new hard-rule sites and no hidden legacy allowance.
- [ ] Current-save migration, refused-write retry and per-instance reward/fact dedupe have the relevant executable proofs.
- [ ] World tiles are consumed by the live loader, with no duplicate world and unchanged native collision/entry contract.
- [ ] Standalone/grid port parity, phone floor, real cold/loading/entered cap and prepared-layout continuous soak pass.
- [ ] The dedicated headless + replay + ledger compatibility conjunction passes; percentages alone never set it true.

These are conjunctive conversion gates, not six new work queues; their open work stays in SF46–SF51 and the live plan.
