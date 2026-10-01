// An inline SVG card: a golden-hour sky, the cloud sea and three floating islands. No download (ENGINE §8).
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#8e86b4"/><stop offset="0.55" stop-color="#d9a3a8"/><stop offset="0.8" stop-color="#f3c98c"/></linearGradient></defs>'
  + '<rect width="390" height="844" fill="url(#s)"/><circle cx="300" cy="560" r="40" fill="#fbe2a6"/>'
  + '<rect y="640" width="390" height="204" fill="#efe1dc"/>'
  + '<path d="M40 470h150l-40 120h-70z" fill="#4b3a58"/><path d="M40 470h150v-10H40z" fill="#8a9a5b"/>'
  + '<path d="M230 400h120l-30 90h-60z" fill="#4b3a58"/><path d="M230 400h120v-8H230z" fill="#8a9a5b"/>'
  + '<path d="M190 466L232 398" stroke="#9fe6f2" stroke-width="4"/><path d="M290 392v-60l12 60z" fill="#3a2f45"/>'
  + '<path d="M296 336l-26-20M296 336l26-20M296 336l-20 26M296 336l20 26" stroke="#3a2f45" stroke-width="5"/></svg>';
export const SKY_CARD = `data:image/svg+xml,${encodeURIComponent(svg)}`;
export const EXPLORE = { art: { world: SKY_CARD, models: SKY_CARD, sets: SKY_CARD, practice: SKY_CARD } };
