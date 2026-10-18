# Declared controls, quality knobs and saved slots

G486 extends the existing `combat/items`, `sim/plumbing` and
`state/migrations` sections. It adds no section and accepts no author
callbacks. A shard's decisions remain Script ABI programs.

## Weapon-bound controls

A `combat/items` context keeps its baseline melee/ranged/bow/spear
profile. Its optional `extra` declares additional action/key rows,
blocked actions, touch relabels, either of the two existing verb slots,
binding descriptions and `hiddenWhen`. Extra action ids belong to the
context's namespace. A verb or description must name an action admitted
by that context. The host rejects duplicate actions and unknown fields.

Sky's fan is a real user: its existing GUST key, label, icon and board
visibility move from the boot recipe into its weapon context. The
secondary strike still uses the same item action and contact owner.
The retained-runtime and pure-data installers use the same context
builder. They install descriptions through the session's binding owner.
A fictional harbour fixture exercises another weapon and its controls.

## Free input and conditions

`sim/plumbing.input` declares actions with optional physical keys and
optional admitted scene ids. An action without a scene is consumed by
its existing host; the loader does not install a duplicate callback.
`keysFrom` inherits effective keys from a registered context. Explicit
keys win. Rows may declare `blocks`, `relabel`, two `verbs` and `describe`.

`when` is a closed AND over `mode`, `notMode`, `item` and `flag`.
`hiddenWhen` uses the same observations to hide touch verbs without
changing the context's enabled actions. Mode names are the engine's
player-mode vocabulary; items and flags must exist in the admitted
source. There is no expression language or property path. The platform
reads the live player, equipment and existing flag owner. It synchronizes
conditional contexts before input collection, including after restore.
Scope disposal removes contexts, keys, descriptions and callbacks.

## Quality values

A knob row has an owned namespaced id and `phone`/`desktop` values of the
same kind: finite numbers or booleans. `plumbingKnob(rows, tier, id, kind)`
resolves a value before construction and refuses unknown ids or kind
mismatches. Sky's meadow count now comes only from its plumbing rows.
The optional final argument is plain namespaced tier-override data. It
can override an admitted id, never introduce an undeclared knob.

The regular plumbing installer publishes these same values through the
existing scoped tier schema registration. Knob-only rows register before
world construction without requesting a second hybrid simulation. They
register once even when the runtime owns the world stages.
Pine declares its seven original cabin/cover/prop values in rows; Nine
declares the original paint size and decal scale. Runtime readers obtain
these rows from the existing admitted product source. A namespaced phone
override retains Pine's GRID cabin distance of 52.5. Alternate-tier
construction clears that live override temporarily and restores it on
return. The engine tier table no longer contains the seven Pine names.
The frozen legacy callers use the coordinator-approved local adapter
and their original seven JSON values, with import-only redirects. The
sealed legacy line basis remains 1258254a3 (Pine 21,305); the plan's
80,173.3 basis stays unchanged. Pine's runtime-cost TS module also becomes
JSON with identical measured values and evidence paths.

## Existing saves

A version step in `state/migrations` may carry `equipmentSlots` rows:
`{ "from": "old-slot", "to": "declared.weapon.author.item" }`.
Targets must resolve to declared weapon slots. The cosmetics owner
renames worn-slot keys before filtering its existing `skins` v1 save
against current rows, then persists the migrated keys. Ownership ids and
the save service remain the same. A canonical target already in the save
wins over an old alias; repeated loads make no additional write.

Sky's `far-fan` and Signal's `sunscar-whip` aliases migrate to their
existing declared weapon slots. The held recipe derives its canonical
slot when the row does not supply a legacy game slot. The whole Signal
slot-type module and Sky's three type augmentations are removed.
The prior design's `player.weapon` example referred to Feedback context;
it was not a persisted weapon-selection field. No such save is invented.

## Evidence

`test/declared-input-platform.test.ts` covers a fictional shard's
conditional free context, inherited keys, blocked actions, numeric and
boolean values, plain-data refusal, weapon extras, and the actual
cosmetics restore path for both old slot aliases. It also checks
idempotence and a save containing both canonical and old keys.
The full admission, headless and product checks remain required.
The central map batch must include `data/plumbing.json` in the declared
map inputs for Pine, Nine and Sky so future policy-row edits invalidate
their map stamps.
