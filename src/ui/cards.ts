/**
 * A Settings card that folds (E177, Jake: "the debug cards in main menu & pause menu should be collapsed by default and
 * opt into expansion"). The pause menu's Debug card is over half of that panel's scroll height (1166 px of 2215 on a
 * phone), so the variant pickers pushed the settings a player actually wants off the screen. It now starts folded — the
 * title bar is the toggle — and the choice is remembered per card, so a debug session that opens it keeps it open.
 *
 *   const dbg = foldCard('debug', 'Debug', 'for playtests — goes away when the game ships');
 *   dbg.append(label, row, …)   // rows go on the card as before; `.folded` hides everything but the title
 *
 * Styled by src/ui/styles/gmenu.css (`.ws-gmenu-card.fold` / `.folded` / `.ws-gmenu-foldmark`).
 */
const key = (id: string): string => `ws.fold.${id}`;
/** folded unless this card was opened before (storage blocked — private mode, a test browser — reads as folded) */
const wasOpen = (id: string): boolean => { try { return localStorage.getItem(key(id)) === 'open'; } catch { return false; } };

export function foldCard(id: string, title: string, sub = ''): HTMLElement {
  const card = document.createElement('div');
  card.className = 'ws-gmenu-card debug fold';
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'ws-gmenu-cardtitle';
  const mark = document.createElement('i');
  mark.className = 'ws-gmenu-foldmark';
  head.append(mark, document.createTextNode(title));
  if (sub !== '') { const s = document.createElement('small'); s.textContent = sub; head.append(s); }
  card.append(head);
  const paint = (open: boolean): void => { card.classList.toggle('folded', !open); head.setAttribute('aria-expanded', String(open)); };
  paint(wasOpen(id));
  head.addEventListener('click', () => {
    const open = card.classList.contains('folded');
    paint(open);
    try { localStorage.setItem(key(id), open ? 'open' : 'shut'); } catch { /* storage blocked: the fold is just not remembered */ }
  });
  return card;
}
