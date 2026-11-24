import type { ComponentProps, ReactNode } from 'react';
import { useCopy } from '../i18n/locale';

export function GameButton({
  tone = 'blue',
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { tone?: 'blue' | 'green' | 'gold' }) {
  return (
    <button
      {...props}
      className={`button game-button game-button--${tone} ${className}`}
    >
      {children}
    </button>
  );
}

export function GameBack({ onClick }: { onClick: () => void }) {
  const text = useCopy();
  return (
    <GameButton className="game-back" type="button" onClick={onClick}>
      <span aria-hidden="true">‹</span> {text('Back')}
    </GameButton>
  );
}

export function GamePanel({
  children,
  titleId,
  recovery = false,
}: {
  children: ReactNode;
  titleId: string;
  recovery?: boolean;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={`entry-panel game-panel ${recovery ? 'game-panel--recovery' : ''}`}
    >
      {children}
    </section>
  );
}
