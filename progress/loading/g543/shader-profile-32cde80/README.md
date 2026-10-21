# Shader CPU after post warm-up

Served committed SHA: `32cde805434270f8ab04091082bfc6b6fcc3c733`.
Muted Chromium, iPhone 16 Pro emulation, CPU 4x. Source maps belong to this
exact dist; 221 shardfile and 212 grid chunks map. Each JSON lists unmapped
chunks explicitly and retains sampled self/inclusive times and source lines.

| Path | Entry wall | WebGLNodesHandler.build inclusive |
|---|---|---|
| SHARD SELECT | 26.9 s | 6.446 s |
| Grid | 30.0 s | 3.742 s |

These are diagnostic profiles, not isolated A/B speed claims. Inclusive
times nest and must not be added to parent compiler time. All cold entry
accuracy cases and five actual returns pass, while native warm byte parity
still fails separately. Post materials report completed warm draws; native
first-frame cadence passes, without establishing that every intermittent
driver stall has been eliminated. The node builder remains a substantial
O5 cost; sp-o2 owns its light/key changes, absent from this SHA.
