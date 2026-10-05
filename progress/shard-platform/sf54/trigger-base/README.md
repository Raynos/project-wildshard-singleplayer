# SF54: trigger family and exact subclass transfers

- `0de51da44`: immutable, shrink-only Rifle/Crossbow transfer metadata. Typed
  ancestry reaches the exact platform Weapon; kit copies, duplicate use, extra
  classes, namesake bases, new paths and changed metadata refuse. Historical SF2
  ceilings are unchanged. Ten AG20 predecessor fixtures passed.
- `a4b1ddad9`: the content-free Firearm template graduates to the platform with
  one constructor exposed through the trusted SDK.
- `44d058673`: strict bracket indexing in the transfer fixtures.
- `b1a37e857`: Rifle, LeverRifle and Crossbow move into their shards' runtime
  weapon folders and use the trusted SDK constructors. The obsolete kit Firearm
  source/export is removed. SDK Weapon is the same platform constructor.

The [body hashes](body-hashes.json) compare all four non-import statement bodies
with `a4b1ddad9`. Every body token matches; geometry, action logic and tuning are
unchanged. The 32-state [captured trigger oracle](../../../../test/fixtures/firearm-trigger.json)
was executed against the original kit Firearm before deletion. Reloading,
readiness, missing/empty/full ammunition and reserve combinations retain the
same hooks, order, clock and state.

```sh
pnpm exec vitest run test/combat test/shard-coupling.test.ts test/shards/pine-hollow/entered-loadout.test.ts test/shards/pine-hollow/pine-loadout.test.ts test/engine/hud-reload-chip.test.ts
pnpm exec vitest run test/arch-guards.test.ts -t AG20
pnpm exec tsc --noEmit --incremental false
node scripts/check-models.mjs
```

387 combat/coupling/loadout/HUD checks passed, root strict types passed, scoped
typed lint passed, and the model contract passed. Private candidate hooks passed
before each source commit, without shared-index or lifecycle hunks.

Pending: the two AR15 profile imports still reach kit data, the other weapon
families and kit modules remain, and post-move browser parity/frame floor must
run on a final approved pin. The coordinator owns the serialized gate/push;
these local commits do not yet claim SF54 done. The `8ffa93c43` floor is a parent
of the later creature-voice move, so it is not post-move voice evidence.
