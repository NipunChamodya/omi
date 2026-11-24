import { useCopy } from '../i18n/locale';
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
  { rank: '10', suit: 'clubs' },
];
export function ThemeControls() {
  const text = useCopy();
  const state = useStore(themeStore);
  useEffect(() => {
    void themeStore.getState().choose(themeStore.getState().selected);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.cardTheme = state.active;
  }, [state.active]);
  return (
    <aside className="theme-controls" aria-label={text('Card appearance')}>
      <details>
        <summary>{text('Card themes')}</summary>
        <label htmlFor="card-theme">{text('Card design')}</label>
        <select
          id="card-theme"
          value={state.selected}
          onChange={(event) => void state.choose(event.target.value)}
        >
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {text(theme.name)}
            </option>
          ))}
        </select>
        <p>
          {text(
            themes.find((theme) => theme.id === state.selected)!.description,
          )}
        </p>
        <div className="theme-preview" aria-label={text('Card theme preview')}>
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
          <span
            className="preview-card"
            role="img"
            aria-label={text('Card back')}
          >
            <CardBack />
          </span>
        </div>
        <p className="quiet-note">
          {text('Your card design is saved on this device.')}
        </p>
        {state.loading && <p role="status">{text('Loading card design…')}</p>}
        {state.error && (
          <div role="alert">
            <p>{state.error}</p>
            <button onClick={() => void state.choose(state.selected)}>
              {text('Retry card design')}
            </button>
          </div>
        )}
      </details>
    </aside>
  );
}
