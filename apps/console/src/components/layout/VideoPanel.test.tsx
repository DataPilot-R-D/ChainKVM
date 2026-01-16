import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VideoPanel } from './VideoPanel';

describe('VideoPanel', () => {
  it('renders video panel container', () => {
    render(<VideoPanel />);
    expect(screen.getByTestId('video-panel')).toBeInTheDocument();
  });

  it('shows placeholder when no stream', () => {
    render(<VideoPanel />);
    expect(screen.getByText(/no video/i)).toBeInTheDocument();
  });

  it('contains VideoRenderer with video element', () => {
    render(<VideoPanel />);
    expect(screen.getByTestId('video-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('video-element')).toBeInTheDocument();
  });
});
