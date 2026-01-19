import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SessionStatus } from './SessionStatus';
import type { SessionState, PermissionLevel } from './SessionStatus';

describe('SessionStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ConnectionStateIndicator', () => {
    it('should display disconnected state with red indicator', () => {
      render(<SessionStatus connectionState="disconnected" />);

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('connection-indicator--disconnected');
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });

    it('should display connecting state with yellow indicator', () => {
      render(<SessionStatus connectionState="connecting" />);

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('connection-indicator--connecting');
      expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    });

    it('should display connected state with green indicator', () => {
      render(<SessionStatus connectionState="connected" />);

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('connection-indicator--connected');
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    it('should display reconnecting state with amber indicator', () => {
      render(<SessionStatus connectionState="reconnecting" />);

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('connection-indicator--reconnecting');
      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    });

    it('should display failed state with red indicator', () => {
      render(<SessionStatus connectionState="failed" />);

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('connection-indicator--failed');
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });

    it('should display revoked state with distinct indicator', () => {
      render(<SessionStatus connectionState="revoked" />);

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('connection-indicator--revoked');
      expect(screen.getByText(/revoked/i)).toBeInTheDocument();
    });
  });

  describe('SessionTimer', () => {
    it('should display session duration when connected', () => {
      const sessionStart = new Date(Date.now() - 65000); // 1 min 5 sec ago
      render(
        <SessionStatus
          connectionState="connected"
          sessionStartTime={sessionStart}
        />
      );

      expect(screen.getByTestId('session-timer')).toHaveTextContent('01:05');
    });

    it('should update timer every second', () => {
      const sessionStart = new Date();
      render(
        <SessionStatus
          connectionState="connected"
          sessionStartTime={sessionStart}
        />
      );

      expect(screen.getByTestId('session-timer')).toHaveTextContent('00:00');

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByTestId('session-timer')).toHaveTextContent('00:05');
    });

    it('should not show timer when disconnected', () => {
      render(<SessionStatus connectionState="disconnected" />);

      expect(screen.queryByTestId('session-timer')).not.toBeInTheDocument();
    });

    it('should display hours when session exceeds 60 minutes', () => {
      const sessionStart = new Date(Date.now() - 3665000); // 1h 1m 5s ago
      render(
        <SessionStatus
          connectionState="connected"
          sessionStartTime={sessionStart}
        />
      );

      expect(screen.getByTestId('session-timer')).toHaveTextContent('01:01:05');
    });
  });

  describe('PermissionBadge', () => {
    it('should display view-only permission level', () => {
      render(
        <SessionStatus
          connectionState="connected"
          permissionLevel="view-only"
        />
      );

      const badge = screen.getByTestId('permission-badge');
      expect(badge).toHaveTextContent(/view only/i);
      expect(badge).toHaveClass('permission-badge--view-only');
    });

    it('should display control permission level', () => {
      render(
        <SessionStatus connectionState="connected" permissionLevel="control" />
      );

      const badge = screen.getByTestId('permission-badge');
      expect(badge).toHaveTextContent(/control/i);
      expect(badge).toHaveClass('permission-badge--control');
    });

    it('should display admin permission level', () => {
      render(
        <SessionStatus connectionState="connected" permissionLevel="admin" />
      );

      const badge = screen.getByTestId('permission-badge');
      expect(badge).toHaveTextContent(/admin/i);
      expect(badge).toHaveClass('permission-badge--admin');
    });

    it('should not show badge when disconnected', () => {
      render(
        <SessionStatus
          connectionState="disconnected"
          permissionLevel="control"
        />
      );

      expect(screen.queryByTestId('permission-badge')).not.toBeInTheDocument();
    });
  });

  describe('Error messaging', () => {
    it('should display error message when provided', () => {
      render(
        <SessionStatus
          connectionState="failed"
          errorMessage="Connection timeout"
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Connection timeout');
    });

    it('should not display error section when no error', () => {
      render(<SessionStatus connectionState="connected" />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display retry button on connection failure', () => {
      const onRetry = vi.fn();
      render(
        <SessionStatus
          connectionState="failed"
          errorMessage="Connection failed"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.click();

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Token expiry warning', () => {
    it('should display warning when token expires soon', () => {
      const expiresAt = new Date(Date.now() + 60000); // 1 minute from now
      render(
        <SessionStatus
          connectionState="connected"
          tokenExpiresAt={expiresAt}
        />
      );

      expect(screen.getByTestId('token-expiry-warning')).toBeInTheDocument();
      expect(screen.getByText(/expires in/i)).toBeInTheDocument();
    });

    it('should not display warning when token has plenty of time', () => {
      const expiresAt = new Date(Date.now() + 600000); // 10 minutes from now
      render(
        <SessionStatus
          connectionState="connected"
          tokenExpiresAt={expiresAt}
        />
      );

      expect(
        screen.queryByTestId('token-expiry-warning')
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible connection state', () => {
      render(<SessionStatus connectionState="connected" />);

      const status = screen.getByRole('status');
      expect(status).toHaveAccessibleName(/connection.*connected/i);
    });

    it('should announce state changes to screen readers', () => {
      const { rerender } = render(
        <SessionStatus connectionState="connecting" />
      );

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      rerender(<SessionStatus connectionState="connected" />);

      expect(liveRegion).toHaveTextContent(/connected/i);
    });

    it('should have accessible error alerts', () => {
      render(
        <SessionStatus
          connectionState="failed"
          errorMessage="Network error"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAccessibleName(/error.*network error/i);
    });
  });

  describe('State transitions', () => {
    it('should apply transition class when state changes', () => {
      const { rerender } = render(
        <SessionStatus connectionState="connecting" />
      );

      const indicator = screen.getByTestId('connection-indicator');

      rerender(<SessionStatus connectionState="connected" />);

      expect(indicator).toHaveClass('connection-indicator--transitioning');
    });
  });
});
