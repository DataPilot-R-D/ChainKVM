import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Layout } from './Layout';

describe('Layout', () => {
  it('renders header with app title', () => {
    render(<Layout />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('ChainKVM Console')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    render(<Layout />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders video panel section', () => {
    render(<Layout />);
    expect(screen.getByTestId('video-panel')).toBeInTheDocument();
  });

  it('renders control panel section', () => {
    render(<Layout />);
    expect(screen.getByTestId('control-panel')).toBeInTheDocument();
  });

  it('renders status bar with session info', () => {
    render(<Layout />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('has proper landmark structure for accessibility', () => {
    render(<Layout />);
    // Header, main, and complementary (status bar) landmarks
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
