import { Texture } from 'pixi.js';
import { suits } from '../components/Cards';
import type { Suit } from '@omi/shared';

/** Use the same pip and court illustrations as the accessible browser fallback. */
export async function makeCardTexture(face: HTMLElement) {
  const { rank, suit } = face.dataset;
  const symbol = suits[suit as Suit].symbol;
  const theme = face.dataset.deckTheme;
  const ink = face.classList.contains('red') ? '#a51d41' : '#172c3b';
  const corner = `<text x="12" y="20" font-size="16" font-weight="bold">${rank}</text>
    <text x="12" y="35" font-size="16">${symbol}</text>`;
  const art = face.querySelector('svg')?.cloneNode(true) as
    SVGSVGElement | undefined;
  if (art) {
    art.setAttribute('x', '20');
    art.setAttribute('y', '15');
    art.setAttribute('width', '60');
    art.setAttribute('height', '110');
    art.setAttribute('font-size', '9');
    art.setAttribute('text-anchor', 'middle');
  }
  const artwork = art
    ? new XMLSerializer().serializeToString(art)
    : `<text x="50" y="88" font-size="51">${symbol}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 100 140">
    <rect x="1" y="1" width="98" height="138" rx="9" fill="#fffdf6" stroke="#d3cbb8" stroke-width="2"/>
    ${theme === 'tropical' ? '<rect x="4" y="4" width="92" height="132" rx="7" fill="none" stroke="#dcad66"/>' : ''}
    <g fill="${ink}" font-family="Georgia, serif" text-anchor="middle">
      ${artwork}${corner}<g transform="rotate(180 50 70)">${corner}</g>
    </g>
  </svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return Texture.from(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}
