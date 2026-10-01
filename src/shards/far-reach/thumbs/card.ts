/** The title card: an inline SVG of the golden-hour sky, the cloud sea and two floating islands (no download). */
const svg = (w: number, h: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">`
  + '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d6fa8"/><stop offset=".45" stop-color="#e3a7a0"/><stop offset=".62" stop-color="#ffd2a0"/><stop offset="1" stop-color="#f6c7c0"/></linearGradient>'
  + '<radialGradient id="g" cx=".3" cy=".52" r=".35"><stop offset="0" stop-color="#fff4d8"/><stop offset="1" stop-color="#fff4d8" stop-opacity="0"/></radialGradient></defs>'
  + '<rect width="390" height="844" fill="url(#s)"/><rect width="390" height="844" fill="url(#g)"/>'
  + '<path d="M0 560 Q60 535 120 556 T250 548 T390 552 V844 H0Z" fill="#f9dccf"/>'
  + '<path d="M70 380 L230 372 L214 400 L170 520 L140 560 L120 470 Z" fill="#3e2f2c"/><path d="M66 380 L234 370 L230 384 L70 392 Z" fill="#6f8a3a"/>'
  + '<path d="M150 372 L156 300 L172 300 L178 372 Z" fill="#e8e0d4"/><path d="M146 302 L164 280 L182 302 Z" fill="#5a3b2e"/>'
  + '<path d="M164 296 L120 250 M164 296 L210 250 M164 296 L118 340 M164 296 L212 342" stroke="#4a3a30" stroke-width="5"/>'
  + '<path d="M260 470 L360 466 L350 486 L322 560 L300 520 Z" fill="#3b2d2a"/><path d="M258 470 L362 464 L360 474 L260 478 Z" fill="#6c8538"/>'
  + '<path d="M232 380 L262 470" stroke="#bfe9ff" stroke-width="6" opacity=".7"/></svg>';
export const SKY_CARD = `data:image/svg+xml,${encodeURIComponent(svg(390, 844))}`;
export const SKY_THUMB = `data:image/svg+xml,${encodeURIComponent(svg(640, 360))}`;
