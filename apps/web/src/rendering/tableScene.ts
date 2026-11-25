import { Application, Graphics } from 'pixi.js';
import { createCardLayer } from './cardLayer';

/** A demand-driven scene. The DOM remains usable throughout initialization and GPU loss. */
export async function mountTableScene(
  host: HTMLElement,
  root: HTMLElement,
  getReveal: () => string | null,
  signal: AbortSignal,
) {
  if (signal.aborted) return;
  const app = new Application();
  try {
    await app.init({
      preference: 'webgl',
      autoStart: false,
      resolution: Math.min(devicePixelRatio || 1, 1.5),
      autoDensity: true,
      backgroundAlpha: 0,
    });
  } catch {
    if (app.renderer) app.destroy();
    return;
  }
  if (signal.aborted) {
    app.destroy();
    return;
  }

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const halo = new Graphics()
    .ellipse(0, 0, 28, 17)
    .stroke({ color: 0xffd044, width: 2 });
  const cards = createCardLayer(invalidate);
  app.stage.addChild(halo, cards.layer);
  let lastReveal = getReveal();
  let revealedAt = -Infinity;
  let frame = 0;
  let disposed = false;

  function invalidate() {
    if (disposed || frame || document.hidden) return;
    frame = requestAnimationFrame(paint);
  }

  function paint(now: number) {
    frame = 0;
    try {
      const bounds = host.getBoundingClientRect();
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height || document.hidden) return;
      if (width !== app.screen.width || height !== app.screen.height)
        app.renderer.resize(width, height);
      const reveal = getReveal();
      if (reveal !== lastReveal) {
        lastReveal = reveal;
        revealedAt = reveal && !motion.matches ? now : -Infinity;
      }
      const progress = (now - revealedAt) / 550;
      const trick = root.querySelector('.trick-area')?.getBoundingClientRect();
      halo.visible = Boolean(trick && progress < 1 && !motion.matches);
      if (halo.visible && trick) {
        halo.position.set(
          trick.left + trick.width / 2 - bounds.left,
          trick.top + trick.height / 2 - bounds.top,
        );
        halo.scale.set(1 + progress);
        halo.alpha = (1 - progress) * 0.7;
      }
      const animating = cards.update(root, bounds);
      app.render();
      host.dataset.renderer = 'pixi';
      if (animating || halo.visible) invalidate();
    } catch {
      dispose();
    }
  }

  const resize = new ResizeObserver(invalidate);
  const mutations = new MutationObserver(invalidate);
  const events = [
    'animationstart',
    'animationend',
    'transitionrun',
    'transitionend',
    'focusin',
    'focusout',
  ];
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      revealedAt = -Infinity;
      lastReveal = getReveal();
    } else invalidate();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    motion.removeEventListener('change', invalidate);
    for (const event of events) root.removeEventListener(event, invalidate);
    signal.removeEventListener('abort', dispose);
    app.canvas.removeEventListener('webglcontextlost', dispose);
    delete host.dataset.renderer;
    cards.dispose();
    app.destroy({ removeView: true }, { children: true });
  }

  host.append(app.canvas);
  resize.observe(root);
  const felt = root.querySelector('.felt-table');
  if (felt) resize.observe(felt);
  mutations.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'class',
      'style',
      'data-dragging',
      'data-awaiting',
      'data-deck-theme',
    ],
  });
  mutations.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-card-theme'],
  });
  for (const event of events) root.addEventListener(event, invalidate);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', invalidate);
  app.canvas.addEventListener('webglcontextlost', dispose);
  signal.addEventListener('abort', dispose, { once: true });
  invalidate();
  return invalidate;
}
