import { useEffect } from 'react';
import './RevocationNotification.css';

export interface RevocationNotificationProps {
  reason: string;
  onDismiss: () => void;
}

export function RevocationNotification({
  reason,
  onDismiss,
}: RevocationNotificationProps): JSX.Element {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onDismiss();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="revocation-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="revocation-title"
      aria-describedby="revocation-description"
    >
      <div className="revocation-modal">
        <div className="revocation-modal__header">
          <span className="revocation-modal__icon" aria-hidden="true">
            ⚠
          </span>
          <h2 id="revocation-title" className="revocation-modal__title">
            Session Revoked
          </h2>
        </div>

        <div className="revocation-modal__body">
          <p id="revocation-description" className="revocation-modal__message">
            Your session has been terminated by an administrator.
          </p>

          {reason && (
            <div className="revocation-modal__reason">
              <span className="revocation-modal__reason-label">Reason:</span>
              <span
                data-testid="revocation-reason"
                className="revocation-modal__reason-text"
              >
                {reason}
              </span>
            </div>
          )}
        </div>

        <div className="revocation-modal__footer">
          <button
            type="button"
            className="revocation-modal__button"
            onClick={onDismiss}
            autoFocus
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
