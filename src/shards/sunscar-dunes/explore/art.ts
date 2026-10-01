// An SVG data URL keeps the card and Explore art bundled (no download): dusk sky, a dune line, the tower.
const svg = (w: number, h: number): string => {
  const crest = h * 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="#141a3c"/><stop offset="0.55" stop-color="#3a2c5c"/><stop offset="0.72" stop-color="#d06a34"/><stop offset="0.8" stop-color="#f09a4a"/></linearGradient>`
    + `<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a5a34"/><stop offset="1" stop-color="#3e2a2c"/></linearGradient></defs>`
    + `<rect width="${w}" height="${h}" fill="url(#s)"/>`
    + `<path d="M0 ${crest} Q${w * 0.3} ${crest - h * 0.06} ${w * 0.55} ${crest - h * 0.01} T${w} ${crest - h * 0.03} V${h} H0Z" fill="url(#d)"/>`
    + `<path d="M${w * 0.64} ${crest - h * 0.02} v-${h * 0.09} m-${w * 0.03} 0 h${w * 0.06} m-${w * 0.03} 0 v-${h * 0.04}" stroke="#1b1424" stroke-width="${w * 0.008}" fill="none"/>`
    + `<circle cx="${w * 0.64}" cy="${crest - h * 0.115}" r="${w * 0.012}" fill="#ffb347"/></svg>`;
};
export const DUSK_CARD = `data:image/svg+xml,${encodeURIComponent(svg(390, 844))}`;
export const DUSK_WIDE = `data:image/svg+xml,${encodeURIComponent(svg(640, 360))}`;
export const EXPLORE = { art: { world: DUSK_CARD, models: DUSK_CARD, sets: DUSK_CARD, practice: DUSK_CARD } };
