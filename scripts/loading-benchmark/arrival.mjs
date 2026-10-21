/** Read actual arrival release and visible controls, after the first-frame measurement window. */
export function arrivalState() {
  const world = window.__wildshard?.world;
  const visible = selector => {
    const element = document.querySelector(selector);
    if (element === null) return false;
    const style = getComputedStyle(element);
    return element.getClientRects().length > 0 && style.visibility === 'visible' && style.display !== 'none';
  };
  return { reveal: window.__wsReveal, overlay: document.querySelector('.ws-grid-reveal') !== null,
    hiddenHud: document.querySelector('#hud')?.classList.contains('ws-grid-revealing') ?? false,
    entered: world?.hud.entered, paused: world?.hud.paused, gameplayReady: world?.game.frameGate(),
    touch: visible('.ws-touch-lookpad'), pause: visible('.ws-touch-pause'),
    feet: world?.player.position.toArray(), yaw: world?.player.yaw,
    grid: window.__wildshard?.shard?.grid?.state() };
}
