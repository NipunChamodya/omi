import type { ComponentProps, ReactNode } from 'react';
import { useCopy } from '../i18n/locale';

const buttonTones = {
  primary: 'green',
  secondary: 'blue',
  warning: 'gold',
  danger: 'red',
  neutral: 'neutral',
} as const;

type GameButtonProps = ComponentProps<'button'> & {
  tone?: (typeof buttonTones)[keyof typeof buttonTones];
  variant?: keyof typeof buttonTones;
  size?: 'small' | 'medium' | 'large' | 'responsive';
  loading?: boolean;
};

export function GameButton({
  tone = 'blue',
  variant,
  size,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: GameButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
      className={`button game-button game-button--${variant ? buttonTones[variant] : tone} ${size ? `game-button-size--${size}` : ''} ${className}`}
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

export function GameRibbon({
  as: Heading = 'h2',
  id,
  children,
}: {
  as?: 'h1' | 'h2';
  id: string;
  children: ReactNode;
}) {
  return (
    <Heading className="game-ribbon" id={id}>
      {children}
    </Heading>
  );
}
