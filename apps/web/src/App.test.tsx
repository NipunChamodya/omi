// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
it('presents an accessible foundation shell without premature game controls', () => {
  render(<App />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Four friends. One table.' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Your table is taking shape.',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
