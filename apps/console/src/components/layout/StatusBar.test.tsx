import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  it('renders status bar container', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('shows latency indicator', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('latency-indicator')).toBeInTheDocument();
  });

  it('shows connection quality', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('connection-quality')).toBeInTheDocument();
  });

  it('uses contentinfo landmark role', () => {
    render(<StatusBar />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
