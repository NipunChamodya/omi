import type { Card } from '@omi/shared';

const clothing = {
  spades: '#265b89',
  diamonds: '#ad2756',
  hearts: '#bd4449',
  clubs: '#177d66',
};

export function TropicalCourt({ card }: { card: Card }) {
  const crown =
    card.rank === 'K'
      ? 'M15 14l-2-9 6 4 5-7 5 7 6-4-2 9z'
      : card.rank === 'Q'
        ? 'M14 15q2-8 10-9 8 1 10 9z'
        : 'M14 15q-1-9 11-12l9 11z';
  const figure = (key: string, transform?: string) => (
    <g key={key} transform={transform}>
      <path
        d="M10 35q6-11 14-11t14 11L34 48 10 40z"
        fill={clothing[card.suit]}
      />
      <path
        d="M12 37l8-9 13 17m-17-6 10-10"
        fill="none"
        stroke="#f6c968"
        strokeWidth="2"
      />
      <path d="M16 14h16v8q-1 7-8 7t-8-7z" fill="#ffd0a0" stroke="#4c3a3d" />
      <path d={crown} fill="#ffc946" stroke="#68433b" strokeWidth="1.4" />
      <path
        d="M20 19h1m6 0h1m-6 4q2 2 4 0"
        fill="none"
        stroke="#57343d"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="m36 12 4 5-4 5-4-5z" fill={clothing[card.suit]} />
      <path d="M9 18v12m-3-9h6" stroke="#d59b42" strokeWidth="1.8" />
    </g>
  );
  return (
    <svg className="card-court" viewBox="0 0 48 76" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="46"
        height="74"
        rx="4"
        fill="#fff5dc"
        stroke="#e0af61"
        strokeWidth="2"
      />
      <path d="M2 44 46 28v15L2 62z" fill="#b9ddca" />
      {figure('top')}
      {figure('bottom', 'rotate(180 24 38)')}
    </svg>
  );
}
