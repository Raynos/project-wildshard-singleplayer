// SVG data URLs: a dusk dune card with no downloadable art (a portrait capture replaces it once Jake picks the look).
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#141634"/><stop offset="0.45" stop-color="#3b2a4a"/><stop offset="0.62" stop-color="#d0642a"/><stop offset="0.66" stop-color="#f08a3a"/></linearGradient>'
  + '<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4420"/><stop offset="1" stop-color="#3a1a0c"/></linearGradient></defs>'
  + '<rect width="390" height="844" fill="url(#s)"/><circle cx="60" cy="90" r="1.2" fill="#e8e4f0"/><circle cx="300" cy="60" r="1" fill="#e8e4f0"/><circle cx="210" cy="150" r="1" fill="#e8e4f0"/>'
  + '<path d="M0 560 Q120 500 230 540 T390 530 V844 H0z" fill="#5a2c16"/><path d="M0 640 Q160 560 390 650 V844 H0z" fill="url(#d)"/>'
  + '<path d="M246 470 h4 l6 60 h-16z M238 466 h20 v5 h-20z" fill="#2a160c"/><circle cx="248" cy="462" r="3" fill="#ffb060"/>'
  + '<path d="M90 300 q40 -18 70 0 q-35 6 -35 14 q0 -8 -35 -14z" fill="#1c1420"/></svg>';
export const DUNE_CARD = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
export const EXPLORE = { art: { world: DUNE_CARD, models: DUNE_CARD, sets: DUNE_CARD, practice: DUNE_CARD } };
