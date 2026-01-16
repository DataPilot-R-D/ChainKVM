import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('renders app title', () => {
    render(<Header />);
    expect(screen.getByText('ChainKVM Console')).toBeInTheDocument();
  });

  it('renders session status indicator', () => {
    render(<Header />);
    expect(screen.getByTestId('session-status')).toBeInTheDocument();
  });

  it('shows disconnected state by default', () => {
    render(<Header />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it('uses header landmark role', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
