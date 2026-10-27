import { useEffect } from 'react';
import { useStore } from 'zustand';
import { themes } from './registry';
import { themeStore } from './store';
import { CardBack, CardFace, cardName } from '../components/Cards';
import type { Card } from '@omi/shared';
const preview: readonly Card[] = [
  { rank: 'A', suit: 'spades' },
  { rank: 'K', suit: 'hearts' },
  { rank: 'Q', suit: 'diamonds' },
  { rank: 'J', suit: 'clubs' },
];
export function ThemeControls() {
  const state = useStore(themeStore);
  useEffect(() => {
    void themeStore.getState().choose(themeStore.getState().selected);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.cardTheme = state.active;
  }, [state.active]);
  return (
    <aside className="theme-controls" aria-label="Card appearance">
      <details>
        <summary>Card themes</summary>
        <label htmlFor="card-theme">Card design</label>
        <select
          id="card-theme"
          value={state.selected}
          onChange={(event) => void state.choose(event.target.value)}
        >
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        <p>
          {themes.find((theme) => theme.id === state.selected)!.description}
        </p>
        <div className="theme-preview" aria-label="Card theme preview">
          {preview.map((card) => (
            <span
              className="preview-card"
              role="img"
              aria-label={cardName(card)}
              key={card.suit}
            >
              <CardFace card={card} />
            </span>
          ))}
          <span className="preview-card" role="img" aria-label="Card back">
            <CardBack />
          </span>
        </div>
        <p className="quiet-note">
          Only your cards’ appearance changes. Saved in this browser; no
          purchase required.
        </p>
        {state.loading && <p role="status">Loading card design…</p>}
        {state.error && (
          <div role="alert">
            <p>{state.error}</p>
            <button onClick={() => void state.choose(state.selected)}>
              Retry card design
            </button>
          </div>
        )}
      </details>
    </aside>
  );
}
