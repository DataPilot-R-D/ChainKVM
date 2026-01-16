import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectionHealth } from './ConnectionHealth';
import type { ConnectionStats } from '../../hooks/useConnectionStats';

const mockStats: ConnectionStats = {
  rttMs: 45,
  packetLossPercent: 0.5,
  videoBitrateMbps: 2.5,
  frameRate: 30,
};

describe('ConnectionHealth', () => {
  describe('metrics display', () => {
    it('should display RTT in milliseconds', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      expect(screen.getByTestId('rtt-value')).toHaveTextContent('45 ms');
    });

    it('should display packet loss percentage', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      expect(screen.getByTestId('packet-loss-value')).toHaveTextContent(
        '0.5%'
      );
    });

    it('should display video bitrate in Mbps', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      expect(screen.getByTestId('bitrate-value')).toHaveTextContent('2.5 Mbps');
    });

    it('should display frame rate in fps', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      expect(screen.getByTestId('framerate-value')).toHaveTextContent('30 fps');
    });

    it('should display placeholder when stats are null', () => {
      render(<ConnectionHealth stats={null} healthStatus="unknown" />);

      expect(screen.getByTestId('rtt-value')).toHaveTextContent('--');
      expect(screen.getByTestId('packet-loss-value')).toHaveTextContent('--');
      expect(screen.getByTestId('bitrate-value')).toHaveTextContent('--');
      expect(screen.getByTestId('framerate-value')).toHaveTextContent('--');
    });
  });

  describe('health indicator', () => {
    it('should display good health indicator', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      const indicator = screen.getByTestId('health-indicator');
      expect(indicator).toHaveClass('health-indicator--good');
    });

    it('should display warning health indicator', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="warning" />);

      const indicator = screen.getByTestId('health-indicator');
      expect(indicator).toHaveClass('health-indicator--warning');
    });

    it('should display critical health indicator', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="critical" />);

      const indicator = screen.getByTestId('health-indicator');
      expect(indicator).toHaveClass('health-indicator--critical');
    });

    it('should display unknown health indicator when status unknown', () => {
      render(<ConnectionHealth stats={null} healthStatus="unknown" />);

      const indicator = screen.getByTestId('health-indicator');
      expect(indicator).toHaveClass('health-indicator--unknown');
    });
  });

  describe('visibility toggle', () => {
    it('should be visible by default when visible prop is true', () => {
      render(
        <ConnectionHealth stats={mockStats} healthStatus="good" visible />
      );

      expect(screen.getByTestId('connection-health-overlay')).toBeVisible();
    });

    it('should be hidden when visible prop is false', () => {
      render(
        <ConnectionHealth
          stats={mockStats}
          healthStatus="good"
          visible={false}
        />
      );

      expect(
        screen.queryByTestId('connection-health-overlay')
      ).not.toBeInTheDocument();
    });

    it('should call onToggle when toggle button clicked', () => {
      const onToggle = vi.fn();
      render(
        <ConnectionHealth
          stats={mockStats}
          healthStatus="good"
          visible
          onToggle={onToggle}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /hide/i });
      fireEvent.click(toggleButton);

      expect(onToggle).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible metric labels', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      expect(screen.getByText(/round-trip time/i)).toBeInTheDocument();
      expect(screen.getByText(/packet loss/i)).toBeInTheDocument();
      expect(screen.getByText(/video bitrate/i)).toBeInTheDocument();
      expect(screen.getByText(/frame rate/i)).toBeInTheDocument();
    });

    it('should have accessible health status', () => {
      render(<ConnectionHealth stats={mockStats} healthStatus="good" />);

      const indicator = screen.getByTestId('health-indicator');
      expect(indicator).toHaveAttribute('aria-label', 'Connection health: good');
    });
  });

  describe('compact mode', () => {
    it('should show only health indicator in compact mode', () => {
      render(
        <ConnectionHealth
          stats={mockStats}
          healthStatus="good"
          compact
        />
      );

      expect(screen.getByTestId('health-indicator')).toBeInTheDocument();
      expect(screen.queryByTestId('rtt-value')).not.toBeInTheDocument();
    });
  });
});
