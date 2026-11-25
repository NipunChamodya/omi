import { Container, Sprite, type Texture } from 'pixi.js';
import { makeCardTexture } from './cardTexture';

const cardSelector = '.hand-card, .trick-area .thrown-card';

/** Mirrors semantic hit regions, including their live CSS/WAAPI transforms. */
export function createCardLayer(invalidate: () => void) {
  const layer = new Container({ sortableChildren: true });
  const textures = new Map<string, Texture | null>();
  const sprites = new Map<HTMLElement, Sprite>();
  let disposed = false;
  let currentTheme: string | undefined;
  let generation = 0;

  function clear() {
    generation++;
    for (const [node, sprite] of sprites) {
      delete node.dataset.pixiFace;
      sprite.destroy();
    }
    sprites.clear();
    for (const texture of textures.values()) texture?.destroy(true);
    textures.clear();
  }

  function update(root: HTMLElement, bounds: DOMRect) {
    const theme = document.documentElement.dataset.cardTheme;
    if (theme !== currentTheme) {
      clear();
      currentTheme = theme;
    }
    const nodes = [...root.querySelectorAll<HTMLElement>(cardSelector)];
    const active = new Set(nodes);
    for (const [node, sprite] of sprites) {
      if (active.has(node)) continue;
      delete node.dataset.pixiFace;
      sprite.destroy();
      sprites.delete(node);
    }

    let animating = false;
    nodes.forEach((node, index) => {
      const face = node.querySelector<HTMLElement>('.card-face');
      if (!face) return;
      const key = `${face.dataset.deckTheme}:${face.dataset.suit}:${face.dataset.rank}`;
      if (!textures.has(key)) {
        const requestedGeneration = generation;
        textures.set(key, null);
        void makeCardTexture(face)
          .then((texture) => {
            if (disposed || generation !== requestedGeneration)
              texture.destroy(true);
            else {
              textures.set(key, texture);
              invalidate();
            }
          })
          .catch(() => {
            // This face continues to use the accessible DOM artwork.
          });
      }
      const texture = textures.get(key);
      if (!texture) {
        const previous = sprites.get(node);
        if (previous) {
          previous.destroy();
          sprites.delete(node);
          delete node.dataset.pixiFace;
        }
        return;
      }

      let sprite = sprites.get(node);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        layer.addChild(sprite);
        sprites.set(node, sprite);
      }
      sprite.texture = texture;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const matrix = new DOMMatrixReadOnly(
        style.transform === 'none' ? undefined : style.transform,
      );
      const extraAngle = Number.parseFloat(style.rotate) || 0;
      const scale =
        style.scale === 'none' ? [1, 1] : style.scale.split(' ').map(Number);
      sprite.position.set(
        rect.left + rect.width / 2 - bounds.left,
        rect.top + rect.height / 2 - bounds.top,
      );
      sprite.rotation =
        Math.atan2(matrix.b, matrix.a) + (extraAngle * Math.PI) / 180;
      sprite.width =
        node.offsetWidth * Math.hypot(matrix.a, matrix.b) * (scale[0] ?? 1);
      sprite.height =
        node.offsetHeight *
        Math.hypot(matrix.c, matrix.d) *
        (scale[1] ?? scale[0] ?? 1);
      sprite.alpha = Number(style.opacity);
      sprite.zIndex =
        index +
        (node.dataset.dragging || node.dataset.awaiting
          ? 300
          : node.matches('.selected, :focus-visible')
            ? 200
            : 0);
      if (!node.dataset.pixiFace) node.dataset.pixiFace = 'true';
      animating ||= node
        .getAnimations()
        .some(
          (animation) =>
            animation.playState === 'running' &&
            animation.effect?.getComputedTiming().progress != null,
        );
    });
    return animating;
  }

  return {
    layer,
    update,
    dispose() {
      disposed = true;
      clear();
      layer.destroy();
    },
  };
}
