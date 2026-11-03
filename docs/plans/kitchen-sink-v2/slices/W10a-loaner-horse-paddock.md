# W10a: the paddock and the loaner horse (a given mount, no taming)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W7** ("a given-mount
roster row with no taming session"; riding 1U, Nalati).

## 1. The showcase piece

| Item | Rows |
|---|---|
| Paddock 48 × 60 | fence, mounting block, trough, the chute onto the oval |
| Loaner horse | one saddled horse in the paddock; talk to the stable hand (W1a) or walk to the mounting block to mount; ride anywhere in the west; it can't pass the East Gate (combat is on foot, mounted combat is content-out); left alone 60 s or outside the west, it walks home to the paddock (Q1) |
| Stable hand lines | "Take Biscuit round the oval" etc. |

## 2. Engine / game / host work, just in time

Research:

- **Riding is a Nalati-only host family:** `src/game/riding/` (19 files, 3,379 lines): `roster.ts` (`BondedMountRoster`:
  "server-safe one-companion roster", rows `{ id, services, herds, kind, variant, wildKinds, specs, scale, spawnY,
  program }`; a mount is "bonded" through **taming**, `taming.ts`, `nativeTaming.ts`), `native.ts`, `mount.ts`,
  `physics.ts` (gaits, jump: `physics.ts:128,152`), `pagePasture.ts`, `pastureController.ts`. The client-plan kinds are
  `riding.session` (`src/format/clientPlan.ts:86`) and `taming.entry`; ride gaits are `state/modes` `ride` rows
  (`src/format/modes.ts` `RideModeSchema`). Users: Nalati only (`riding-platform` tests: `test/riding-platform.test.ts`,
  `test/client-riding-session.test.ts`, `test/nalati-ride-verbs.test.ts`, `test/nalati-riding-rules.test.ts`).
- The same quest-page gate as W7a: `ride` rows need a declared page (`shardSchema.ts:285`).

Work:

| Row / host | Shape | Layer |
|---|---|---|
| given mount | the roster row gains `source: 'tamed' | 'given'`; a `given` roster spawns its `specs` at `home` with no herd, no taming program, no bond save | game `riding/roster.ts`; format row |
| loan rules | `loan: { home: {x, z, yaw}, returnAfter: 60, region: <named region or box> }`: outside the region the horse refuses to go on (stops at the gate) | game |
| mount prompt | the mounting block an interactable (`kind: 'mount'`, or a talk choice that sets the flag) | data (W4a section) |

Host bar: riding gets its second user; the roster loses its "taming is the only way in" assumption: 6/6 for the given
path (G595 asks still apply to the rest of the family). Guards: `engine-words` (horse is an engine word: game only).
Tests: the four above + new `riding-given-mount.test.ts` (spawn, mount, return home, refuse region exit, no bond save).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Nalati | taming → bonded mount, saved | rows gain `source: 'tamed'` (the default); nothing else | the four riding tests; tame and ride in game | **medium**: the bonded mount's saved recipe must load unchanged (a fixture with a tamed horse) |

## 4. Done when, hours, blockers

**Done when:** in the showcase you mount the loaner horse at the paddock, gallop and jump in the west, it stops at the
East Gate and walks home when left; Nalati's taming and bonded horse unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex; Opus horse look in the toon kit) | 4 h | 8 h (paddock, horse skin) | **22 h** |

**Blockers:** W1a (the stable hand), W0b (the stable). W7a's Q2 (the quest-page gate) helps but isn't required.

## 5. Risks

- Nalati's horse is painterly; the showcase needs a toon horse (a new skin on the same rig) — a look board first.

## 6. Questions for Jake

1. **Where the loaner can go.** (a) the whole west, never through the East Gate; (b) only the paddock and the oval;
   (c) anywhere. **Recommended (a):** riding between toys is the fun; the east is on foot.
2. **One horse or a choice?** (a) one loaner; (b) three coats to pick from. **Recommended (a)** now; coats are a later
   cosmetic.
