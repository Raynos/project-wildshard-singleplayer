# W0d: one host register (HOST-AUDIT HA5)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W1** (register half).
The row stays owned by [HOST-AUDIT](../../HOST-AUDIT.md) HA5; this slice runs it.

## 1. The showcase piece

None in the world. Every host the west slices create or promote gets one register row the day it lands (verdict, score,
deciding G row, recheck date), so G595 approvals ("every one-user host needs Jake's own approval") have one place to
live. The west slices add roughly 15 hosts or host changes; without one register they would land in three lists.

## 2. Engine / game / host work, just in time

Today three lists decide a host's standing: `lint/platform-pending-users.json` (193 module rows, 2,612 lines; e.g. the
grapple rows at lines 2192–2230 name G478), the G571 prose in `docs/HOST-BAR.md` "Dated exceptions" (parsed), and
`scripts/platform-chargebacks.mjs` (+ `test/platform-chargebacks.test.ts`). `lint/host-reviews.json` is a fourth,
small one (1 entry).

Work (HA5): one JSON row per host or binding: `{ module, verdict: 'engine'|'game'|'borderline'|'silly',
score: {twoUsers, noNouns, dataDriven, serverSafe, deletion, dataOnlyApi}, decision: 'G478', users: [...],
recheck: 'YYYY-MM-DD' }`. The ruler (W0c) fails on a one-user host with no row; a row past its recheck charges back; a
platform verdict needs a G row Jake made. HOST-BAR keeps the bar, not the list. Migrate the three lists into it and
delete them in the same commit (charged-span inventory rule: retire rows in `scripts/platform-chargebacks.mjs` and its
test together).

Layer: lint data + tooling. Guards touched: `platform-pending-users` checks in pre-commit, the ruler. Tests:
`test/platform-pending-users.test.ts` becomes the register test; `test/platform-chargebacks.test.ts` is retired into it.

## 3. Other shards in this slice

No code. Every shard's host credits must read the same before and after the list merge (the ruler table at one SHA,
before/after, in the commit).

## 4. Done when, hours, blockers

**Done when:** one register file; the three old lists deleted; the ruler's per-shard numbers identical before and after
the merge; HA5 marked done.

| Engine (tooling) | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex) | 2 h | 0 | **14 h** |

**Blockers:** W0c (the ruler reads the register).

## 5. Risks

- Pending rows past their recheck date will charge back on the day the register lands; list them in the commit and
  bring the list to Jake as one pick sheet rather than letting them flip silently.

## 6. Questions for Jake

1. **Stale pending rows on merge day.** (a) charge back every row past its recheck at once; (b) give them one new recheck
   date (four weeks) and a G595 pick sheet. **Recommended (b):** a mass charge-back would hide the showcase's own
   readings in noise; one pick sheet settles them.
