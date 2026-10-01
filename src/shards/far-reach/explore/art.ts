// An inline SVG card: golden-hour sky, the cloud sea and two floating islands. No downloadable art.
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">'
  + '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f88b8"/><stop offset="0.55" stop-color="#e8b8b0"/><stop offset="1" stop-color="#f6d6b8"/></linearGradient></defs>'
  + '<rect width="390" height="844" fill="url(#s)"/><circle cx="270" cy="470" r="46" fill="#ffe7c2" opacity="0.85"/>'
  + '<path d="M0 600 Q100 570 200 600 T390 590 V844 H0Z" fill="#f3e2d6"/>'
  + '<path d="M40 420h170l-30 20-55 120-30-120z" fill="#5a3f4a"/><path d="M40 420h170v-8H40z" fill="#6f8a4a"/>'
  + '<path d="M240 330h110l-20 14-35 80-22-80z" fill="#5a3f4a"/><path d="M240 330h110v-6H240z" fill="#6f8a4a"/>'
  + '<path d="M150 412l6-60h8l6 60z" fill="#4b3a40"/><path d="M160 352l-40-30 4-4 40 30zM160 352l30-40 5 4-30 40z" fill="#3a2c33"/>'
  + '<path d="M210 418L240 334" stroke="#7fe0ff" stroke-width="4" opacity="0.8"/></svg>';
export const SKY_CARD = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
export const EXPLORE = { art: { world: SKY_CARD, models: SKY_CARD, sets: SKY_CARD, practice: SKY_CARD } };
