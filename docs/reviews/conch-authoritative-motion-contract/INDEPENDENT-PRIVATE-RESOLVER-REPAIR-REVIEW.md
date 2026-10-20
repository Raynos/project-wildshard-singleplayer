# Independent private composition resolver repair review

Date: 2026-10-20. Verdict: the bounded resolver defect is repaired in source and
covered by actual Vite regression. No remaining concrete blocker found for
root's separately authorized corrected private build after checkpoint/gates.
No corrected app build or browser result is claimed here.

## Retained failure and correction

The first app build exited 0 but was not the intended native composition. I
independently inspected its retained receipt: normal src/practiceBoot.ts and
all four global generated tables were present; src/nativeOwnerProofBoot.ts was
absent. Receipt SHA256 is a841d37562f08909a2bc0d955276e6c98ce2baa5db766ae12ef06e6468368b0d.
The earlier source review did not establish actual resolver precedence; its
composition expectation was disproved by this build. No browser ran against
that failed artifact. Preserve the previous review, original pin and receipt as
negative evidence, not acceptance.

The actual builder now consumes one shared composition plugin with enforce:pre,
before Vite's ordinary filesystem resolution. Before publishing a successful
host receipt it requires the exact pinned native boot hash, excludes the normal
practice boot, and refuses any of the four un-replaced global tables. Corrected
pin/output names use RESOLVER1/resolver1, preserving the first artifact.

## Executable evidence inspected

The regression uses actual Vite build with a temporary module graph, not a
mocked resolveId invocation. Its entry dynamically imports './practiceBoot',
matching the real entry form, and imports all four generated tables. Removing
pre enforcement reproduces the normal boot/global table result and receipt
refusal. Enabling it produces the native boot and every private table in emitted
code and the observed module graph. Wrong boot hash and each global-table
contamination also fail with specific reasons.

Verified all seven frozen hashes below. Inspected writer's final combined
resolver/native product/observer log: **8/8 passed in two files** under the shared
build lease. Final strict and isolated lint logs are empty, with writer-reported
exit 0. I performed source/log/hash inspection only, not another heavy test run,
app build, pin creation or browser capture.

The tiny regression establishes the actual resolver behavior; the next complete
app must still pass its mandatory graph guard and host identity checks. Public
promotion, selected geometry/motion/contact admission and browser-cycle success
remain unproved. Root alone owns checkpoint and corrected build GO.

## Frozen manifest

```text
f405422488b7be6791b730acab200ba6082174ee9378ce426aa88882825d7251  scripts/native-owner-proof-composition.ts
b24ea3c6f5d9e13e3a55b52bc79a9b5ccdc67a5a9f3ab349edf082535f6989d6  scripts/build-native-owner-proof.mjs
8deb2ec33aaef7d22dd78f9586f489a7262d9930dc79e0396363cfee2d109b0e  scripts/native-owner-proof-pin.mjs
d5b92386949d9cecee5b90eaba86b857dd0e5fb119f59ad3864227031621d32a  test/native-owner-proof-composition.test.ts
d4a994115f0c082d00a0bd4e0494c9d9756d3758bb267c833ae06fd57c910a94  docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-BROWSER-PLAN.md
3404e015a61013060660b937fe43456f777393c6ea226136153366763efe0cd1  docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-BROWSER-PIN.json
a841d37562f08909a2bc0d955276e6c98ce2baa5db766ae12ef06e6468368b0d  docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-FIRST-BUILD-RECEIPT.json
```
