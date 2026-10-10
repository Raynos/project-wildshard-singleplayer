# G292 Sky producer rollout

3 producers, 29 retained outputs. Darwin arm64 cold/forced full output hashes are byte-exact; every warm
hit validates those hashes. Node outputs also match committed bytes exactly. Browser comparisons exclude only
top-level revision/build/inputs where present; all nested gameplay, clocks, actors and colliders stay exact.
No output is removed or rewritten. Report-only until coordinator gate + Linux CI evidence.

Captures use the immutable preview export at `1090df8a2b5b6b65b251922068c5d9fdd9ea66b9`, fenced build id and Chromium binary. Node jobs copy
and verify each declared source closure before running. Encoders, schemas/seeds and source assets remain declared;
no copied seed can pass as a fresh bake. The actual producer writes every output.

| Producer | Outputs | Cold ms | Warm ms | Forced ms | Cache key |
| --- | ---: | ---: | ---: | ---: | --- |
| sky-rigs | 3 | 3308.099 | 2.007 | 3168.062 | `6d82c36d85d9d80d3e3fcddffac0bb619c575ffcd5fd1d7b314dddd465f12607` |
| sky-world | 25 | 3912.440 | 275.182 | 4015.878 | `b19553a001ee8498351b969006b3aff4ef518791943e45ddd7114e7cafbb49f1` |
| sky-physics | 1 | 16192.326 | 0.729 | 17631.837 | `4ef8fd000a9522d7171e2933fdc7e1804800336049540646b2c820f4be1f6173` |

Times are backend elapsed values, excluding initial input-map/key verification. No full suite, runtime/collider change,
witness refresh, output deletion or Linux bit-exact claim. All capture browsers and leases closed.
Discovery validation, focused runner tests, scoped strict and touched-tool lint are green.
