// SVG data URLs: Sky Reach ships no downloaded art yet (a portrait card of islands over a golden cloud sea).
const CARD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5f95"/><stop offset="0.55" stop-color="#f2a66a"/><stop offset="1" stop-color="#ffe0b8"/></linearGradient></defs>'
  + '<rect width="390" height="844" fill="url(#s)"/><circle cx="120" cy="470" r="34" fill="#fff4d6"/><rect y="520" width="390" height="324" fill="#f6d9c4"/>'
  + '<path d="M150 470h120l-60 120z" fill="#6b5a4e"/><path d="M146 462h128v12H146z" fill="#7d9a45"/><path d="M200 400h18v62h-18z" fill="#e8dccb"/>'
  + '<path d="M30 380h70l-35 70z" fill="#6b5a4e"/><path d="M28 374h74v8H28z" fill="#7d9a45"/><path d="M290 340h60l-30 60z" fill="#6b5a4e"/><path d="M288 334h64v8h-64z" fill="#7d9a45"/>'
  + '<path d="M60 760 210 474" stroke="#8a6a46" stroke-width="10"/><path d="M300 300q30-14 60 0-30 6-30 22z" fill="#9fb4c8"/></svg>';
export const SKY_CARD = `data:image/svg+xml,${encodeURIComponent(CARD_SVG)}`;
export const EXPLORE = { art: { world: SKY_CARD, models: SKY_CARD, sets: SKY_CARD, practice: SKY_CARD } };
