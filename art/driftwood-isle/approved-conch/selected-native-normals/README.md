# Selected Conch source-normal-preserving native preparation

Read `docs/reviews/conch-selected-native-normals.md` from the repository root.

- `export_native.py`: editable pinned adapter; source models remain untouched.
- `native/conch-character-pass-native.json`: source asset with exact NORMAL data.
- `native/metadata.json` and `native/payload.bin`: existing packed-body format.
- `native/mesh-map.json`: exact material regions and source double-sided flags.
- `native/rig-provenance.json`: unchanged 15-joint diagnostic provenance.
- `test_export_native.py`: 10 preservation/reproduction/negative controls.
- `native-consumer.test.ts`: independent GLTFLoader and real packed-consumer,
  actual skin/rest and CPU skin-normal equation tests. No GPU proof.
- `audit_normals.py` / `normal-audit.json`: unchanged 21 cap-normal deviations.
- `input-pins.json`, `native/closure.json`, `freeze.json`: reproducibility records.

No source repair, visual score, app integration or production admission.
