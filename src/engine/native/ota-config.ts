/**
 * Public over-the-air update channel for the native shells (docs/plans/NATIVE-APPS.md N-D). Everything here is
 * public on purpose: the channel URLs, and the RSA public key that every signed manifest is checked against.
 * The matching private key lives outside the repo (~/.config/wildshard/ota-signing.pem, and the OTA_SIGNING_KEY
 * Actions secret that `gh workflow run ota-promote` signs with). Replacing this key needs a store binary.
 *
 * The update host is its own Vercel project (`wildshard-updates`), separate from the game site: a web deploy never
 * moves the phones, and a promote never touches the web. Files are content-addressed at `/f/<sha256>`.
 */

export const OTA_ORIGIN = 'https://wildshard-updates.vercel.app';

/** One signed channel per platform. The `v1` segment is the native runtime line (OTA_RUNTIME). */
export const OTA_CHANNELS = {
  ios: `${OTA_ORIGIN}/ios/v1/manifest.json`,
  android: `${OTA_ORIGIN}/android/v1/manifest.json`,
} as const;

/** The JS ↔ native contract. Bump it (and the channel path) when an OTA bundle would need a newer native shell. */
export const OTA_RUNTIME = 'native-v1';

/** The save format an OTA bundle must read. A bundle that changes the save layout ships with a new number. */
export const OTA_SAVE_SCHEMA = 1;

/** RSA-3072 public key (RSA-PSS / SHA-256, salt 32). SHA-256 of its SPKI DER:
 *  d172b6471cc8e642ab4f81b1ab2f27c4511bbf118691f2eb9ac0e5a06277e6be */
export const OTA_PUBLIC_KEY: JsonWebKey = {
  kty: 'RSA',
  e: 'AQAB',
  n: 'xrPbHT-GhXAjwwrlKF6YSfoYVrZaWNvSKXE32NIModX93-MxzFHWMoCvH2MlfVGnICerE76m7scVYZdjpApFtH4xF5GTWYW0ZBwgU_TPWTmyxI0RaAOWWysKsrUNtOMoC8CwDcCwgT6w2bIio7zyjvePPU2WpUllaElINOaLdI4VLHsxOKhOa7WLSm6SHTtqQt2sGxxypWMAhTdoq0qN0ZXP7ykFRz8g8aEj70BKB1Aug8Ahw1Lta11XsvSJ5zW-mMkzXK3kXy_ZQL0QFpLoHpJ5iN5rarhEeMXZ6aT-VlDd8GMffz05GjshdfFAa7RE2lhCNX1K1qAq9Ob2mo4vBr0wU2ykDH2f92bwSzH8WNmg8BtnMvnF_5HuMuPagTKGJfuZbnrkxsZFy8NSEndRopZ8tAyJsVbPkmOXbR_GTvoiUyt4tz8UF16nqfdL9cE_BAipR-V_oromf9S75kZaJ_k8iGLo9WUvYCmAKgJMqLzqmQnqMqIaSCeibEP47J83',
};
