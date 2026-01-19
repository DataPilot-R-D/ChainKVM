import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RevocationNotification } from './RevocationNotification';

describe('RevocationNotification', () => {
  describe('Display', () => {
    it('should display the revocation reason', () => {
      render(
        <RevocationNotification
          reason="Policy violation"
          onDismiss={vi.fn()}
        />
      );

      expect(screen.getByTestId('revocation-reason')).toHaveTextContent(
        'Policy violation'
      );
    });

    it('should display "Session Revoked" title', () => {
      render(
        <RevocationNotification reason="Admin action" onDismiss={vi.fn()} />
      );

      expect(screen.getByText('Session Revoked')).toBeInTheDocument();
    });

    it('should display termination message', () => {
      render(
        <RevocationNotification reason="Test reason" onDismiss={vi.fn()} />
      );

      expect(
        screen.getByText(/session has been terminated/i)
      ).toBeInTheDocument();
    });

    it('should display Return to Login button', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      expect(
        screen.getByRole('button', { name: /return to login/i })
      ).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onDismiss when button is clicked', () => {
      const onDismiss = vi.fn();

      render(
        <RevocationNotification reason="Test" onDismiss={onDismiss} />
      );

      const button = screen.getByRole('button', { name: /return to login/i });
      fireEvent.click(button);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have alertdialog role', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have labeled title', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'revocation-title');
    });

    it('should have described content', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute(
        'aria-describedby',
        'revocation-description'
      );
    });
  });

  describe('Distinction from network error', () => {
    it('should not display "Connection" in message', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      expect(screen.queryByText(/connection lost/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/connection failed/i)).not.toBeInTheDocument();
    });

    it('should display "Revoked" explicitly', () => {
      render(
        <RevocationNotification reason="Test" onDismiss={vi.fn()} />
      );

      expect(screen.getByText(/revoked/i)).toBeInTheDocument();
    });
  });
});
