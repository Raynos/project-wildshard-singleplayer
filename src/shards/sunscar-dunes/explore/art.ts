// An inline SVG card: dusk dunes, the far tower and the ray. No download (ENGINE §8: data: images add no bytes).
const svg = (w: number, h: number): string => {
  const horizon = Math.round(h * 0.56);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a3a"/><stop offset="0.62" stop-color="#3b2f55"/>'
    + '<stop offset="0.86" stop-color="#c8643a"/><stop offset="1" stop-color="#f09a4e"/></linearGradient>'
    + '<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5552a"/><stop offset="1" stop-color="#3a1d14"/></linearGradient></defs>'
    + `<rect width="${w}" height="${horizon}" fill="url(#s)"/>`
    + `<path d="M0 ${horizon - 6} Q${w * 0.3} ${horizon - 30} ${w * 0.55} ${horizon - 12} T${w} ${horizon - 8} V${h} H0Z" fill="#5a3020"/>`
    + `<path d="M0 ${horizon + h * 0.12} Q${w * 0.45} ${horizon - h * 0.02} ${w} ${horizon + h * 0.16} V${h} H0Z" fill="url(#d)"/>`
    + `<path d="M${w * 0.52} ${horizon - 14} l6 -34 l6 34 M${w * 0.5} ${horizon - 40} h16" stroke="#1d120e" stroke-width="3" fill="none"/>`
    + `<circle cx="${w * 0.555}" cy="${horizon - 52}" r="4" fill="#ffb45a"/>`
    + `<path d="M${w * 0.25} ${h * 0.22} q${w * 0.08} -${h * 0.03} ${w * 0.16} 0 q-${w * 0.08} ${h * 0.012} -${w * 0.16} 0Z" fill="#1a1222"/>`
    + '</svg>';
};
export const DUNES_CARD = `data:image/svg+xml,${encodeURIComponent(svg(640, 360))}`;
export const DUNES_PORTRAIT = `data:image/svg+xml,${encodeURIComponent(svg(390, 844))}`;
export const EXPLORE = { art: { world: DUNES_CARD, models: DUNES_CARD, sets: DUNES_CARD, practice: DUNES_CARD } };
