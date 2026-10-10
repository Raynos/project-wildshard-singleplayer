// SVG data URLs keep this fixture free of downloadable art assets.
/** the ink valley's picker card: a paper sky with a red sun over two inked ridges and a sage valley floor */
export const INK_CARD = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="390" height="844" fill="#ece3c8"/><circle cx="140" cy="210" r="56" fill="#e8743f"/><path d="M0 470l120-120 90 70 80-90 100 110v404H0z" fill="#5f8a8b" stroke="#141018" stroke-width="5"/><path d="M0 560l390-40v324H0z" fill="#8f9c5e" stroke="#141018" stroke-width="5"/><path d="M175 600h40v90h-40z" fill="#ece3c8" stroke="#141018" stroke-width="5"/></svg>')}`;
/** the Explore screen's art: the same card on every tab */
export const EXPLORE = { art: { world: INK_CARD, models: INK_CARD, sets: INK_CARD, practice: INK_CARD } };
