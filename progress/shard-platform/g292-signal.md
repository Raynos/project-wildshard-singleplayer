# G292 Signal producer rollout

4 producers, 17 retained outputs. Darwin arm64 cold/forced full output hashes are byte-exact; every warm
hit validates those hashes. Node outputs also match committed bytes exactly. Browser comparisons exclude only
top-level revision/build/inputs where present; all nested gameplay, clocks, actors and colliders stay exact.
No output is removed or rewritten. Report-only until coordinator gate + Linux CI evidence.

Captures use the immutable preview export at `1090df8a2b5b6b65b251922068c5d9fdd9ea66b9`, fenced build id and Chromium binary. Node jobs copy
and verify each declared source closure before running. Encoders, schemas/seeds and source assets remain declared;
no copied seed can pass as a fresh bake. The actual producer writes every output.

| Producer | Outputs | Cold ms | Warm ms | Forced ms | Cache key |
| --- | ---: | ---: | ---: | ---: | --- |
| signal-rigs | 1 | 805.188 | 0.394 | 740.927 | `a2411d296654bb28f60078dd2ec9e1158ed395abc00fed3d976a0e7f97f106cf` |
| signal-sand | 4 | 2680.323 | 0.843 | 2748.389 | `28335a68754674c8e69497efa132c5fe4cf18c68918a076ffc79f1993af1f3ec` |
| signal-world | 11 | 1301.722 | 1.030 | 1243.872 | `6efec02e8bdaeb8ba4254e5bb3f092ec60d3b51f4ad3987cbbb7bfec66c94a48` |
| signal-physics | 1 | 17372.634 | 0.463 | 14487.534 | `4a8ba1097eb539a7ef965e02db216d635ccfd25349ad76a106cbcb0755d432ad` |

Times are backend elapsed values, excluding initial input-map/key verification. No full suite, runtime/collider change,
witness refresh, output deletion or Linux bit-exact claim. All capture browsers and leases closed.
Discovery validation, focused runner tests, scoped strict and touched-tool lint are green.

The initial sand attempt refused a missing `lint/runtime-performance.mjs` input. Its actual SDK dependency is now
declared, and the complete closure passed cold/warm/forced. The refused attempt is not counted as proof.
