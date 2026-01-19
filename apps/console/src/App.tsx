import { useState, useCallback } from 'react';
import { Layout } from './components/layout';
import { RevocationNotification } from './components/session/RevocationNotification';

export interface RevocationState {
  isRevoked: boolean;
  reason: string;
}

export function App(): JSX.Element {
  const [revocation, setRevocation] = useState<RevocationState>({
    isRevoked: false,
    reason: '',
  });

  // TODO: Wire this to useSignaling's onRevoked option when signaling is integrated
  // This callback will be passed to useSignaling({ onRevoked: handleRevoked })
  const handleRevoked = useCallback((_sessionId: string, reason: string) => {
    setRevocation({ isRevoked: true, reason });
  }, []);

  const handleDismiss = useCallback(() => {
    // In a real app, this would redirect to login
    // For now, just clear the revocation state
    setRevocation({ isRevoked: false, reason: '' });
  }, []);

  return (
    <>
      <Layout />
      {revocation.isRevoked && (
        <RevocationNotification
          reason={revocation.reason}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
