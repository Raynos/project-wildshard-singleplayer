# W0c: the honest ruler (HOST-AUDIT HA0 + HA1)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W1** (ruler half) and
**M0.2**'s measuring half. The rows stay owned by [HOST-AUDIT](../../HOST-AUDIT.md) (HA0, HA1; Jake 11-02: cleanup rides
along, never duplicated): this slice runs them and marks them done there.

## 1. The showcase piece

None in the world. The showcase's own line in the ruler: **0 custom TS lines** for `showcase-template`, read every slice
from here on, with every platform host it reaches charged honestly. Without this the "0 % custom TS" claim (G524) is
unmeasurable.

## 2. Engine / game / host work, just in time

Today (`scripts/shard-platform.mjs`, `-hosts.mjs`, `-sections.mjs`, `-output.mjs`, `-format.mjs`, 1,560 lines with
`platform-chargebacks.mjs`):

- `scripts/shard-platform-hosts.mjs:14` maps `client/plan` to two whole dispatchers
  (`game/shardfile/clientPlan#installClientPhase`, `game/shard/declaredEntry#declaredRuntimeEntry`), and line 79 seeds
  "a synthetic import list" for named reach. So every product that declares any client-plan kind is credited with the
  whole dispatch closure: the G594 hole HA0(a) names.
- 193 modules are listed in `lint/platform-pending-users.json` (2,612 lines); `lint/host-reviews.json` holds 1 review.

Work (HA0 a–f, HA1, verbatim scope from HOST-AUDIT): follow only the client-plan kinds a product declares (the kind →
module table already exists in `game/client/shardfile/clientPlan.ts:108`-style rows); treat `CLIENT_FEATURES` and other
dispatch tables as tables, not users; charge optional sub-rows by the products whose rows reach them; narrow the shell
exemption by name; charge `src/format`; a host is platform only with ≥ 2 real users or a listed Jake-approved row. HA1:
a ruler mode that prints every engine / game / format / sdk / commons module with lines, real users and which list
names it.

Layer: build tooling (`scripts/`), no runtime change. Guards: the ruler feeds `scripts/check-platform-ratchets.mjs`;
no lint rule changes. Tests: extend `test/shard-platform-cli.test.ts`, `test/platform-runtime-closure.test.ts`,
`test/platform-pending-users.test.ts`, `test/grid-ruler-coverage.test.ts`; add HA0's verify fixture (two products, one
declaring one kind, charged exactly that kind's closure). Host bar: not a host.

## 3. Other shards in this slice

Every shard's custom % moves. Expected (HA0's verify line): Pine and Driftwood rise by ≥ ~807 lines; Sky and Signal
barely move; the four G594 hosts show as charged. No shard code changes, so no parity proof beyond the numbers, which
go in the commit message (G506) and, once, into the SHARD-PLATFORM numbers (HA6 is not in this slice).

## 4. Done when, hours, blockers

**Done when:** `node scripts/shard-platform.mjs` prints the honest per-shard table and the HA1 inventory at one SHA;
the showcase reads 0 custom lines; HOST-AUDIT's HA0 and HA1 rows are marked done with the SHA.

| Engine (tooling) | Migration | Shard | Total |
|---|---|---|---|
| 20 h (Codex) | 2 h (re-read every shard) | 0 | **22 h** |

**Blockers:** none; runs beside W0a/W0b.

## 5. Risks

- The honest numbers will show Pine and Driftwood worse; that is the point, but it changes SHARD-PLATFORM's reported
  percentages. Report both, before and after, in the commit.
- D53/D192 (the full ratchet vs the scoped gate) also blur readings; out of scope here, noted.

## 6. Questions for Jake

1. **What "0 % custom" counts for the showcase.** (a) only TS under `src/shards/showcase-template/` outside `generators/`;
   (b) also every one-user host only the showcase reaches. **Recommended (b):** a host made for the showcase alone is
   shard code in a generic coat until a second shard uses it or you approve it (G595); the ruler shows both lines.
