# E0f: HUD II: nameplates in con colours, floating numbers, the Character tab

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **HC3** (floating numbers),
**HC4** (nameplates with con colours, 25 m, rarity tint, stagger bar, status tint), **HC5** (the read-only Character
tab), **LVH2**, **LVH3**, **LVH4** and **LVF3** (words and colours). Shared HUD (E332 notice before, SHA after; Jake's
pick on a labelled board first).

## 1. The showcase piece

- **Nameplates** over robots within ~25 m: "Lv 7 Plumb Drone", the HP bar, the level in its con colour (grey, blue,
  green, yellow, orange, red, skull: the gap table), a thin stagger bar under the HP (E0g), a status tint (burn,
  shock), an orange rarity tag (E7a).
- **Floating numbers**: white hits, big yellow crits with a short shake, small grey glances, the words DEFLECT / DODGE
  / PARRY on fails, red numbers on you near the vitals; 0.7 s; at most 6 on screen.
- **Character tab** (pause ▸ Bag ▸ CHARACTER): level, XP to next, the seven attributes with par, ▲▼ aptitudes, and
  derived numbers (HP, armour %, MDEF %, crit chance and size, dodge share, fail chance vs an equal foe).

## 2. Engine / game / host work, just in time

Research (this is mostly an extension, not new UI):

- **Health bars over enemies already exist**: `src/engine/ui/Combat.ts` draws pooled bars within `BAR_DIST = 60` m
  (`:46`) for an animal hit in the last 4 s or under the crosshair, at most `BAR_MAX` 6 on phones (`:48`), with the kind
  as a small mono label; bosses and named elites have their own wide bar (`src/game/Boss.ts`, `src/game/Elite.ts`;
  `Combat.ts:195`).
- **Floating damage text already exists** (`Combat.ts:239` `float(text, label, cls, kill)`, `FLOAT_MAX = 10`,
  `FLOAT_LIFE = 0.9`): the number, "HEADSHOT", red "KILL", grey "MISS" for aim misses.
- The lock-on frame (`src/engine/ui/LockOn.ts`) carries the locked enemy's name + health tag through `Combat.ts`.
- **Pause tabs are a registry**: `TabRegistry.tab({ id, title, icon, order })` and `fragment()`
  (`src/engine/ui/tabs.ts`); shards already add Bag tabs from rows (`src/game/shard/declaredUi.ts:19`). A Character tab
  needs no new menu code.

Work:

| Piece | Shape | Layer |
|---|---|---|
| bar label provider | `Combat.ts` asks an optional provider for `{ prefix, prefixColour, tag?, sub? }` per target (prefix "Lv 7", con colour, rarity tag, stagger fraction, status tint); none = today's kind label | engine `Combat.ts` (generic: "prefix", "tag") |
| bar range | a provider may set the show range (25 m) and "show when within range" (not only when hit) | engine |
| outcome floats | `damage.dealt.req.outcome` and `damage.failed` (E0b) pick the class: crit (bigger, yellow, 80 ms shake), glance (small grey), fail words; `FLOAT_MAX` 6 when a provider is present | engine `Combat.ts`, `styles/combat.css` |
| on-you numbers | red numbers by the vitals from `damage.dealt` on the player, levelled only | engine UI |
| Character tab | a `character` tab + fragment registered by the levels host; reads E0c's character and `levelMath` for the derived numbers | game `src/game/progression/characterTab.ts` (new) |
| con colours | the gap table's colours as rows in `progression` | data |

Host bar: extends a shared engine view; the provider is the levels host. Guards: `engine-words` (no "level" text in
engine strings), E332. Tests: extend the `Combat.ts` DOM tests (no provider = today's DOM for every shard), new
`character-tab.test.ts` (the derived numbers equal `levelMath` for a fixed character).

## 3. Other shards in this slice

Every shard draws `Combat.ts` bars and floats today. With no provider, the label, range, float count and classes are
today's exactly: DOM snapshot per product of a scripted hit, headshot and kill (Driftwood crabs, Pine deer, Nalati
wolves, Sky skitterers, Signal's creatures). One look in game at Pine (the crossbow's MISS) and Driftwood. No save risk.

## 4. Done when, hours, blockers

**Done when:** Jake's board pick is in; a band of robots in the pen shows con-coloured nameplates within 25 m; crits,
glances and fail words float and never exceed 6; the Character tab's numbers match the maths; other shards' bars and
floats are byte-identical in the DOM snapshots.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 20 h (Opus: bars, floats, tab) | 3 h | 1 h | **24 h** |

**Blockers:** E0b (outcomes), E0c (the character). E0e and E0f touch different HUD files and may run in parallel, but
send one E332 notice each, in turn.

## 5. Risks

- Up to 9 robots in a gauntlet court (E11c) plus floats: 6 bars on phones may hide a nameplate; the nearest six win
  (today's pool rule), checked on a 30 fps capture in E11c.

## 6. Questions for Jake

1. **Nameplates: always on within 25 m, or only when hit / aimed?** (a) always within 25 m (your 11-02 ruling); (b)
   today's rule (hit or under the crosshair). **Recommended (a)** in the showcase: the con colour is how you read a
   soft gate before you swing.
2. **The Character tab's place.** (a) a CHARACTER tab in the Bag; (b) a panel on the map tab. **Recommended (a):** the
   Bag already hosts per-shard tabs from rows.
