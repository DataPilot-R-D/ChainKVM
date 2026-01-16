import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ControlPanel } from './ControlPanel';

describe('ControlPanel', () => {
  it('renders control panel container', () => {
    render(<ControlPanel />);
    expect(screen.getByTestId('control-panel')).toBeInTheDocument();
  });

  it('shows control instructions', () => {
    render(<ControlPanel />);
    expect(screen.getByText(/click video to enable/i)).toBeInTheDocument();
  });

  it('indicates control state', () => {
    render(<ControlPanel />);
    expect(screen.getByTestId('control-state')).toBeInTheDocument();
  });
});
