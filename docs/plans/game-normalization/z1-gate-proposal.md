# Z1 gate change for the lead

The existing matrix discovers every `src/shards/*/manifest.ts`, including `_template`.
It runs on `macos-15`; no manual matrix entry is needed. Insert this step before
“Per-shard status” in `.github/workflows/gpu-gate.yml` so failures are reflected in
the shard and aggregate status:

```yaml
      - name: Template gameplay contract
        if: matrix.shard == '_template' && (matrix.mode == 'compare' || matrix.mode == 'bootstrap')
        run: node scripts/test-template-gate.mjs --url=http://127.0.0.1:4400 --out=parity-out/template
```

The script delegates to the existing parity capture, Metal assertion and browser
pool. It installs a template-only hut route and combat step in process, leaving
the four authored shards' routes and combat scripts unchanged. It asserts an
empty boot error list, one hut walk without stuck points, a blob kill using the
custom whip through actual phone attack input, and equality of the independent
before/after unload resource census. Telemetry POSTs use the harness's validated
fixture because a static preview has no backend. Its evidence is `gate.json`.

Run on a built preview:

```sh
node scripts/test-template-gate.mjs --url=http://127.0.0.1:4400 --out=parity-out/template
```

CI configuration stays lead-held. The ordinary template bootstrap artifact must
also be committed by the lead after the first green runner job.
